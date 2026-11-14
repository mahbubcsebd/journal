import "server-only";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyStat, trade, tradingAccount } from "@/db/schema";
import type { DailyPoint } from "@/lib/stats";
import { getReportingCurrency } from "./stats";

const usdScale = (currency: string) =>
  currency === "USC" ? sql`1` : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;

/** Net P&L per trading day across the given accounts, in one reporting currency. */
export async function getDailyPnl(accountIds: string[], from?: string, to?: string) {
  const currency = await getReportingCurrency(accountIds);
  if (accountIds.length === 0) return { currency, days: [] as DailyPoint[] };
  const fx = usdScale(currency);
  const rows = await db
    .select({
      day: dailyStat.day,
      net: sql<string>`sum(${dailyStat.netPnl} * ${fx})`,
      trades: sql<string>`sum(${dailyStat.trades})`,
      wins: sql<string>`sum(${dailyStat.wins})`,
      losses: sql<string>`sum(${dailyStat.losses})`,
      gp: sql<string>`sum(${dailyStat.grossProfit} * ${fx})`,
      gl: sql<string>`sum(${dailyStat.grossLoss} * ${fx})`,
    })
    .from(dailyStat)
    .innerJoin(tradingAccount, eq(tradingAccount.id, dailyStat.accountId))
    .where(
      and(
        inArray(dailyStat.accountId, accountIds),
        from ? gte(dailyStat.day, from) : undefined,
        to ? lte(dailyStat.day, to) : undefined,
      ),
    )
    .groupBy(dailyStat.day)
    .orderBy(asc(dailyStat.day));
  return {
    currency,
    days: rows.map((r) => ({
      day: r.day,
      net: Math.round(Number(r.net) * 100) / 100,
      trades: Number(r.trades),
      wins: Number(r.wins),
      losses: Number(r.losses),
      grossProfit: Number(r.gp),
      grossLoss: Number(r.gl),
    })),
  };
}

export type CalendarTrade = Awaited<ReturnType<typeof getClosedTrades>>[number];

/** Closed live trades whose close falls on the given trading days (user timezone). */
export async function getClosedTrades(userId: string, accountIds: string[], from: string, to: string, tz: string) {
  if (accountIds.length === 0) return [];
  const currency = await getReportingCurrency(accountIds);
  const day = sql<string>`to_char(${trade.closeTime} at time zone ${tz}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      id: trade.id,
      day,
      symbol: trade.symbol,
      side: trade.side,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      volume: trade.volume,
      netPnl: trade.netPnl,
      norm: sql<string>`${trade.netPnl} * ${usdScale(currency)}`,
      rMultiple: trade.rMultiple,
      currency: tradingAccount.currency,
      accountName: tradingAccount.nickname,
      accountColor: tradingAccount.color,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(
      and(
        eq(trade.userId, userId),
        inArray(trade.accountId, accountIds),
        eq(trade.status, "CLOSED"),
        eq(trade.isBacktest, false),
        sql`(${trade.closeTime} at time zone ${tz})::date between ${from}::date and ${to}::date`,
      ),
    )
    .orderBy(asc(trade.closeTime));
  return rows.map((r) => ({ ...r, closeTime: r.closeTime!, norm: Number(r.norm) }));
}

/** Net P&L by symbol and by side over a day range, for the dashboard. */
export async function getBreakdowns(userId: string, accountIds: string[], from: string | undefined, tz: string) {
  if (accountIds.length === 0) return { symbols: [], sides: [] };
  const currency = await getReportingCurrency(accountIds);
  const fx = usdScale(currency);
  const where = and(
    eq(trade.userId, userId),
    inArray(trade.accountId, accountIds),
    eq(trade.status, "CLOSED"),
    eq(trade.isBacktest, false),
    from ? sql`(${trade.closeTime} at time zone ${tz})::date >= ${from}::date` : undefined,
  );
  const agg = {
    net: sql<string>`sum(${trade.netPnl} * ${fx})`,
    trades: sql<string>`count(*)`,
    wins: sql<string>`count(*) filter (where ${trade.netPnl} > 0)`,
  };
  const [symbols, sides] = await Promise.all([
    db
      .select({ key: trade.symbol, ...agg })
      .from(trade)
      .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
      .where(where)
      .groupBy(trade.symbol),
    db
      .select({ key: trade.side, ...agg })
      .from(trade)
      .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
      .where(where)
      .groupBy(trade.side),
  ]);
  const norm = (r: { key: string; net: string; trades: string; wins: string }) => ({
    key: r.key,
    net: Math.round(Number(r.net) * 100) / 100,
    trades: Number(r.trades),
    wins: Number(r.wins),
  });
  return {
    symbols: symbols.map(norm).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    sides: sides.map(norm),
  };
}
