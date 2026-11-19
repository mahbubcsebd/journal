"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { tradingAccount } from "@/db/schema";
import { ACCOUNT_COLORS, EXNESS_ACCOUNT_TYPES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { SIGNED_OUT_URL } from "@/lib/auth-routes";

const accountSchema = z.object({
  nickname: z.string().trim().min(1, "Give this account a name").max(40),
  login: z.string().trim().regex(/^\d{5,12}$/, "MT5 login is a 5–12 digit number"),
  server: z.string().trim().min(3, "Enter the MT5 server, e.g. Exness-MT5Real8").max(60),
  accountType: z.enum(EXNESS_ACCOUNT_TYPES.map((t) => t.value) as [string, ...string[]]),
  environment: z.enum(["REAL", "DEMO"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default(ACCOUNT_COLORS[0]),
  initialBalance: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().nonnegative("Must be zero or more").nullable()),
});

export type AccountFormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: boolean };

async function userOrRedirect() {
  const u = await getCurrentUser();
  if (!u) redirect(SIGNED_OUT_URL);
  return u;
}

export async function saveAccount(_: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const u = await userOrRedirect();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const data = parsed.data;
  const values = {
    ...data,
    currency: data.accountType.includes("Cent") ? "USC" : "USD",
  };
  const id = formData.get("id");

  try {
    if (typeof id === "string" && id) {
      const res = await db
        .update(tradingAccount)
        .set(values)
        .where(and(eq(tradingAccount.id, id), eq(tradingAccount.userId, u.id)))
        .returning({ id: tradingAccount.id });
      if (res.length === 0) return { error: "Account not found" };
    } else {
      await db.insert(tradingAccount).values({ ...values, userId: u.id, syncMethod: "MANUAL", status: "PENDING" });
    }
  } catch (e) {
    if (e instanceof Error && /trading_account_login_uq/.test(String((e as { cause?: unknown }).cause ?? e.message))) {
      return { fieldErrors: { login: ["This login + server is already added"] } };
    }
    throw e;
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archiveAccount(id: string) {
  const u = await userOrRedirect();
  await db
    .update(tradingAccount)
    .set({ archived: true })
    .where(and(eq(tradingAccount.id, id), eq(tradingAccount.userId, u.id)));
  revalidatePath("/", "layout");
}

export async function deleteAccount(id: string) {
  const u = await userOrRedirect();
  await db.delete(tradingAccount).where(and(eq(tradingAccount.id, id), eq(tradingAccount.userId, u.id)));
  revalidatePath("/", "layout");
}

const renameSchema = z.object({ id: z.string().min(1), nickname: z.string().trim().min(1, "Give this account a name").max(40) });

/** Rename an account in place (from the account card). */
export async function renameAccount(id: string, nickname: string) {
  const u = await userOrRedirect();
  const data = renameSchema.safeParse({ id, nickname });
  if (!data.success) return { ok: false as const, error: data.error.issues[0]?.message ?? "Invalid name" };
  await db
    .update(tradingAccount)
    .set({ nickname: data.data.nickname })
    .where(and(eq(tradingAccount.id, data.data.id), eq(tradingAccount.userId, u.id)));
  revalidatePath("/", "layout");
  return { ok: true as const };
}
