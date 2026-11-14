"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
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
});

export type ProfileState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: boolean };

export async function saveProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const finishOnboarding = formData.get("intent") === "onboarding";
  await db
    .update(user)
    .set({ ...parsed.data, ...(finishOnboarding ? { onboarded: true } : {}) })
    .where(eq(user.id, current.id));

  // Trading days are bucketed by timezone, so a change re-buckets every account.
  if (parsed.data.timezone !== current.timezone) await rebuildAllDailyStats(current.id);

  revalidatePath("/", "layout");
  if (finishOnboarding) redirect("/accounts?welcome=1");
  return { ok: true };
}
