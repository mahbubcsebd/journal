"use client";

import { motion } from "motion/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useActionState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { COMMON_TIMEZONES, CURRENCIES } from "@/lib/constants";
import { saveProfile, type ProfileState } from "@/server/actions/profile";

const noop = () => () => {};

export function OnboardingForm({ email, defaultName }: { email: string; defaultName: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const detectedTz = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "Asia/Dhaka",
  );
  const zones = COMMON_TIMEZONES.includes(detectedTz) ? COMMON_TIMEZONES : [detectedTz, ...COMMON_TIMEZONES];

  return (
    <motion.form
      action={action}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="grid gap-6 rounded-2xl border bg-card p-7 shadow-pop"
    >
      <input type="hidden" name="intent" value="onboarding" />
      <div className="grid gap-1.5">
        <p className="text-xs font-medium tracking-wide text-brand uppercase">Step 1 of 2</p>
        <h1 className="text-xl font-semibold tracking-tight">Let&apos;s set up your journal</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="text-foreground">{email}</span>
        </p>
      </div>

      <Field label="Your name" htmlFor="name" error={state.fieldErrors?.name?.[0]}>
        <Input id="name" name="name" defaultValue={defaultName} placeholder="Mahbub" autoFocus required />
      </Field>

      <Field
        label="Timezone"
        htmlFor="timezone"
        hint="Your trading days and calendar are grouped in this timezone."
        error={state.fieldErrors?.timezone?.[0]}
      >
        <Select id="timezone" name="timezone" defaultValue={detectedTz} key={detectedTz}>
          {zones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace("_", " ")}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Display currency" htmlFor="baseCurrency" error={state.fieldErrors?.baseCurrency?.[0]}>
        <Select id="baseCurrency" name="baseCurrency" defaultValue="USD">
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Continue
        {!pending && <ArrowRight />}
      </Button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">Next: add your Exness MT5 accounts</p>
    </motion.form>
  );
}
