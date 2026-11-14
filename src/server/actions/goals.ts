"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { goal, tradingAccount } from "@/db/schema";
import { GOAL_METRICS, type GoalMetric, type GoalPeriod } from "@/lib/goals";
import { getCurrentUser } from "@/lib/session";

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}

const schema = z
  .object({
    metric: z.enum(Object.keys(GOAL_METRICS) as [GoalMetric, ...GoalMetric[]]),
    period: z.enum(["DAY", "WEEK", "MONTH"]),
    target: z.coerce.number({ message: "Enter a number" }).positive("Must be more than 0").max(1e9),
    accountId: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!GOAL_METRICS[v.metric].periods.includes(v.period as GoalPeriod))
      ctx.addIssue({ code: "custom", path: ["period"], message: `${GOAL_METRICS[v.metric].label} can't be set per ${v.period.toLowerCase()}` });
    if (v.metric === "WIN_RATE" && v.target > 100) ctx.addIssue({ code: "custom", path: ["target"], message: "Win rate is at most 100%" });
    if ((v.metric === "MAX_TRADES" || v.metric === "GREEN_DAYS") && !Number.isInteger(v.target))
      ctx.addIssue({ code: "custom", path: ["target"], message: "Use a whole number" });
  });

export type GoalFormState = { fieldErrors?: Record<string, string[]>; ok?: boolean };

export async function createGoal(_: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const u = await me();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { accountId, ...v } = parsed.data;
  let account: string | null = null;
  if (accountId && accountId !== "all") {
    const [a] = await db.select({ id: tradingAccount.id }).from(tradingAccount).where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, u.id)));
    if (!a) return { fieldErrors: { accountId: ["Account not found"] } };
    account = a.id;
  }
  await db.insert(goal).values({ userId: u.id, accountId: account, ...v });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setGoalActive(id: string, active: boolean) {
  const u = await me();
  await db.update(goal).set({ active }).where(and(eq(goal.id, id), eq(goal.userId, u.id)));
  revalidatePath("/", "layout");
}

export async function deleteGoal(id: string) {
  const u = await me();
  await db.delete(goal).where(and(eq(goal.id, id), eq(goal.userId, u.id)));
  revalidatePath("/", "layout");
}
