import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { setup, tag, trade, tradeTag, tradingAccount } from "@/db/schema";
import type { ATrade } from "@/lib/analytics";
import { currentBacktestCond } from "./mode";
import { getReportingCurrency } from "./stats";

/** Closed live trades in a day range, flattened for the analytics engine. */
export async function getAnalyticsTrades(
  userId: string,
  accountIds: string[],
  from: string | undefined,
  to: string | undefined,
  tz: string,
  opts: { setupId?: string } = {},
): Promise<{ currency: string; trades: ATrade[] }> {
  const currency = await getReportingCurrency(accountIds);
  if (accountIds.length === 0) return { currency, trades: [] };
  const fx = currency === "USC" ? sql`1` : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;
  const closeDay = sql`(${trade.closeTime} at time zone ${tz})::date`;

  const modeCond = await currentBacktestCond();
  const rows = await db
    .select({
      id: trade.id,
      day: sql<string>`to_char(${trade.closeTime} at time zone ${tz}, 'YYYY-MM-DD')`,
      hour: sql<number>`extract(hour from ${trade.openTime} at time zone ${tz})::int`,
      weekday: sql<number>`extract(dow from ${trade.openTime} at time zone ${tz})::int`,
      closeHour: sql<number>`extract(hour from ${trade.closeTime} at time zone ${tz})::int`,
      closeWeekday: sql<number>`extract(dow from ${trade.closeTime} at time zone ${tz})::int`,
      openPrice: trade.openPrice,
      plannedR: sql<string | null>`case when ${trade.sl} is not null and ${trade.tp} is not null and ${trade.openPrice} <> ${trade.sl}
        then abs(${trade.tp} - ${trade.openPrice}) / abs(${trade.openPrice} - ${trade.sl}) end`,
      fee: sql<string>`coalesce((select sum(d.fee) from deal d where d.account_id = "trade"."account_id" and d.position_id = "trade"."position_id"), 0) * ${fx}`,
      openTimeOfDay: sql<string>`extract(hour from ${trade.openTime} at time zone ${tz}) + extract(minute from ${trade.openTime} at time zone ${tz}) / 60.0`,
      closeTimeOfDay: sql<string>`extract(hour from ${trade.closeTime} at time zone ${tz}) + extract(minute from ${trade.closeTime} at time zone ${tz}) / 60.0`,
      symbol: trade.symbol,
      side: trade.side,
      session: trade.session,
      net: sql<string>`${trade.netPnl} * ${fx}`,
      commission: sql<string>`${trade.commission} * ${fx}`,
      swap: sql<string>`${trade.swap} * ${fx}`,
      volume: trade.volume,
      durationSec: trade.durationSec,
      rMultiple: trade.rMultiple,
      setup: setup.name,
      setupId: trade.setupId,
      emotionBefore: trade.emotionBefore,
      followedPlan: trade.followedPlan,
      checklist: trade.checklist,
      rating: trade.rating,
      accountName: tradingAccount.nickname,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .leftJoin(setup, eq(setup.id, trade.setupId))
    .where(
      and(
        eq(trade.userId, userId),
        inArray(trade.accountId, accountIds),
        eq(trade.status, "CLOSED"),
        modeCond,
        from ? sql`${closeDay} >= ${from}::date` : undefined,
        to ? sql`${closeDay} <= ${to}::date` : undefined,
        opts.setupId ? eq(trade.setupId, opts.setupId) : undefined,
      ),
    )
    .orderBy(asc(trade.closeTime));

  const tagRows = rows.length
    ? await db
        .select({ tradeId: tradeTag.tradeId, name: tag.name, kind: tag.kind })
        .from(tradeTag)
        .innerJoin(tag, eq(tag.id, tradeTag.tagId))
        .where(inArray(tradeTag.tradeId, rows.map((r) => r.id)))
    : [];
  const tagsByTrade = new Map<string, ATrade["tags"]>();
  for (const t of tagRows) tagsByTrade.set(t.tradeId, [...(tagsByTrade.get(t.tradeId) ?? []), { name: t.name, kind: t.kind }]);

  return {
    currency,
    trades: rows.map(({ openTime, closeTime, checklist, ...r }) => ({
      ...r,
      checklist: checklist && Object.keys(checklist).length
        ? { done: Object.values(checklist).filter(Boolean).length, total: Object.keys(checklist).length }
        : null,
      openAt: openTime.getTime(),
      closeAt: (closeTime ?? openTime).getTime(),
      plannedR: r.plannedR == null ? null : Math.round(Number(r.plannedR) * 100) / 100,
      fee: Number(r.fee),
      openTimeOfDay: Number(r.openTimeOfDay),
      closeTimeOfDay: Number(r.closeTimeOfDay),
      net: Math.round(Number(r.net) * 100) / 100,
      commission: Number(r.commission),
      swap: Number(r.swap),
      tags: tagsByTrade.get(r.id) ?? [],
    })),
  };
}

/**
 * Practice per setup: closed live trades and backtests, all time. Feeds the
 * setup confidence score (repetition builds confidence).
 */
export async function getSetupReps(userId: string, accountIds: string[]) {
  if (accountIds.length === 0) return [];
  const fx = sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;
  const rows = await db
    .select({
      setupId: setup.id,
      name: setup.name,
      live: sql<string>`count(*) filter (where not ${trade.isBacktest})`,
      liveWins: sql<string>`count(*) filter (where not ${trade.isBacktest} and ${trade.netPnl} > 0)`,
      liveNet: sql<string>`coalesce(sum(${trade.netPnl} * ${fx}) filter (where not ${trade.isBacktest}), 0)`,
      backtest: sql<string>`count(*) filter (where ${trade.isBacktest})`,
      backtestWins: sql<string>`count(*) filter (where ${trade.isBacktest} and ${trade.netPnl} > 0)`,
    })
    .from(setup)
    .innerJoin(trade, and(eq(trade.setupId, setup.id), eq(trade.status, "CLOSED"), inArray(trade.accountId, accountIds)))
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(eq(setup.userId, userId))
    .groupBy(setup.id, setup.name);
  return rows.map((r) => ({
    setupId: r.setupId,
    name: r.name,
    live: Number(r.live),
    liveWins: Number(r.liveWins),
    liveNet: Number(r.liveNet),
    backtest: Number(r.backtest),
    backtestWins: Number(r.backtestWins),
  }));
}

/** Average hold time of winners and losers, all time — the benchmark for open trades. */
export async function getHoldBenchmarks(userId: string, accountIds: string[]) {
  if (accountIds.length === 0) return { avgWinSec: null, avgLossSec: null };
  const dur = sql`coalesce(${trade.durationSec}, extract(epoch from ${trade.closeTime} - ${trade.openTime}))`;
  const [r] = await db
    .select({
      win: sql<string | null>`avg(${dur}) filter (where ${trade.netPnl} > 0)`,
      loss: sql<string | null>`avg(${dur}) filter (where ${trade.netPnl} < 0)`,
      n: sql<string>`count(*)`,
    })
    .from(trade)
    .where(and(eq(trade.userId, userId), inArray(trade.accountId, accountIds), eq(trade.status, "CLOSED"), eq(trade.isBacktest, false)));
  // Too few trades make a misleading benchmark.
  if (Number(r.n) < 10) return { avgWinSec: null, avgLossSec: null };
  return { avgWinSec: r.win == null ? null : Math.round(Number(r.win)), avgLossSec: r.loss == null ? null : Math.round(Number(r.loss)) };
}

/** Open trades in the selected accounts for the current data mode. */
export async function getOpenTradeCount(userId: string, accountIds: string[]) {
  if (accountIds.length === 0) return 0;
  const [r] = await db
    .select({ n: sql<string>`count(*)` })
    .from(trade)
    .where(and(eq(trade.userId, userId), inArray(trade.accountId, accountIds), eq(trade.status, "OPEN"), await currentBacktestCond()));
  return Number(r.n);
}

/**
 * Money the selected accounts started with, in the reporting currency: the
 * starting balance set on each account, else its deposits. Basis for
 * drawdown %. Null when unknown.
 */
export async function getCapitalBase(accountIds: string[]) {
  if (accountIds.length === 0) return null;
  const currency = await getReportingCurrency(accountIds);
  const fx = currency === "USC" ? sql`1` : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;
  const [r] = await db
    .select({
      base: sql<string | null>`sum(coalesce(${tradingAccount.initialBalance},
        (select sum(x.amount) from "transaction" x where x.account_id = "trading_account"."id" and x.type = 'DEPOSIT')) * ${fx})`,
    })
    .from(tradingAccount)
    .where(inArray(tradingAccount.id, accountIds));
  const n = Number(r?.base ?? 0);
  return n > 0 ? n : null;
}
