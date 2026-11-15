"use client";

import { Loader2, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { GOAL_METRICS, PERIOD_LABEL, type GoalMetric } from "@/lib/goals";
import { cn } from "@/lib/utils";
import { createGoal, type GoalFormState } from "@/server/actions/goals";

export function NewGoalDialog({ accounts }: { accounts: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
          <DialogDescription>Targets you aim for, or limits you never cross.</DialogDescription>
        </DialogHeader>
        {open && <GoalForm accounts={accounts} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({ accounts, onDone }: { accounts: { id: string; label: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<GoalFormState, FormData>(createGoal, {});
  const [metric, setMetric] = useState<GoalMetric>("MAX_LOSS");
  const meta = GOAL_METRICS[metric];
  const [period, setPeriod] = useState<string>("DAY");
  const validPeriod = meta.periods.includes(period as never) ? period : meta.periods[0];
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) {
      toast.success("Goal added");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="metric" value={metric} />
      <input type="hidden" name="period" value={validPeriod} />
      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Type</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(GOAL_METRICS) as GoalMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                metric === m ? "border-brand bg-brand-soft/60" : "hover:border-foreground/25",
              )}
            >
              <span className="block text-sm font-medium">{GOAL_METRICS[m].label}</span>
              <span className="block text-[11px] text-muted-foreground">{GOAL_METRICS[m].kind === "limit" ? "Limit" : "Target"}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Period</span>
        <div className="inline-flex w-fit rounded-lg border bg-card p-0.5">
          {meta.periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] font-medium transition",
                validPeriod === p ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        {err("period") && <p className="text-xs text-loss">{err("period")}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={meta.unit === "money" ? "Amount" : meta.unit === "percent" ? "Percent" : "Number"} htmlFor="target" hint={meta.hint} error={err("target")}>
          <Input id="target" name="target" type="number" step={meta.unit === "money" ? "0.01" : "1"} min="0" required placeholder={meta.unit === "money" ? "100" : meta.unit === "percent" ? "55" : "3"} />
        </Field>
        <Field label="Applies to" htmlFor="accountId" error={err("accountId")} hint="Cent amounts are converted to USD when combined.">
          <Combobox
            id="accountId"
            name="accountId"
            defaultValue="all"
            options={[{ value: "all", label: "All accounts" }, ...accounts.map((a) => ({ value: a.id, label: a.label }))]}
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Add goal
      </Button>
    </form>
  );
}
