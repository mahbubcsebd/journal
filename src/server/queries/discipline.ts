import "server-only";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { pretradeLog, trade, tradingAccount, type User } from "@/db/schema";
import { addDays } from "@/lib/dates";
import { disciplineSummary, scoreDays, scoreTrades } from "@/lib/discipline";
import { getGoalsWithProgress } from "@/server/queries/goals";
import { getEvents, getNewsPrefs } from "@/server/queries/news";
import { currentBacktestCond } from "./mode";

/** Day bounds in UTC, padded a little either side for time zones. */
const bounds = (from: string, to: string) => ({ start: new Date(Date.parse(`${from}T00:00:00Z`) - 14 * 3_600_000), end: new Date(Date.parse(`${to}T23:59:59Z`) + 14 * 3_600_000) });

/** Discipline per trade and per day for [from, to] (open day in the trader's time zone). */
export async function getDiscipline(user: User, accountIds: string[], from: string, to: string) {
  const tz = user.timezone;
  const { start, end } = bounds(from, to);
  const openDay = sql<string>`to_char(${trade.openTime} at time zone ${tz}, 'YYYY-MM-DD')`;
  const [rows, prefs, events, goals, checks] = await Promise.all([
    accountIds.length
      ? db
          .select({
            id: trade.id,
            symbol: trade.symbol,
            side: trade.side,
            day: openDay,
            openTime: trade.openTime,
            closeTime: trade.closeTime,
            net: trade.netPnl,
            sl: trade.sl,
            status: trade.status,
            currency: tradingAccount.currency,
          })
          .from(trade)
          .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
          .where(and(eq(trade.userId, user.id), inArray(trade.accountId, accountIds), gte(trade.openTime, start), lte(trade.openTime, end), await currentBacktestCond()))
      : Promise.resolve([]),
    getNewsPrefs(user),
    getEvents(new Date(start.getTime() - 3_600_000), new Date(end.getTime() + 3_600_000)).catch(() => []),
    getGoalsWithProgress(user, true).catch(() => []),
    db
      .select({ symbol: pretradeLog.symbol, side: pretradeLog.side, createdAt: pretradeLog.createdAt })
      .from(pretradeLog)
      .where(and(eq(pretradeLog.userId, user.id), eq(pretradeLog.verdict, "stop"), gte(pretradeLog.createdAt, new Date(start.getTime() - 3_600_000)), lte(pretradeLog.createdAt, end)))
      .catch(() => []),
  ]);
  const inRange = rows.filter((r) => r.day >= from && r.day <= to);
  const dayGoal = (metric: string) =>
    goals.filter((g) => g.metric === metric && g.period === "DAY" && (!g.accountId || accountIds.includes(g.accountId))).map((g) => g.target);
  const maxTrades = dayGoal("MAX_TRADES");
  const maxLoss = dayGoal("MAX_LOSS");
  const verdicts = scoreTrades(
    inRange.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      side: r.side,
      day: r.day,
      openAt: r.openTime.getTime(),
      closeAt: r.status === "CLOSED" && r.closeTime ? r.closeTime.getTime() : null,
      net: r.status === "CLOSED" ? r.net : null,
      sl: r.sl,
    })),
    {
      window: prefs.window,
      events: events.map((e) => ({ id: e.id, title: e.title, currency: e.currency, impact: e.impact, time: e.time, allDay: e.allDay })),
      cooldownMinutes: user.settings.cooldownMinutes,
      maxTradesPerDay: maxTrades.length ? Math.min(...maxTrades) : null,
      dailyMaxLoss: maxLoss.length ? Math.min(...maxLoss) : null,
      stopChecks: checks.map((c) => ({ symbol: c.symbol, side: c.side, at: c.createdAt.getTime() })),
    },
  );
  const days = scoreDays(verdicts);
  return { verdicts, days, summary: disciplineSummary(days), currency: rows[0]?.currency ?? user.baseCurrency };
}

/** Recent pre-trade checks with the trade that followed (same symbol and side within an hour), if any. */
export async function getPlanVsActual(userId: string, limit = 12) {
  const logs = await db.select().from(pretradeLog).where(eq(pretradeLog.userId, userId)).orderBy(desc(pretradeLog.createdAt)).limit(limit);
  if (!logs.length) return [];
  const oldest = logs[logs.length - 1].createdAt;
  const trades = await db
    .select({ id: trade.id, symbol: trade.symbol, side: trade.side, accountId: trade.accountId, openTime: trade.openTime, net: trade.netPnl, status: trade.status, sl: trade.sl, volume: trade.volume })
    .from(trade)
    .where(and(eq(trade.userId, userId), gte(trade.openTime, oldest), lte(trade.openTime, new Date(Date.now() + 60_000))));
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(M|C|PRO|ECN|RAW)$/, "");
  return logs.map((l) => {
    const t = trades
      .filter(
        (x) =>
          norm(x.symbol).startsWith(norm(l.symbol)) &&
          x.side === l.side &&
          (!l.accountId || x.accountId === l.accountId) &&
          x.openTime >= l.createdAt &&
          x.openTime.getTime() - l.createdAt.getTime() <= 60 * 60_000,
      )
      .sort((a, b) => a.openTime.getTime() - b.openTime.getTime())[0];
    return { log: l, trade: t ?? null };
  });
}

export const disciplineRange = (today: string, days = 30) => ({ from: addDays(today, -(days - 1)), to: today });
