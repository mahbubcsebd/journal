import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationLog, user as userTable, type User } from "@/db/schema";
import { groupBy, performance } from "@/lib/analytics";
import { addDays, formatDay, startOfWeek, todayIn, weekday, type WeekStart } from "@/lib/dates";
import { goalAlertEmail, weeklyReportEmail } from "@/lib/email-templates";
import { evaluateGoal, GOAL_METRICS, PERIOD_LABEL, periodRange } from "@/lib/goals";
import { sendMail } from "@/lib/mailer";
import { getUserAccounts } from "@/lib/session";
import { formatMoney, formatPercent } from "@/lib/utils";
import { getAnalyticsTrades } from "@/server/queries/analytics";
import { getDailyPnl } from "@/server/queries/calendar";
import { getGoalsWithProgress } from "@/server/queries/goals";
import { formatGoalValue } from "@/components/goals/format";
import { metaApiConfigured, staleMetaApiAccounts, syncMetaApiAccount } from "./metaapi";

/** Insert the log row first; only the caller that wins the insert sends the email. */
async function claim(userId: string, kind: string, key: string) {
  const rows = await db.insert(notificationLog).values({ userId, kind, key }).onConflictDoNothing().returning({ id: notificationLog.id });
  return rows.length > 0;
}

async function release(userId: string, kind: string, key: string) {
  await db.delete(notificationLog).where(and(eq(notificationLog.userId, userId), eq(notificationLog.kind, kind), eq(notificationLog.key, key)));
}

/** Build the weekly summary for the week that ended before `today`. Returns null if there were no trades. */
export async function buildWeeklyReport(user: User, today = todayIn(user.timezone)) {
  const ws = (user.settings.weekStartsOn ?? 1) as WeekStart;
  const from = addDays(startOfWeek(today, ws), -7);
  const to = addDays(from, 6);
  const accounts = await getUserAccounts(user.id);
  const ids = accounts.map((a) => a.id);
  const [{ trades, currency }, prev] = await Promise.all([
    getAnalyticsTrades(user.id, ids, from, to, user.timezone),
    getAnalyticsTrades(user.id, ids, addDays(from, -7), addDays(to, -7), user.timezone),
  ]);
  if (trades.length === 0) return null;
  const p = performance(trades);
  const byDay = new Map<string, number>();
  for (const t of trades) byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.net);
  const daysArr = [...byDay];
  const best = daysArr.reduce<[string, number] | null>((b, d) => (!b || d[1] > b[1] ? d : b), null);
  const worst = daysArr.reduce<[string, number] | null>((w, d) => (!w || d[1] < w[1] ? d : w), null);
  const top = groupBy(trades, (t) => t.symbol)[0];
  const money = (n: number) => formatMoney(n, currency, { sign: true });
  const pp = prev.trades.length ? performance(prev.trades) : null;

  const goals = (await getGoalsWithProgress(user, true)).filter((g) => g.period !== "MONTH");
  const goalLines: { label: string; ok: boolean }[] = [];
  for (const g of goals) {
    const meta = GOAL_METRICS[g.metric];
    if (g.period === "WEEK") {
      const { days } = await getDailyPnl(g.accountId ? [g.accountId] : ids, from, to);
      const ev = evaluateGoal(g.metric, g.target, days, true);
      goalLines.push({ label: `Weekly ${meta.label.toLowerCase()} (${formatGoalValue(g.metric, g.target, g.currency)})`, ok: meta.kind === "limit" ? ev.status !== "breached" : ev.status === "hit" });
    } else {
      const kept = g.history.filter((h) => h.label && h.traded).slice(0, 7);
      if (kept.length) {
        const good = kept.filter((h) => (meta.kind === "limit" ? h.status !== "breached" : h.status === "hit")).length;
        goalLines.push({ label: `Daily ${meta.label.toLowerCase()}: ${good}/${kept.length} days`, ok: good === kept.length });
      }
    }
  }

  return weeklyReportEmail({
    name: user.name.split(" ")[0] ?? "",
    weekLabel: `the week of ${formatDay(from, { month: "short", day: "numeric" })}`,
    reportUrlPath: `/reports?period=week&d=${from}`,
    net: money(p.net),
    netPositive: p.net >= 0,
    trades: p.trades,
    winRate: p.winRate == null ? "—" : formatPercent(p.winRate, 0),
    profitFactor: p.profitFactor == null ? "—" : p.profitFactor.toFixed(2),
    greenDays: `${daysArr.filter(([, v]) => v > 0).length} of ${daysArr.length}`,
    best: best && best[1] > 0 ? `${formatDay(best[0], { weekday: "short" })} ${money(best[1])}` : null,
    worst: worst && worst[1] < 0 ? `${formatDay(worst[0], { weekday: "short" })} ${money(worst[1])}` : null,
    topSymbol: top ? `${top.key} ${money(top.net)}` : null,
    vsPrevious: pp ? `${money(p.net - pp.net)} net, ${pp.winRate != null && p.winRate != null ? `${((p.winRate - pp.winRate) * 100).toFixed(0)} pts win rate` : ""}`.replace(/, $/, "") : null,
    goals: goalLines,
  });
}

