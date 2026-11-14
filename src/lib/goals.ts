import { addDays, addMonths, endOfMonth, formatDay, startOfMonth, startOfWeek, type WeekStart } from "./dates";
import type { DailyPoint } from "./stats";

export type GoalPeriod = "DAY" | "WEEK" | "MONTH";
export type GoalMetric = "NET_PNL" | "WIN_RATE" | "MAX_LOSS" | "MAX_TRADES" | "GREEN_DAYS";

export const GOAL_METRICS: Record<
  GoalMetric,
  { label: string; kind: "target" | "limit"; unit: "money" | "percent" | "count"; periods: GoalPeriod[]; hint: string }
> = {
  NET_PNL: { label: "Profit target", kind: "target", unit: "money", periods: ["DAY", "WEEK", "MONTH"], hint: "Net P&L to reach" },
  WIN_RATE: { label: "Win rate", kind: "target", unit: "percent", periods: ["WEEK", "MONTH"], hint: "Minimum win rate, in %" },
  GREEN_DAYS: { label: "Green days", kind: "target", unit: "count", periods: ["WEEK", "MONTH"], hint: "Number of profitable days" },
  MAX_LOSS: { label: "Max loss", kind: "limit", unit: "money", periods: ["DAY", "WEEK", "MONTH"], hint: "Stop trading once you lose this much" },
  MAX_TRADES: { label: "Max trades", kind: "limit", unit: "count", periods: ["DAY", "WEEK"], hint: "Most trades you allow yourself" },
};

export const PERIOD_LABEL: Record<GoalPeriod, string> = { DAY: "Daily", WEEK: "Weekly", MONTH: "Monthly" };

export function periodRange(period: GoalPeriod, day: string, weekStartsOn: WeekStart) {
  if (period === "DAY") return { from: day, to: day, label: formatDay(day, { weekday: "short", month: "short", day: "numeric" }) };
  if (period === "WEEK") {
    const from = startOfWeek(day, weekStartsOn);
    return { from, to: addDays(from, 6), label: `Week of ${formatDay(from, { month: "short", day: "numeric" })}` };
  }
  return { from: startOfMonth(day), to: endOfMonth(day), label: formatDay(day, { month: "long", year: "numeric" }) };
}

/** The n periods before the one containing `day`, most recent first. */
export function previousPeriods(period: GoalPeriod, day: string, weekStartsOn: WeekStart, n: number) {
  const out: ReturnType<typeof periodRange>[] = [];
  let anchor = day;
  for (let i = 0; i < n; i++) {
    anchor = period === "DAY" ? addDays(anchor, -1) : period === "WEEK" ? addDays(anchor, -7) : addMonths(anchor, -1);
    out.push(periodRange(period, anchor, weekStartsOn));
  }
  return out;
}

export type GoalStatus = "hit" | "in_progress" | "missed" | "ok" | "warning" | "breached" | "idle";

export type GoalEval = { value: number; progress: number; status: GoalStatus };

/**
 * Evaluate a goal over the days of one period. `finished` marks past periods,
 * where an unmet target counts as missed rather than in progress.
 */
export function evaluateGoal(metric: GoalMetric, target: number, days: DailyPoint[], finished = false): GoalEval {
  const traded = days.filter((d) => d.trades > 0);
  const net = traded.reduce((s, d) => s + d.net, 0);
  const trades = traded.reduce((s, d) => s + d.trades, 0);
  const wins = traded.reduce((s, d) => s + d.wins, 0);
  const losses = traded.reduce((s, d) => s + d.losses, 0);
  const t = Math.abs(target) || 1;

  switch (metric) {
    case "NET_PNL": {
      const status = net >= target ? "hit" : finished ? "missed" : traded.length ? "in_progress" : "idle";
      return { value: net, progress: Math.max(0, net / t), status };
    }
    case "WIN_RATE": {
      const wr = wins + losses ? (wins / (wins + losses)) * 100 : 0;
      if (wins + losses === 0) return { value: 0, progress: 0, status: finished ? "missed" : "idle" };
      return { value: wr, progress: wr / t, status: wr >= target ? "hit" : finished ? "missed" : "in_progress" };
    }
    case "GREEN_DAYS": {
      const green = traded.filter((d) => d.net > 0).length;
      return { value: green, progress: green / t, status: green >= target ? "hit" : finished ? "missed" : green ? "in_progress" : "idle" };
    }
    case "MAX_LOSS": {
      const loss = Math.max(0, -net);
      const used = loss / t;
      return { value: loss, progress: used, status: loss >= t ? "breached" : used >= 0.8 ? "warning" : "ok" };
    }
    case "MAX_TRADES": {
      const used = trades / t;
      return { value: trades, progress: used, status: trades > t ? "breached" : trades === t ? "warning" : used >= 0.8 ? "warning" : "ok" };
    }
  }
}
