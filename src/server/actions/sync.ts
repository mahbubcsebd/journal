"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { tradingAccount } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { connectMetaApi, disconnectMetaApi, metaApiConfigured, staleMetaApiAccounts, syncMetaApiAccount } from "@/server/services/metaapi";

async function ownAccount(id: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  const [a] = await db.select().from(tradingAccount).where(and(eq(tradingAccount.id, id), eq(tradingAccount.userId, u.id))).limit(1);
  if (!a) throw new Error("Account not found");
  return { user: u, account: a };
}

export async function connectMetaApiAccount(accountId: string, investorPassword: string): Promise<{ ok: boolean; message: string }> {
  const { account } = await ownAccount(accountId);
  if (!metaApiConfigured()) return { ok: false, message: "MetaApi isn't set up on the server (METAAPI_TOKEN)." };
  const pw = z.string().min(4, "Enter the investor password").max(64).safeParse(investorPassword);
  if (!pw.success) return { ok: false, message: pw.error.issues[0].message };
  if (account.metaapiAccountId) return { ok: false, message: "This account is already connected to MetaApi." };
  try {
    await connectMetaApi(account, pw.data);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "MetaApi rejected the account." };
  }
  revalidatePath("/accounts");
  return { ok: true, message: "Connected. MetaApi is deploying your account — the first sync can take a few minutes." };
}

export async function syncAccountNow(accountId: string): Promise<{ ok: boolean; message: string }> {
  const { account } = await ownAccount(accountId);
  if (account.syncMethod !== "METAAPI") return { ok: false, message: "This account syncs through the MT5 EA — it updates by itself while MT5 is running." };
  try {
    const r = await syncMetaApiAccount(account);
    revalidatePath("/", "layout");
    return { ok: true, message: r.newDeals ? `${r.newDeals} new deals synced` : "Already up to date" };
  } catch (e) {
    revalidatePath("/accounts");
    return { ok: false, message: e instanceof Error ? e.message : "Sync failed" };
  }
}

export async function disconnectAccount(accountId: string) {
  const { account } = await ownAccount(accountId);
  if (account.syncMethod === "METAAPI") await disconnectMetaApi(account);
  else
    await db
      .update(tradingAccount)
      .set({ syncMethod: "MANUAL", status: "DISCONNECTED", openPositions: null })
      .where(eq(tradingAccount.id, account.id));
  revalidatePath("/", "layout");
}

/** Called periodically by the open app: refresh MetaApi accounts not synced in 5 minutes. */
export async function autoSync() {
  const u = await getCurrentUser();
  if (!u || !metaApiConfigured()) return { synced: 0 };
  const stale = (await staleMetaApiAccounts(u.id, 5)).slice(0, 3);
  let synced = 0;
  for (const a of stale) {
    try {
      const r = await syncMetaApiAccount(a);
      synced += r.newDeals;
    } catch {
      // status + message are recorded on the account
    }
  }
  if (synced) revalidatePath("/", "layout");
  return { synced };
}