/** Sends last week's summary on the first day of the user's week (once). */
export async function sendWeeklyReportIfDue(user: User, opts: { force?: boolean } = {}) {
  if (user.settings.emailWeeklyReport === false && !opts.force) return "disabled";
  const today = todayIn(user.timezone);
  const ws = (user.settings.weekStartsOn ?? 1) as WeekStart;
  if (!opts.force && weekday(today) !== ws) return "not-due";
  const key = startOfWeek(today, ws);
  if (!opts.force && !(await claim(user.id, "WEEKLY_REPORT", key))) return "already-sent";
  try {
    const email = await buildWeeklyReport(user, today);
    if (!email) return "no-trades";
    await sendMail({ to: user.email, ...email });
    return "sent";
  } catch (e) {
    if (!opts.force) await release(user.id, "WEEKLY_REPORT", key);
    throw e;
  }
}

/** Email each broken limit goal once per period. */
export async function sendGoalAlerts(user: User) {
  if (user.settings.emailGoalAlerts === false) return 0;
  const goals = await getGoalsWithProgress(user, true);
  let sent = 0;
  const ws = (user.settings.weekStartsOn ?? 1) as WeekStart;
  for (const g of goals) {
    if (g.current.status !== "breached") continue;
    const key = `${g.id}:${periodRange(g.period, todayIn(user.timezone), ws).from}`;
    if (!(await claim(user.id, "GOAL_ALERT", key))) continue;
    const meta = GOAL_METRICS[g.metric];
    try {
      await sendMail({
        to: user.email,
        ...goalAlertEmail({
          goalLabel: `${PERIOD_LABEL[g.period].toLowerCase()} ${meta.label.toLowerCase()}`,
          used: `${formatGoalValue(g.metric, g.current.value, g.currency)} of ${formatGoalValue(g.metric, g.target, g.currency)}`,
          periodLabel: g.current.label,
        }),
      });
      sent++;
    } catch (e) {
      await release(user.id, "GOAL_ALERT", key);
      throw e;
    }
  }
  return sent;
}

export async function runDailyNotifications() {
  const users = await db.select().from(userTable).where(eq(userTable.onboarded, true));
  const results = { users: users.length, weekly: 0, alerts: 0, errors: 0, synced: 0 };
  // Catch up MetaApi accounts first so reports and alerts use fresh data.
  if (metaApiConfigured()) {
    for (const a of await staleMetaApiAccounts(null, 60)) {
      try {
        results.synced += (await syncMetaApiAccount(a)).newDeals;
      } catch {
        results.errors++;
      }
    }
  }
  for (const u of users) {
    try {
      if ((await sendWeeklyReportIfDue(u)) === "sent") results.weekly++;
      results.alerts += await sendGoalAlerts(u);
    } catch (e) {
      results.errors++;
      console.error("notifications failed for user", u.id, e);
    }
  }
  return results;
}
