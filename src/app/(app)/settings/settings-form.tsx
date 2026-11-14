"use client";

import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useActionState, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { COMMON_TIMEZONES, CURRENCIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deleteMyAccount, saveNotificationSettings, saveProfile, sendWeeklyReportNow, type ProfileState } from "@/server/actions/profile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const noop = () => () => {};

export function SettingsForm(props: {
  email: string;
  name: string;
  timezone: string;
  baseCurrency: string;
  weekStartsOn: number;
  emailWeeklyReport: boolean;
  emailGoalAlerts: boolean;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const zones = COMMON_TIMEZONES.includes(props.timezone) ? COMMON_TIMEZONES : [props.timezone, ...COMMON_TIMEZONES];

  useEffect(() => {
    if (state.ok) toast.success("Settings saved");
  }, [state]);

  return (
    <div className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader className="flex-col gap-1">
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {props.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-4">
            <Field label="Name" htmlFor="name" error={state.fieldErrors?.name?.[0]}>
              <Input id="name" name="name" defaultValue={props.name} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Timezone" htmlFor="timezone" hint="Trading days are grouped in this timezone.">
                <Select id="timezone" name="timezone" defaultValue={props.timezone}>
                  {zones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Display currency" htmlFor="baseCurrency">
                <Select id="baseCurrency" name="baseCurrency" defaultValue={props.baseCurrency}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Week starts on" htmlFor="weekStartsOn" hint="Used by the calendar and weekly reports.">
              <Select id="weekStartsOn" name="weekStartsOn" defaultValue={String(props.weekStartsOn)} className="sm:w-1/2">
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
                <option value="6">Saturday</option>
              </Select>
            </Field>
            <Button type="submit" disabled={pending} className="w-fit">
              {pending && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
      <Notifications weekly={props.emailWeeklyReport} alerts={props.emailGoalAlerts} email={props.email} />
      <YourData email={props.email} />
      <Card>
        <CardHeader className="flex-col gap-1">
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose light, dark, or follow your device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-muted")}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
          className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-soft", checked ? "right-0.5" : "left-0.5")}
        />
      </button>
    </label>
  );
}

function Notifications({ weekly: w, alerts: a, email }: { weekly: boolean; alerts: boolean; email: string }) {
  const [weekly, setWeekly] = useState(w);
  const [alerts, setAlerts] = useState(a);
  const [pending, start] = useTransition();
  const save = (next: { emailWeeklyReport: boolean; emailGoalAlerts: boolean }) =>
    start(async () => {
      await saveNotificationSettings(next);
      toast.success("Notification settings saved");
    });
  return (
    <Card>
      <CardHeader className="flex-col gap-1">
        <CardTitle>Email notifications</CardTitle>
        <CardDescription>Sent to {email}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Toggle
          checked={weekly}
          onChange={(v) => {
            setWeekly(v);
            save({ emailWeeklyReport: v, emailGoalAlerts: alerts });
          }}
          label="Weekly summary"
          hint="Last week's P&L, win rate, best and worst day and goals — on the first day of your week."
        />
        <Toggle
          checked={alerts}
          onChange={(v) => {
            setAlerts(v);
            save({ emailWeeklyReport: weekly, emailGoalAlerts: v });
          }}
          label="Goal limit alerts"
          hint="An email when you break a max loss or max trades limit (once per period)."
        />
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await sendWeeklyReportNow();
                if (r.ok) toast.success(r.message);
                else toast.error(r.message);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            Send last week&apos;s summary now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function YourData({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader className="flex-col gap-1">
        <CardTitle>Your data</CardTitle>
        <CardDescription>Download everything you&apos;ve stored, or delete your account for good.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">Export all data</span>
            <span className="text-[13px] text-muted-foreground">Accounts, trades, deals, journal, notes, playbook, goals and AI reviews as JSON.</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href="/api/account/export">Download JSON</a>
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-loss/30 bg-loss-soft/40 p-4">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium text-loss">Delete account</span>
            <span className="text-[13px] text-muted-foreground">Removes every trade, note and setting, stops MetaApi sync and deletes screenshots. This can&apos;t be undone.</span>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  Everything in Journal will be permanently deleted. Your Exness accounts and MT5 history are not affected. Type <b>{email}</b> to confirm.
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  start(async () => {
                    const r = await deleteMyAccount(typed);
                    if (r?.error) setError(r.error);
                  });
                }}
              >
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} autoComplete="off" aria-label="Type your email to confirm" />
                {error && <p className="text-xs text-loss">{error}</p>}
                <Button type="submit" variant="destructive" disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}>
                  {pending && <Loader2 className="animate-spin" />}
                  Permanently delete
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition hover:bg-accent",
              active && "border-transparent",
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-active"
                className="absolute inset-0 rounded-xl ring-2 ring-brand"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            <o.icon className="size-5 text-muted-foreground" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
