import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { challenge, tradingAccount, type User } from "@/db/schema";
import { evaluateChallenge } from "@/lib/challenge";
import { todayIn } from "@/lib/dates";
import { getDailyPnl } from "./calendar";

async function evaluate(c: typeof challenge.$inferSelect, today: string) {
  const { days, currency } = await getDailyPnl([c.accountId], c.startDate, c.endDate ?? today);
  return { currency, result: evaluateChallenge(c, days, today), days };
}

export async function listChallenges(user: User) {
  const today = todayIn(user.timezone);
  const rows = await db
    .select({ c: challenge, account: tradingAccount.nickname, color: tradingAccount.color })
    .from(challenge)
    .innerJoin(tradingAccount, eq(tradingAccount.id, challenge.accountId))
    .where(eq(challenge.userId, user.id))
    .orderBy(asc(challenge.createdAt));
  return Promise.all(rows.map(async (r) => ({ ...r.c, accountName: r.account, accountColor: r.color, ...(await evaluate(r.c, today)) })));
}

export async function getChallenge(user: User, id: string) {
  const [r] = await db
    .select({ c: challenge, account: tradingAccount.nickname, color: tradingAccount.color })
    .from(challenge)
    .innerJoin(tradingAccount, eq(tradingAccount.id, challenge.accountId))
    .where(and(eq(challenge.id, id), eq(challenge.userId, user.id)))
    .limit(1);
  if (!r) return null;
  return { ...r.c, accountName: r.account, accountColor: r.color, ...(await evaluate(r.c, todayIn(user.timezone))) };
}

export type ChallengeView = NonNullable<Awaited<ReturnType<typeof getChallenge>>>;
