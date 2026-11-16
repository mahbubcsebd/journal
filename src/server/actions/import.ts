"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendGoalAlerts } from "@/server/services/notifications";
import { db } from "@/db";
import { syncLog, tradingAccount } from "@/db/schema";
import { parseReportFile, ReportParseError, type ParsedReport } from "@/lib/import";
import { deriveTrade } from "@/lib/trading/metrics";
import { getCurrentUser, getUserAccounts } from "@/lib/session";
import {
  existingPositionIds,
  insertDeals,
  insertTransactions,
  rebuildDailyStats,
  upsertTrades,
} from "@/server/services/trades";

export type ImportPreview = {
  ok: true;
  format: ParsedReport["format"];
  detected: ParsedReport["account"];
  matchedAccountId: string | null;
  trades: number;
  openTrades: number;
  newTrades: number;
  existingTrades: number;
  from: string | null;
  to: string | null;
  netPnl: number;
  wins: number;
  losses: number;
  deposits: number;
  withdrawals: number;
  symbols: { symbol: string; count: number }[];
  warnings: string[];
};

export type ImportResult =
  | { ok: true; accountId: string; inserted: number; updated: number; skipped: number; transactions: number; createdAccount: boolean }
  | { ok: false; error: string };

async function readUpload(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ReportParseError("Choose a file to import.");
  const offset = Number(formData.get("offset") ?? 0);
  return parseReportFile(file.name, await file.arrayBuffer(), Number.isFinite(offset) ? offset : 0);
}

function matchAccount<A extends { id: string; login: string; server: string }>(
  accounts: A[],
  detected: ParsedReport["account"],
): A | null {
  if (!detected) return null;
  const sameLogin = accounts.filter((a) => a.login === detected.login);
  return (
    sameLogin.find((a) => detected.server && a.server.toLowerCase() === detected.server.toLowerCase()) ??
    sameLogin[0] ??
    null
  );
}

export async function previewImport(formData: FormData): Promise<ImportPreview | { ok: false; error: string }> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Please sign in again." };
  try {
    const report = await readUpload(formData);
    const accounts = await getUserAccounts(u.id);
    const chosen = String(formData.get("accountId") ?? "");
    const matched = matchAccount(accounts, report.account);
    const target = chosen && chosen !== "auto" ? accounts.find((a) => a.id === chosen) : matched;

    const ids = report.trades.map((t) => t.positionId).filter((x): x is string => Boolean(x));
    const existing = target ? await existingPositionIds(target.id, ids) : new Set<string>();

    const closed = report.trades.filter((t) => t.closeTime);
    const derived = closed.map((t) => deriveTrade(t));
    const times = closed.map((t) => t.closeTime!.getTime());
    const bySymbol = new Map<string, number>();
    for (const t of report.trades) bySymbol.set(t.symbol, (bySymbol.get(t.symbol) ?? 0) + 1);

    return {
      ok: true,
      format: report.format,
      detected: report.account,
      matchedAccountId: matched?.id ?? null,
      trades: report.trades.length,
      openTrades: report.trades.length - closed.length,
      newTrades: report.trades.filter((t) => !t.positionId || !existing.has(t.positionId)).length,
      existingTrades: report.trades.filter((t) => t.positionId && existing.has(t.positionId)).length,
      from: times.length ? new Date(Math.min(...times)).toISOString() : null,
      to: times.length ? new Date(Math.max(...times)).toISOString() : null,
      netPnl: Math.round(derived.reduce((s, t) => s + t.netPnl, 0) * 100) / 100,
      wins: derived.filter((t) => t.netPnl > 0).length,
      losses: derived.filter((t) => t.netPnl < 0).length,
      deposits: report.transactions.filter((t) => t.type === "DEPOSIT").reduce((s, t) => s + t.amount, 0),
      withdrawals: report.transactions.filter((t) => t.type === "WITHDRAWAL").reduce((s, t) => s + t.amount, 0),
      symbols: [...bySymbol].map(([symbol, count]) => ({ symbol, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      warnings: report.warnings,
    };
  } catch (e) {
    if (e instanceof ReportParseError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "This file couldn't be read. Make sure it's an MT5 history report or a CSV." };
  }
}

export async function commitImport(formData: FormData): Promise<ImportResult> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Please sign in again." };

  let report: ParsedReport;
  try {
    report = await readUpload(formData);
  } catch (e) {
    return { ok: false, error: e instanceof ReportParseError ? e.message : "This file couldn't be read." };
  }

  const accounts = await getUserAccounts(u.id);
  const chosen = String(formData.get("accountId") ?? "auto");
  let account = chosen !== "auto" ? accounts.find((a) => a.id === chosen) : matchAccount(accounts, report.account);
  let createdAccount = false;

  if (!account && chosen === "auto" && report.account) {
    // First import for this sub-account: create it from the report header.
    const d = report.account;
    [account] = await db
      .insert(tradingAccount)
      .values({
        userId: u.id,
        login: d.login,
        server: d.server ?? "Exness-MT5",
        nickname: `${d.currency === "USC" ? "Cent" : "MT5"} #${d.login}`,
        environment: d.environment,
        currency: d.currency,
        accountType: d.currency === "USC" ? "Standard Cent" : "Standard",
        syncMethod: "IMPORT",
        status: "PENDING",
      })
      .onConflictDoNothing()
      .returning();
    createdAccount = Boolean(account);
    account ??= (await getUserAccounts(u.id)).find((a) => a.login === d.login);
  }
  if (!account) return { ok: false, error: "Choose which account this file belongs to." };
  if (report.account && report.account.login !== account.login) {
    return {
      ok: false,
      error: `This report is for account #${report.account.login}, but you picked #${account.login}.`,
    };
  }

  // Backtests only add trades: their deposits and deals would distort the live account.
  const backtest = formData.get("backtest") === "1";
  const res = await upsertTrades(u.id, account.id, "IMPORT", report.trades, { backtest });
  if (!backtest) await insertDeals(account.id, "IMPORT", report.deals);
  const transactions = backtest ? 0 : await insertTransactions(account.id, report.transactions);
  await rebuildDailyStats(account.id);
  await db
    .update(tradingAccount)
    .set({
      lastSyncAt: new Date(),
      ...(account.syncMethod === "MANUAL" ? { syncMethod: "IMPORT" as const } : {}),
    })
    .where(and(eq(tradingAccount.id, account.id), eq(tradingAccount.userId, u.id)));
  await db.insert(syncLog).values({
    userId: u.id,
    accountId: account.id,
    source: "IMPORT",
    status: "OK",
    message: `${res.inserted} new, ${res.updated} updated, ${res.skipped} skipped (${report.format}${backtest ? ", backtest" : ""})`,
    itemCount: res.inserted + res.updated,
  });

  // New trades may break a limit goal for the current period: email after responding.
  after(async () => {
    try {
      await sendGoalAlerts(u);
    } catch (e) {
      console.error("goal alerts after import failed", e);
    }
  });

  revalidatePath("/", "layout");
  return { ok: true, accountId: account.id, ...res, transactions, createdAccount };
}
