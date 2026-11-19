import "server-only";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { trade, type User } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { GOAL_METRICS, PERIOD_LABEL } from "@/lib/goals";
import { DEFAULT_COOLDOWN_MINUTES, heatmap } from "@/lib/mindset";
import { preTradeCheck, type Lang, type PlannedTrade } from "@/lib/pretrade";
import { getUserAccounts } from "@/lib/session";
import { normalizeSymbol } from "@/lib/trading/symbols";
import { getAnalyticsTrades } from "@/server/queries/analytics";
import { getGoalsWithProgress } from "@/server/queries/goals";
import { getEvents, getNewsPrefs } from "@/server/queries/news";

/** Gather the trader's state and run the rule checks for one planned trade. */
export async function runPreTrade(user: User, accountId: string, planned: PlannedTrade, lang: Lang) {
  const tz = user.timezone;
  const accounts = await getUserAccounts(user.id);
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  if (!account) throw new Error("Add a trading account first.");
  const ids = [account.id];
  const now = Date.now();
  const today = todayIn(tz);
  const sym = normalizeSymbol(planned.symbol);

  const [history, todays, prefs, events, lastLoss, goals] = await Promise.all([
    getAnalyticsTrades(user.id, ids, undefined, today, tz),
    getAnalyticsTrades(user.id, ids, today, today, tz),
    getNewsPrefs(user),
    getEvents(new Date(now - 3_600_000), new Date(now + 4 * 3_600_000)).catch(() => []),
    db
      .select({ symbol: trade.symbol, net: trade.netPnl, closeTime: trade.closeTime })
      .from(trade)
      .where(and(eq(trade.accountId, account.id), eq(trade.status, "CLOSED"), eq(trade.isBacktest, false), lt(trade.netPnl, 0)))
      .orderBy(desc(trade.closeTime))
      .limit(1),
    getGoalsWithProgress(user, true).catch(() => []),
  ]);

  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(now));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")!.value);
  const hour = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  const heat = heatmap(history.trades);
  const mine = history.trades.filter((t) => normalizeSymbol(t.symbol) === sym);
  const decided = mine.filter((t) => t.net !== 0);
  const loss = lastLoss[0];

  const result = preTradeCheck(
    planned,
    {
      now,
      weekday,
      hour,
      balance: account.balance,
      currency: account.currency,
      cooldownMinutes: user.settings.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES,
      window: prefs.window,
      events: events.map((e) => ({ id: e.id, title: e.title, currency: e.currency, impact: e.impact, time: e.time.getTime(), allDay: e.allDay })),
      lastLoss: loss?.closeTime ? { symbol: loss.symbol, net: loss.net, closedAt: loss.closeTime.getTime() } : null,
      today: [...todays.trades].sort((a, b) => a.closeAt - b.closeAt).map((t) => ({ net: t.net })),
      openSameSymbol: (account.openPositions ?? []).filter((p) => normalizeSymbol(p.symbol) === sym).length,
      avoidZones: heat.avoid,
      bestZones: heat.best,
      symbolStats: mine.length
        ? { trades: mine.length, net: mine.reduce((s, t) => s + t.net, 0), winRate: decided.length ? decided.filter((t) => t.net > 0).length / decided.length : null }
        : null,
      limits: goals
        .filter((g) => GOAL_METRICS[g.metric].kind === "limit" && (!g.accountId || g.accountId === account.id))
        .map((g) => ({ label: `${GOAL_METRICS[g.metric].label} (${PERIOD_LABEL[g.period].toLowerCase()})`, status: g.current.status })),
    },
    lang,
  );
  return { ...result, account: { id: account.id, name: account.nickname, currency: account.currency, balance: account.balance } };
}
