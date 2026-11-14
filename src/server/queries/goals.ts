import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { goal, type User } from "@/db/schema";
import { todayIn, type WeekStart } from "@/lib/dates";
import { evaluateGoal, periodRange, previousPeriods, type GoalEval } from "@/lib/goals";
import { getUserAccounts } from "@/lib/session";
import { getDailyPnl } from "./calendar";

const HISTORY = 8;

export type GoalView = Awaited<ReturnType<typeof getGoalsWithProgress>>[number];

/** Every goal with its current-period progress and the result of the previous periods. */
export async function getGoalsWithProgress(user: User, onlyActive = false) {
  const rows = await db.select().from(goal).where(eq(goal.userId, user.id)).orderBy(asc(goal.createdAt));
  const goals = onlyActive ? rows.filter((g) => g.active) : rows;
  if (goals.length === 0) return [];
  const accounts = await getUserAccounts(user.id);
  const today = todayIn(user.timezone);
  const ws = (user.settings.weekStartsOn ?? 1) as WeekStart;

  return Promise.all(
    goals.map(async (g) => {
      const ids = g.accountId ? [g.accountId] : accounts.map((a) => a.id);
      const current = periodRange(g.period, today, ws);
      const past = previousPeriods(g.period, today, ws, HISTORY);
      const { days, currency } = await getDailyPnl(ids, past.at(-1)!.from, current.to);
      const slice = (from: string, to: string) => days.filter((d) => d.day >= from && d.day <= to);
      const history: (GoalEval & { label: string; traded: boolean })[] = past.map((p) => {
        const ds = slice(p.from, p.to);
        return { ...evaluateGoal(g.metric, g.target, ds, true), label: p.label, traded: ds.some((d) => d.trades > 0) };
      });
      return {
        ...g,
        accountName: g.accountId ? (accounts.find((a) => a.id === g.accountId)?.nickname ?? "Account") : "All accounts",
        currency,
        period: g.period,
        current: { ...evaluateGoal(g.metric, g.target, slice(current.from, current.to)), label: current.label },
        history,
      };
    }),
  );
}
