"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { challenge, tradingAccount } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

const money = (msg: string) => z.coerce.number({ message: msg }).positive(msg);
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? Number(v) : null))
  .pipe(z.number().nonnegative().nullable());

const schema = z
  .object({
    accountId: z.string().min(1, "Choose an account"),
    name: z.string().trim().min(1, "Give it a name").max(60),
    startBalance: money("Enter the starting balance"),
    profitTarget: money("Enter the profit target"),
    maxDrawdown: money("Enter the max drawdown"),
    maxDailyDrawdown: optional,
    minTradingDays: optional.pipe(z.number().int("Whole days only").nullable()),
    trailingDrawdown: z.string().optional().transform((v) => v === "on"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    endDate: z
      .string()
      .optional()
      .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "End must be after start" })
  .refine((v) => v.maxDrawdown < v.startBalance, { path: ["maxDrawdown"], message: "Must be less than the starting balance" });

export type ChallengeFormState = { fieldErrors?: Record<string, string[]> };

export async function createChallenge(_: ChallengeFormState, formData: FormData): Promise<ChallengeFormState> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const [acc] = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(and(eq(tradingAccount.id, parsed.data.accountId), eq(tradingAccount.userId, u.id)));
  if (!acc) return { fieldErrors: { accountId: ["Account not found"] } };
  const [row] = await db.insert(challenge).values({ userId: u.id, ...parsed.data }).returning({ id: challenge.id });
  revalidatePath("/challenges");
  redirect(`/challenges/${row.id}`);
}

export async function deleteChallenge(id: string) {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  await db.delete(challenge).where(and(eq(challenge.id, id), eq(challenge.userId, u.id)));
  revalidatePath("/challenges");
  redirect("/challenges");
}
