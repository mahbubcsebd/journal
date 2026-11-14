"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { sendWeeklyReportIfDue } from "@/server/services/notifications";
import { rebuildAllDailyStats } from "@/server/services/trades";

const isTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const profileSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  timezone: z.string().refine(isTimezone, "Unknown timezone"),
  baseCurrency: z.enum(["USD", "EUR", "GBP", "BDT", "INR", "AED", "JPY"]),
  weekStartsOn: z.enum(["0", "1", "6"]).optional(),
});

export type ProfileState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: boolean };

export async function saveProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const finishOnboarding = formData.get("intent") === "onboarding";
  const { weekStartsOn, ...profile } = parsed.data;
  await db
    .update(user)
    .set({
      ...profile,
      ...(weekStartsOn ? { settings: { ...current.settings, weekStartsOn: Number(weekStartsOn) as 0 | 1 | 6 } } : {}),
      ...(finishOnboarding ? { onboarded: true } : {}),
    })
    .where(eq(user.id, current.id));

  // Trading days are bucketed by timezone, so a change re-buckets every account.
  if (parsed.data.timezone !== current.timezone) await rebuildAllDailyStats(current.id);

  revalidatePath("/", "layout");
  if (finishOnboarding) redirect("/accounts?welcome=1");
  return { ok: true };
}

const notificationsSchema = z.object({
  emailWeeklyReport: z.boolean(),
  emailGoalAlerts: z.boolean(),
});

export async function saveNotificationSettings(input: z.infer<typeof notificationsSchema>) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const data = notificationsSchema.parse(input);
  await db.update(user).set({ settings: { ...current.settings, ...data } }).where(eq(user.id, current.id));
  revalidatePath("/settings");
}

/** Send last week's summary right now, ignoring the schedule (for checking email setup). */
export async function sendWeeklyReportNow(): Promise<{ ok: boolean; message: string }> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  try {
    const status = await sendWeeklyReportIfDue(current, { force: true });
    return status === "sent"
      ? { ok: true, message: `Sent to ${current.email}` }
      : { ok: false, message: "No closed trades last week, so there's nothing to report yet." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Couldn't send the email. Check the SMTP settings." };
  }
}
