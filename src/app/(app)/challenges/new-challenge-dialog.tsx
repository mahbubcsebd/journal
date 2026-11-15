"use client";

import { Loader2, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createChallenge, type ChallengeFormState } from "@/server/actions/challenges";

type Account = { id: string; label: string; balance: number | null };

const PRESETS = [
  { key: "p1", label: "Phase 1", target: 8, dd: 10, daily: 5, days: 4 },
  { key: "p2", label: "Phase 2", target: 5, dd: 10, daily: 5, days: 4 },
  { key: "custom", label: "Custom", target: null, dd: null, daily: null, days: null },
] as const;

export function NewChallengeDialog({ accounts, today }: { accounts: Account[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={accounts.length === 0} title={accounts.length === 0 ? "Add an account first" : undefined}>
          <Plus /> New challenge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New challenge</DialogTitle>
          <DialogDescription>Rules are checked against each day&apos;s closed P&amp;L on the chosen account.</DialogDescription>
        </DialogHeader>
        {open && <ChallengeForm accounts={accounts} today={today} />}
      </DialogContent>
    </Dialog>
  );
}

function ChallengeForm({ accounts, today }: { accounts: Account[]; today: string }) {
  const [state, action, pending] = useActionState<ChallengeFormState, FormData>(createChallenge, {});
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [balance, setBalance] = useState(String(accounts[0]?.balance ?? 10000));
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("p1");
  const p = PRESETS.find((x) => x.key === preset)!;
  const b = Number(balance) || 0;
  const pct = (x: number | null) => (x == null ? "" : String(Math.round(b * x) / 100));
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  // Re-key the money fields when the preset or balance changes so they take the new defaults.
  const k = `${preset}-${balance}`;

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={err("name")}>
          <Input id="name" name="name" defaultValue="Evaluation" required />
        </Field>
        <Field label="Account" htmlFor="accountId" error={err("accountId")}>
          <Combobox
            id="accountId"
            name="accountId"
            value={accountId}
            onValueChange={(id) => {
              setAccountId(id);
              const a = accounts.find((x) => x.id === id);
              if (a?.balance) setBalance(String(a.balance));
            }}
            options={accounts.map((a) => ({ value: a.id, label: a.label }))}
          />
        </Field>
      </div>
      <div className="grid gap-2">
        <span className="text-[13px] font-medium">Rules preset</span>
        <div className="inline-flex w-fit rounded-lg border bg-card p-0.5">
          {PRESETS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setPreset(x.key)}
              className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium", preset === x.key ? "bg-secondary" : "text-muted-foreground")}
            >
              {x.label}
              {x.target != null && <span className="ml-1 text-muted-foreground">{x.target}/{x.dd}/{x.daily}%</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starting balance" htmlFor="startBalance" error={err("startBalance")}>
          <Input id="startBalance" name="startBalance" type="number" step="0.01" min="0" value={balance} onChange={(e) => setBalance(e.target.value)} required />
        </Field>
        <Field label="Profit target" htmlFor="profitTarget" error={err("profitTarget")}>
          <Input key={`t${k}`} id="profitTarget" name="profitTarget" type="number" step="0.01" min="0" defaultValue={pct(p.target)} required />
        </Field>
        <Field label="Max drawdown" htmlFor="maxDrawdown" error={err("maxDrawdown")}>
          <Input key={`d${k}`} id="maxDrawdown" name="maxDrawdown" type="number" step="0.01" min="0" defaultValue={pct(p.dd)} required />
        </Field>
        <Field label="Max daily loss (optional)" htmlFor="maxDailyDrawdown" error={err("maxDailyDrawdown")}>
          <Input key={`dl${k}`} id="maxDailyDrawdown" name="maxDailyDrawdown" type="number" step="0.01" min="0" defaultValue={pct(p.daily)} />
        </Field>
        <Field label="Start date" htmlFor="startDate" error={err("startDate")}>
          <Input id="startDate" name="startDate" type="date" defaultValue={today} required />
        </Field>
        <Field label="End date (optional)" htmlFor="endDate" error={err("endDate")}>
          <Input id="endDate" name="endDate" type="date" />
        </Field>
        <Field label="Minimum trading days (optional)" htmlFor="minTradingDays" error={err("minTradingDays")}>
          <Input key={`m${k}`} id="minTradingDays" name="minTradingDays" type="number" min="0" step="1" defaultValue={p.days ?? ""} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="trailingDrawdown" className="size-4 accent-[var(--brand)]" />
          Trailing drawdown
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Start tracking
      </Button>
    </form>
  );
}
