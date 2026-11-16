import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyStat, deal, trade, tradingAccount, transaction, user } from "@/db/schema";
import type { RawDeal } from "@/lib/trading/build-trades";
import { deriveTrade, type TradeInput } from "@/lib/trading/metrics";
import type { ParsedTransaction } from "@/lib/import/parse-report";

type Source = "METAAPI" | "EA" | "IMPORT" | "MANUAL";

export function tradeRow(userId: string, accountId: string, source: Source, t: TradeInput) {
  const d = deriveTrade(t);
  return {
    userId,
    accountId,
    source,
    positionId: d.positionId,
    symbol: d.symbol,
    side: d.side,
    status: d.status,
    openTime: d.openTime,
    closeTime: d.closeTime,
    openPrice: d.openPrice,
    closePrice: d.closePrice,
    volume: d.volume,
    sl: d.sl,
    tp: d.tp,
    commission: d.commission,
    swap: d.swap,
    grossPnl: d.grossPnl,
    netPnl: d.netPnl,
    pips: d.pips,
    rMultiple: d.rMultiple,
    durationSec: d.durationSec,
    session: d.session,
  };
}

/** Which of these position ids already exist for the account. */
export async function existingPositionIds(accountId: string, ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const rows = await db
    .select({ positionId: trade.positionId })
    .from(trade)
    .where(and(eq(trade.accountId, accountId), inArray(trade.positionId, ids)));
  return new Set(rows.map((r) => r.positionId!));
}

/**
 * Insert or refresh trades. Market data (prices, P&L, close) is overwritten by
 * the broker's version; journal fields (notes, tags, rating, setup) are kept.
 */
export async function upsertTrades(userId: string, accountId: string, source: Source, trades: TradeInput[], opts: { backtest?: boolean } = {}) {
  // Backtest imports mark new rows; an existing live trade is never flipped.
  const row = (t: TradeInput) => ({ ...tradeRow(userId, accountId, source, t), ...(opts.backtest ? { isBacktest: true } : {}) });
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const withId = trades.filter((t) => t.positionId);
  const withoutId = trades.filter((t) => !t.positionId);

  for (let i = 0; i < withId.length; i += 500) {
    const chunk = withId.slice(i, i + 500).map(row);
    const res = await db
      .insert(trade)
      .values(chunk)
      .onConflictDoUpdate({
        target: [trade.accountId, trade.positionId],
        targetWhere: sql`${trade.positionId} is not null`,
        set: {
          status: sql`excluded.status`,
          closeTime: sql`excluded.close_time`,
          closePrice: sql`excluded.close_price`,
          openPrice: sql`excluded.open_price`,
          volume: sql`excluded.volume`,
          sl: sql`coalesce(${trade.sl}, excluded.sl)`,
          tp: sql`coalesce(${trade.tp}, excluded.tp)`,
          commission: sql`excluded.commission`,
          swap: sql`excluded.swap`,
          grossPnl: sql`excluded.gross_pnl`,
          netPnl: sql`excluded.net_pnl`,
          pips: sql`excluded.pips`,
          rMultiple: sql`coalesce(excluded.r_multiple, ${trade.rMultiple})`,
          durationSec: sql`excluded.duration_sec`,
          updatedAt: new Date(),
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    for (const r of res) {
      if (r.inserted) inserted++;
      else updated++;
    }
  }

  // Rows without a broker id (e.g. some CSVs): skip exact duplicates.
  for (const t of withoutId) {
    const [dup] = await db
      .select({ id: trade.id })
      .from(trade)
      .where(
        and(
          eq(trade.accountId, accountId),
          isNull(trade.positionId),
          eq(trade.symbol, t.symbol),
          eq(trade.openTime, t.openTime),
          eq(trade.openPrice, t.openPrice),
        ),
      )
      .limit(1);
    if (dup) {
      skipped++;
      continue;
    }
    await db.insert(trade).values(row(t));
    inserted++;
  }

  return { inserted, updated, skipped };
}

export async function insertDeals(accountId: string, source: Source, deals: RawDeal[]) {
  let inserted = 0;
  for (let i = 0; i < deals.length; i += 500) {
    const res = await db
      .insert(deal)
      .values(
        deals.slice(i, i + 500).map((d) => ({
          accountId,
          source,
          ticket: d.ticket,
          positionId: d.positionId,
          symbol: d.symbol,
          type: d.type,
          entry: d.entry,
          volume: d.volume,
          price: d.price,
          sl: d.sl ?? null,
          tp: d.tp ?? null,
          commission: d.commission,
          swap: d.swap,
          fee: d.fee ?? 0,
          profit: d.profit,
          time: d.time,
        })),
      )
      .onConflictDoNothing({ target: [deal.accountId, deal.ticket] })
      .returning({ id: deal.id });
    inserted += res.length;
  }
  return inserted;
}

export async function insertTransactions(accountId: string, txs: ParsedTransaction[]) {
  if (txs.length === 0) return 0;
  const res = await db
    .insert(transaction)
    .values(txs.map((t) => ({ accountId, ...t })))
    .onConflictDoNothing({ target: [transaction.accountId, transaction.ticket] })
    .returning({ id: transaction.id });
  return res.length;
}

/**
 * Recompute the per-day aggregates for one account. Days are bucketed by the
 * close time in the user's timezone; backtests are excluded.
 */
export async function rebuildDailyStats(accountId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(dailyStat).where(eq(dailyStat.accountId, accountId));
    await tx.execute(sql`
      insert into ${dailyStat} (account_id, user_id, day, net_pnl, gross_profit, gross_loss, commission, swap, trades, wins, losses, volume, updated_at)
      select t.account_id, t.user_id, (t.close_time at time zone u.timezone)::date as day,
             sum(t.net_pnl),
             sum(case when t.net_pnl > 0 then t.net_pnl else 0 end),
             sum(case when t.net_pnl < 0 then t.net_pnl else 0 end),
             sum(t.commission), sum(t.swap),
             count(*),
             count(*) filter (where t.net_pnl > 0),
             count(*) filter (where t.net_pnl < 0),
             sum(t.volume),
             now()
      from ${trade} t
      join ${user} u on u.id = t.user_id
      where t.account_id = ${accountId} and t.status = 'CLOSED' and t.close_time is not null and not t.is_backtest
      group by t.account_id, t.user_id, day
    `);
  });
}

export async function rebuildAllDailyStats(userId: string) {
  const accounts = await db.select({ id: tradingAccount.id }).from(tradingAccount).where(eq(tradingAccount.userId, userId));
  for (const a of accounts) await rebuildDailyStats(a.id);
}
