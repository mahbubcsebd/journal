import "server-only";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyStat, journalEntry, tradingAccount } from "@/db/schema";
import { getReportingCurrency } from "./stats";

export async function getJournalEntry(userId: string, day: string) {
  const [row] = await db
    .select()
    .from(journalEntry)
    .where(and(eq(journalEntry.userId, userId), eq(journalEntry.day, day)))
    .limit(1);
  return row ?? null;
}

export async function getJournalDays(userId: string, from: string, to: string) {
  const rows = await db
    .select({ day: journalEntry.day, mood: journalEntry.mood })
    .from(journalEntry)
    .where(and(eq(journalEntry.userId, userId), gte(journalEntry.day, from), lte(journalEntry.day, to)));
  return new Map(rows.map((r) => [r.day, r.mood]));
}

export async function listJournalEntries(userId: string, limit = 60) {
  return db.select().from(journalEntry).where(eq(journalEntry.userId, userId)).orderBy(desc(journalEntry.day)).limit(limit);
}

/** Net P&L per day for the selected accounts, in the reporting currency. */
export async function getDayNets(accountIds: string[], from: string, to: string) {
  const currency = await getReportingCurrency(accountIds);
  if (accountIds.length === 0) return { currency, nets: new Map<string, { net: number; trades: number }>() };
  const fx = currency === "USC" ? sql`1` : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;
  const rows = await db
    .select({ day: dailyStat.day, net: sql<string>`sum(${dailyStat.netPnl} * ${fx})`, trades: sql<string>`sum(${dailyStat.trades})` })
    .from(dailyStat)
    .innerJoin(tradingAccount, eq(tradingAccount.id, dailyStat.accountId))
    .where(and(inArray(dailyStat.accountId, accountIds), gte(dailyStat.day, from), lte(dailyStat.day, to)))
    .groupBy(dailyStat.day);
  return { currency, nets: new Map(rows.map((r) => [r.day, { net: Number(r.net), trades: Number(r.trades) }])) };
}
