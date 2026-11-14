"use client";

import { motion } from "motion/react";
import { MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { formatGoalValue } from "@/components/goals/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GOAL_METRICS, PERIOD_LABEL, type GoalStatus } from "@/lib/goals";
import { cn } from "@/lib/utils";
import { deleteGoal, setGoalActive } from "@/server/actions/goals";
import type { GoalView } from "@/server/queries/goals";

const STATUS: Record<GoalStatus, { label: string; variant: "profit" | "loss" | "warning" | "default" | "brand" }> = {
  hit: { label: "Reached", variant: "profit" },
  in_progress: { label: "In progress", variant: "brand" },
  missed: { label: "Missed", variant: "loss" },
  ok: { label: "Within limit", variant: "profit" },
  warning: { label: "Close to limit", variant: "warning" },
  breached: { label: "Limit broken", variant: "loss" },
  idle: { label: "No trades yet", variant: "default" },
};

function barColor(status: GoalStatus, kind: "target" | "limit") {
  if (kind === "limit") return status === "breached" ? "var(--chart-down)" : status === "warning" ? "var(--warning)" : "var(--chart-up)";
  return status === "hit" ? "var(--chart-up)" : "var(--brand)";
}

export function GoalBoard({ goals }: { goals: GoalView[] }) {
  const [, start] = useTransition();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {goals.map((g, i) => {
        const meta = GOAL_METRICS[g.metric];
        const st = STATUS[g.current.status];
        const pct = Math.min(1, g.current.progress);
        const hitCount = g.history.filter((h) => h.traded && (meta.kind === "limit" ? h.status !== "breached" : h.status === "hit")).length;
        const tradedCount = g.history.filter((h) => h.traded).length;
        return (
          <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={cn("flex h-full flex-col p-5", !g.active && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold tracking-tight">
                    {PERIOD_LABEL[g.period]} {meta.label.toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.accountName} · {g.current.label}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {g.active ? <Badge variant={st.variant}>{st.label}</Badge> : <Badge>Paused</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Goal options">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => start(() => setGoalActive(g.id, !g.active))}>
                        {g.active ? <Pause /> : <Play />} {g.active ? "Pause" : "Resume"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-loss [&_svg]:!text-loss" onSelect={() => confirm("Delete this goal?") && start(() => deleteGoal(g.id))}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-semibold tracking-tight tabular">
                  {meta.kind === "limit" && meta.unit === "money" && g.current.value > 0 ? "−" : ""}
                  {formatGoalValue(g.metric, g.current.value, g.currency)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {meta.kind === "limit" ? "of" : "/"} {formatGoalValue(g.metric, g.target, g.currency)}
                  {meta.kind === "limit" ? " limit" : " target"}
                </span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${meta.label} progress`} aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: barColor(g.current.status, meta.kind) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {meta.kind === "limit"
                  ? g.current.status === "breached"
                    ? "Limit reached — stop trading for this period."
                    : `${formatGoalValue(g.metric, Math.max(0, g.target - g.current.value), g.currency)} left before the limit`
                  : g.current.status === "hit"
                    ? "Target reached 🎉"
                    : `${Math.round(Math.min(1, g.current.progress) * 100)}% of the way`}
              </p>

              <div className="mt-auto pt-5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Last {g.history.length} {g.period === "DAY" ? "days" : g.period === "WEEK" ? "weeks" : "months"}</span>
                  <span>
                    {tradedCount ? `${hitCount}/${tradedCount} ${meta.kind === "limit" ? "kept" : "reached"}` : "No history"}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1">
                  {[...g.history].reverse().map((h) => {
                    const good = meta.kind === "limit" ? h.status !== "breached" : h.status === "hit";
                    return (
                      <span
                        key={h.label}
                        title={`${h.label}: ${h.traded ? (good ? "✓" : "✗") : "no trades"}`}
                        className={cn("h-2 flex-1 rounded-full", !h.traded ? "bg-muted" : good ? "bg-chart-up" : "bg-chart-down")}
                      />
                    );
                  })}
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
