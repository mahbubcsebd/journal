import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deal, syncLog, tradingAccount, type OpenPosition } from "@/db/schema";
import { buildTradesFromDeals, type RawDeal } from "@/lib/trading/build-trades";
import type { ParsedTransaction } from "@/lib/import/parse-report";
import { insertDeals, insertTransactions, rebuildDailyStats, upsertTrades } from "./trades";

export type BrokerSnapshot = {
  balance?: number | null;
  equity?: number | null;
  leverage?: number | null;
  currency?: string | null;
  openPositions?: OpenPosition[] | null;
};

/** Balance-type deals become deposits / withdrawals. */
export function transactionsFromDeals(deals: RawDeal[]): ParsedTransaction[] {
  return deals
    .filter((d) => d.type === "BALANCE" || d.type === "CREDIT" || d.type === "BONUS")
    .map((d) => ({
      ticket: d.ticket,
      type: d.type === "BALANCE" ? (d.profit >= 0 ? "DEPOSIT" : "WITHDRAWAL") : (d.type as "CREDIT" | "BONUS"),
      amount: Math.abs(d.profit),
      time: d.time,
      comment: null,
    }));
}

/**
 * Store raw deals from a live source (EA or MetaApi), rebuild the positions
 * they touch from *all* stored deals of those positions, and refresh stats.
 * Idempotent: re-sending the same deals changes nothing.
 */
export async function ingestDeals(opts: {
  userId: string;
  accountId: string;
  source: "EA" | "METAAPI";
  deals: RawDeal[];
  snapshot?: BrokerSnapshot;
}) {
  const { userId, accountId, source, deals, snapshot } = opts;
  const newDeals = await insertDeals(accountId, source, deals);
  const transactions = await insertTransactions(accountId, transactionsFromDeals(deals));

  // Rebuild every position that received a deal (open positions too, so they show as OPEN).
  const positionIds = [...new Set(deals.map((d) => d.positionId).filter((x): x is string => Boolean(x)))];
  let tradeResult = { inserted: 0, updated: 0, skipped: 0 };
  if (positionIds.length) {
    const stored = await db
      .select()
      .from(deal)
      .where(and(eq(deal.accountId, accountId), inArray(deal.positionId, positionIds)));
    const trades = buildTradesFromDeals(
      stored.map((d) => ({
        ticket: d.ticket,
        positionId: d.positionId,
        symbol: d.symbol,
        type: d.type,
        entry: d.entry,
        volume: d.volume,
        price: d.price,
        sl: d.sl,
        tp: d.tp,
        commission: d.commission,
        swap: d.swap,
        fee: d.fee,
        profit: d.profit,
        time: d.time,
      })),
    );
    tradeResult = await upsertTrades(userId, accountId, source, trades);
  }

  await db
    .update(tradingAccount)
    .set({
      status: "CONNECTED",
      statusMessage: null,
      lastSyncAt: new Date(),
      ...(snapshot?.balance != null ? { balance: snapshot.balance } : {}),
      ...(snapshot?.equity != null ? { equity: snapshot.equity } : {}),
      ...(snapshot?.leverage ? { leverage: Math.round(snapshot.leverage) } : {}),
      ...(snapshot?.currency ? { currency: snapshot.currency } : {}),
      ...(snapshot?.openPositions ? { openPositions: snapshot.openPositions } : {}),
    })
    .where(eq(tradingAccount.id, accountId));

  if (newDeals || tradeResult.inserted || tradeResult.updated) await rebuildDailyStats(accountId);
  if (newDeals || transactions) {
    await db.insert(syncLog).values({
      userId,
      accountId,
      source,
      status: "OK",
      message: `${newDeals} new deals, ${tradeResult.inserted} new trades, ${tradeResult.updated} updated`,
      itemCount: newDeals,
    });
  }
  return { newDeals, transactions, ...tradeResult };
}

export async function markSyncError(userId: string, accountId: string, source: "EA" | "METAAPI", message: string) {
  await db.update(tradingAccount).set({ status: "ERROR", statusMessage: message.slice(0, 300) }).where(eq(tradingAccount.id, accountId));
  await db.insert(syncLog).values({ userId, accountId, source, status: "ERROR", message: message.slice(0, 500) });
}
