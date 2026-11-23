"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { tradingAccount } from "@/db/schema";
import { mapPaperTrades } from "@/lib/desk/paper-trades";
import type { JournalTrade } from "@/lib/desk/types";
import { smcConfig } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { rebuildDailyStats, upsertTrades } from "@/server/services/trades";

const SMC_TIMEOUT_MS = 15_000;
const PAPER_LOGIN = "smc-paper";
const PAPER_SERVER = "SMC Desk";

/** Only the fields the mapper reads; the SMC server is external input. */
const smcTrade = z.object({
  id: z.string().min(1).max(100),
  symbol: z.string().min(1).max(30),
  dir: z.enum(["bull", "bear"]),
  entry: z.number().finite(),
  stop: z.number().finite(),
  target: z.number().finite(),
  digits: z.number().int().min(0).max(10),
  createdAt: z.number().int().positive(),
  filledAt: z.number().int().positive().optional(),
  closedAt: z.number().int().positive().optional(),
  status: z.enum(["pending", "open", "won", "lost", "cancelled", "closed"]),
  resultR: z.number().finite().optional(),
  source: z.enum(["paper", "mt5"]).optional(),
  pnlUsd: z.number().finite().optional(),
  volume: z.number().finite().nonnegative().optional(),
  exitPrice: z.number().finite().optional(),
});
const smcJournal = z.object({ trades: z.array(smcTrade).max(10_000) });

export type PaperSyncResult = { ok: true; inserted: number; updated: number } | { ok: false; error: string };

/** The user's virtual "SMC Paper" account (DEMO), created on first sync. */
async function paperAccountId(userId: string): Promise<string> {
  await db
    .insert(tradingAccount)
    .values({
      userId,
      login: PAPER_LOGIN,
      server: PAPER_SERVER,
      broker: "SMC Desk",
      nickname: "SMC Paper",
      environment: "DEMO",
      syncMethod: "SMC",
      status: "CONNECTED",
      color: "#e5b84b",
    })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(and(eq(tradingAccount.userId, userId), eq(tradingAccount.login, PAPER_LOGIN), eq(tradingAccount.server, PAPER_SERVER)))
    .limit(1);
  if (!row) throw new Error("Could not create the SMC Paper account");
  return row.id;
}

async function fetchPaperTrades(apiUrl: string, accessKey: string) {
  const res = await fetch(`${apiUrl}/api/journal`, {
    headers: accessKey ? { "x-access-key": accessKey } : {},
    signal: AbortSignal.timeout(SMC_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SMC server answered ${res.status}`);
  return smcJournal.parse(await res.json()).trades as JournalTrade[];
}

/** Pulls SMC Desk paper trades into Journal's trade table (idempotent). */
export async function syncPaperTrades(): Promise<PaperSyncResult> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  const cfg = smcConfig();
  if (!cfg) return { ok: false, error: "SMC Desk is not configured." };

  let trades: JournalTrade[];
  try {
    trades = await fetchPaperTrades(cfg.apiUrl, cfg.accessKey);
  } catch (e) {
    console.error("[desk] paper trade fetch failed", e);
    return { ok: false, error: "Could not reach the SMC server. Is the PC/tunnel running?" };
  }

  const accountId = await paperAccountId(u.id);
  const { inserted, updated } = await upsertTrades(u.id, accountId, "SMC", mapPaperTrades(trades));
  await db.update(tradingAccount).set({ lastSyncAt: new Date() }).where(eq(tradingAccount.id, accountId));
  await rebuildDailyStats(accountId);
  revalidatePath("/", "layout");
  return { ok: true, inserted, updated };
}
