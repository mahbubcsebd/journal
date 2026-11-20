import "server-only";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { trade, type User } from "@/db/schema";
import { GOAL_METRICS, PERIOD_LABEL } from "@/lib/goals";
import type { GuardRules } from "@/lib/guard";
import { DEFAULT_COOLDOWN_MINUTES } from "@/lib/mindset";
import { formatMoney } from "@/lib/utils";
import { getGoalsWithProgress } from "@/server/queries/goals";
import { getEvents, getNewsPrefs } from "@/server/queries/news";

/** Rules for one MT5 account right now: news windows (next 12h), cooldown, reached limits. */
export async function guardRules(u: User, account: { id: string; currency: string }): Promise<GuardRules> {
  const now = Date.now();
  const cooldownMin = u.settings.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  const [prefs, events, lastLoss, goals] = await Promise.all([
    getNewsPrefs(u),
    getEvents(new Date(now - 3 * 3_600_000), new Date(now + 12 * 3_600_000)).catch(() => []),
    cooldownMin
      ? db
          .select({ symbol: trade.symbol, net: trade.netPnl, closeTime: trade.closeTime })
          .from(trade)
          .where(and(eq(trade.userId, u.id), eq(trade.status, "CLOSED"), eq(trade.isBacktest, false), lt(trade.netPnl, 0)))
          .orderBy(desc(trade.closeTime))
          .limit(1)
      : Promise.resolve([]),
    getGoalsWithProgress(u, true).catch(() => []),
  ]);
  const w = prefs.window;
  const loss = lastLoss[0];
  const until = loss?.closeTime ? loss.closeTime.getTime() + cooldownMin * 60_000 : 0;
  return {
    alerts: u.settings.guardAlerts !== false,
    autoClose: u.settings.guardAutoClose === true,
    noSlSeconds: 60,
    cooldownUntil: until > now ? until : null,
    cooldownReason: until > now && loss ? `Loss ${formatMoney(loss.net, account.currency, { sign: true })} on ${loss.symbol}` : null,
    blocked: goals
      .filter((g) => GOAL_METRICS[g.metric].kind === "limit" && g.current.status === "breached" && (!g.accountId || g.accountId === account.id))
      .map((g) => `${PERIOD_LABEL[g.period]} ${GOAL_METRICS[g.metric].label.toLowerCase()} reached`),
    news: events
      .filter((e) => e.impact === "High" && !e.allDay)
      .map((e) => ({ start: e.time.getTime() - w.before * 60_000, end: e.time.getTime() + w.after * 60_000, currency: e.currency, title: e.title }))
      .filter((n) => n.end > now),
  };
}
