import { Suspense } from "react";
import { GOAL_METRICS, PERIOD_LABEL } from "@/lib/goals";
import { getCurrentUser } from "@/lib/session";
import { getGoalsWithProgress } from "@/server/queries/goals";
import { formatGoalValue } from "./format";
import { GoalAlertBanner, type Alert } from "./goal-alert-banner";

/** In-app warnings shown above every page when a limit is close or broken, or a target is hit. */
export function GoalAlerts() {
  return (
    <Suspense>
      <Alerts />
    </Suspense>
  );
}

async function Alerts() {
  const user = await getCurrentUser();
  if (!user?.onboarded) return null;
  const goals = await getGoalsWithProgress(user, true);
  const alerts: Alert[] = [];
  for (const g of goals) {
    const meta = GOAL_METRICS[g.metric];
    const name = `${PERIOD_LABEL[g.period].toLowerCase()} ${meta.label.toLowerCase()}`;
    const used = `${formatGoalValue(g.metric, g.current.value, g.currency)} of ${formatGoalValue(g.metric, g.target, g.currency)}`;
    const id = `${g.id}:${g.current.label}:${g.current.status}`;
    if (g.current.status === "breached")
      alerts.push({ id, tone: "danger", text: `You've hit your ${name} (${used}). Step away — protect your account.` });
    else if (g.current.status === "warning")
      alerts.push({ id, tone: "warning", text: `Close to your ${name}: ${used} used.` });
    else if (g.current.status === "hit" && g.period === "DAY")
      alerts.push({ id, tone: "success", text: `Daily target reached (${used}). Consider calling it a day.` });
  }
  if (alerts.length === 0) return null;
  const order = { danger: 0, warning: 1, success: 2 };
  return <GoalAlertBanner alerts={alerts.sort((a, b) => order[a.tone] - order[b.tone])} />;
}
