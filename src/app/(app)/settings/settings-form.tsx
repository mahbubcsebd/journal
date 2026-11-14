"use client";

import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useActionState, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { COMMON_TIMEZONES, CURRENCIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { saveProfile, type ProfileState } from "@/server/actions/profile";

const noop = () => () => {};

export function SettingsForm(props: {
  email: string;
  name: string;
  timezone: string;
  baseCurrency: string;
  weekStartsOn: number;
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
