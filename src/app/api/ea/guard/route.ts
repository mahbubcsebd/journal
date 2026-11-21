import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { tradingAccount, user } from "@/db/schema";
import { guardText } from "@/lib/guard";
import { userForKey } from "@/lib/sync/keys";
import { guardRules } from "@/server/services/guard";

/**
 * Rules for the EA's discipline guard, as plain `key=value` lines.
 * Auth: `Authorization: Bearer <sync key>`; `?login=` picks the account.
 */
export async function GET(request: Request) {
  await connection();
  const key = await userForKey(request.headers.get("authorization"));
  if (!key) return new Response("error=Invalid or revoked sync key, or the Journal account is paused\n", { status: 401 });
  const login = new URL(request.url).searchParams.get("login") ?? "";
  const [u] = await db.select().from(user).where(eq(user.id, key.userId)).limit(1);
  if (!u) return new Response("error=No user\n", { status: 401 });
  const [account] = login
    ? await db
        .select({ id: tradingAccount.id, currency: tradingAccount.currency })
        .from(tradingAccount)
        .where(and(eq(tradingAccount.userId, u.id), eq(tradingAccount.login, login)))
        .limit(1)
    : [];
  const rules = await guardRules(u, account ?? { id: "", currency: u.baseCurrency });
  return new Response(guardText(rules, Date.now()), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
