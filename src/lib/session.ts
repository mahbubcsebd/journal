import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { tradingAccount, user } from "@/db/schema";
import { auth } from "./auth";

export const ACCOUNT_FILTER_COOKIE = "jr_accounts";

/** Validated session (or null). Deduped per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Fresh user row from the DB (session cookie cache may be a few minutes stale). */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const [row] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  return row ?? null;
});

/** For app pages: must be signed in and onboarded. */
export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (!current.onboarded) redirect("/onboarding");
  return current;
}

export const getUserAccounts = cache(async (userId: string) => {
  return db
    .select()
    .from(tradingAccount)
    .where(and(eq(tradingAccount.userId, userId), eq(tradingAccount.archived, false)))
    .orderBy(tradingAccount.createdAt);
});

/**
 * Accounts selected in the global account filter. Empty selection or "all"
 * means every (non-archived) account. Unknown ids are dropped, so a user can
 * never select another user's account through the cookie.
 */
export const getSelectedAccountIds = cache(async (userId: string) => {
  const raw = (await cookies()).get(ACCOUNT_FILTER_COOKIE)?.value;
  const accounts = await getUserAccounts(userId);
  const all = accounts.map((a) => a.id);
  if (!raw || raw === "all") return { ids: all, isAll: true };
  const wanted = raw.split(",").filter((id) => all.includes(id));
  if (wanted.length === 0) return { ids: all, isAll: true };
  // An explicit pick stays a pick (e.g. the only account, chosen on purpose),
  // so the switcher shows its name rather than "All accounts".
  return { ids: wanted, isAll: false };
});

export async function assertOwnsAccounts(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(and(eq(tradingAccount.userId, userId), inArray(tradingAccount.id, ids)));
  if (rows.length !== new Set(ids).size) throw new Error("Account not found");
}
