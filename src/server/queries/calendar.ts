import "server-only";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyStat, trade, tradingAccount, transaction } from "@/db/schema";
import type { DailyPoint } from "@/lib/stats";
import type { DataMode } from "@/lib/session";
import { backtestCond, currentBacktestCond } from "./mode";
import { getReportingCurrency } from "./stats";

const usdScale = (currency: string) =>
  currency === "USC" ? sql`1` : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;

/** Net P&L per trading day across the given accounts, in one reporting currency. */
export async function getDailyPnl(accountIds: string[], from?: string, to?: string, opts: { tz?: string; mode?: DataMode } = {}) {
  const currency = await getReportingCurrency(accountIds);
  if (accountIds.length === 0) return { currency, days: [] as DailyPoint[] };
  const fx = usdScale(currency);
  // daily_stat only holds live trades; backtests are aggregated on the fly.
  const mode = opts.mode ?? "live";
  if (mode !== "live" && opts.tz) {
    const day = sql<string>`to_char(${trade.closeTime} at time zone ${opts.tz}, 'YYYY-MM-DD')`;
    const net = sql`${trade.netPnl} * ${fx}`;
    const rows = await db
      .select({
        day,
        net: sql<string>`sum(${net})`,
        trades: sql<string>`count(*)`,
        wins: sql<string>`count(*) filter (where ${trade.netPnl} > 0)`,
        losses: sql<string>`count(*) filter (where ${trade.netPnl} < 0)`,
        gp: sql<string>`coalesce(sum(${net}) filter (where ${trade.netPnl} > 0), 0)`,
        gl: sql<string>`coalesce(sum(${net}) filter (where ${trade.netPnl} < 0), 0)`,
      })
      .from(trade)
      .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
      .where(
        and(
          inArray(trade.accountId, accountIds),
          eq(trade.status, "CLOSED"),
          backtestCond(mode),
          from ? sql`(${trade.closeTime} at time zone ${opts.tz})::date >= ${from}::date` : undefined,
          to ? sql`(${trade.closeTime} at time zone ${opts.tz})::date <= ${to}::date` : undefined,
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`);
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
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
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
        await currentBacktestCond(),
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
    await currentBacktestCond(),
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

export type OpenedTrade = Awaited<ReturnType<typeof getOpenedTrades>>[number];

/**
 * Live trades opened on the given day (user timezone), whether they closed the
 * same day, later, or are still running.
 */
export async function getOpenedTrades(userId: string, accountIds: string[], day: string, tz: string) {
  if (accountIds.length === 0) return [];
  const rows = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      status: trade.status,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      volume: trade.volume,
      netPnl: trade.netPnl,
      sl: trade.sl,
      tp: trade.tp,
      currency: tradingAccount.currency,
      accountName: tradingAccount.nickname,
      accountColor: tradingAccount.color,
      closeDay: sql<string | null>`to_char(${trade.closeTime} at time zone ${tz}, 'YYYY-MM-DD')`,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(
      and(
        eq(trade.userId, userId),
        inArray(trade.accountId, accountIds),
        await currentBacktestCond(),
        sql`(${trade.openTime} at time zone ${tz})::date = ${day}::date`,
      ),
    )
    .orderBy(asc(trade.openTime));
  return rows;
}

/** Deposits, withdrawals and other balance operations on the given day. */
export async function getDayTransactions(accountIds: string[], day: string, tz: string) {
  if (accountIds.length === 0) return [];
  return db
    .select({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      comment: transaction.comment,
      time: transaction.time,
      currency: tradingAccount.currency,
      accountName: tradingAccount.nickname,
      accountColor: tradingAccount.color,
    })
    .from(transaction)
    .innerJoin(tradingAccount, eq(tradingAccount.id, transaction.accountId))
    .where(
      and(inArray(transaction.accountId, accountIds), sql`(${transaction.time} at time zone ${tz})::date = ${day}::date`),
    )
    .orderBy(asc(transaction.time));
}

/**
 * Per day: how many live trades were opened, and how many of those are still
 * open. Lets the calendar mark days that have orders but no closed P&L yet.
 */
export async function getOpenedByDay(userId: string, accountIds: string[], from: string, to: string, tz: string) {
  if (accountIds.length === 0) return {} as Record<string, { opened: number; running: number }>;
  const day = sql<string>`to_char(${trade.openTime} at time zone ${tz}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day,
      opened: sql<string>`count(*)`,
      running: sql<string>`count(*) filter (where ${trade.status} = 'OPEN')`,
    })
    .from(trade)
    .where(
      and(
        eq(trade.userId, userId),
        inArray(trade.accountId, accountIds),
        await currentBacktestCond(),
        sql`(${trade.openTime} at time zone ${tz})::date between ${from}::date and ${to}::date`,
      ),
    )
    // By position: the timezone is a bind parameter, so repeating the
    // expression here would be a different parameter to Postgres.
    .groupBy(sql`1`);
  return Object.fromEntries(rows.map((r) => [r.day, { opened: Number(r.opened), running: Number(r.running) }]));
}
