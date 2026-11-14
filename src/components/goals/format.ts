import { GOAL_METRICS, type GoalMetric } from "@/lib/goals";
import { formatMoney } from "@/lib/utils";

export function formatGoalValue(metric: GoalMetric, value: number, currency: string) {
  const unit = GOAL_METRICS[metric].unit;
  if (unit === "money") return formatMoney(value, currency);
  if (unit === "percent") return `${Math.round(value)}%`;
  return String(Math.round(value));
}
