"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { deleteObjects } from "@/lib/storage";
import { disconnectMetaApi } from "@/server/services/metaapi";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { trade, tradeImage, tradingAccount, user } from "@/db/schema";
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
const disciplineSchema = z.object({ cooldownMinutes: z.number().int().min(0).max(240) });

/** Cooldown after a losing trade (0 turns it off). */
export async function saveDisciplineSettings(input: z.infer<typeof disciplineSchema>) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const data = disciplineSchema.parse(input);
  await db.update(user).set({ settings: { ...current.settings, ...data } }).where(eq(user.id, current.id));
  revalidatePath("/", "layout");
}

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

/** Permanently delete the user and everything they own. Requires typing the account email. */
export async function deleteMyAccount(confirmEmail: string): Promise<{ error?: string }> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (confirmEmail.trim().toLowerCase() !== current.email.toLowerCase()) return { error: "The email doesn't match." };

  // Stop paid MetaApi terminals and remove stored screenshots before the rows disappear.
  const accounts = await db.select().from(tradingAccount).where(eq(tradingAccount.userId, current.id));
  for (const a of accounts) if (a.metaapiAccountId) await disconnectMetaApi(a).catch(() => {});
  const images = await db
    .select({ url: tradeImage.url })
    .from(tradeImage)
    .innerJoin(trade, eq(trade.id, tradeImage.tradeId))
    .where(eq(trade.userId, current.id));
  await deleteObjects(images.map((i) => i.url)).catch((e) => console.error("screenshot cleanup failed", e));

  // Cascades to sessions, accounts, trades, journal, notes, goals, keys, logs…
  await db.delete(user).where(eq(user.id, current.id));
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.includes("better-auth")) jar.delete(c.name);
  redirect("/?deleted=1");
}

/** Star or un-star an analytics chart for the Favorites tab. */
export async function toggleFavoriteChart(id: string) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const key = z.string().regex(/^[a-z0-9.-]{1,60}$/).parse(id);
  const now = current.settings.favoriteCharts ?? [];
  const next = now.includes(key) ? now.filter((x) => x !== key) : [...now, key].slice(-40);
  await db.update(user).set({ settings: { ...current.settings, favoriteCharts: next } }).where(eq(user.id, current.id));
  revalidatePath("/analytics");
  return next.includes(key);
}
