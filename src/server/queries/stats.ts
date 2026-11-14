import "server-only";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyStat, tradingAccount } from "@/db/schema";

export type Summary = {
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  trades: number;
  wins: number;
  losses: number;
  tradingDays: number;
  greenDays: number;
};

/**
 * Money can only be summed in one currency. If every selected account is a
 * cent account we report in USC; otherwise USC amounts are converted to USD.
 */
export async function getReportingCurrency(accountIds: string[]) {
  if (accountIds.length === 0) return "USD";
  const rows = await db
    .selectDistinct({ currency: tradingAccount.currency })
    .from(tradingAccount)
    .where(inArray(tradingAccount.id, accountIds));
  return rows.length === 1 ? rows[0].currency : "USD";
}

/** Totals over pre-aggregated daily stats for the given accounts and date range. */
export async function getSummary(
  accountIds: string[],
  from?: string,
  to?: string,
): Promise<Summary & { currency: string }> {
  const currency = await getReportingCurrency(accountIds);
  const empty = { netPnl: 0, grossProfit: 0, grossLoss: 0, trades: 0, wins: 0, losses: 0, tradingDays: 0, greenDays: 0, currency };
  if (accountIds.length === 0) return empty;

  // USC → USD when mixing cent and dollar accounts.
  const fx =
    currency === "USC"
      ? sql`1`
      : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;

  const perDay = db
    .select({
      day: dailyStat.day,
      net: sql<number>`sum(${dailyStat.netPnl} * ${fx})`.as("net"),
      gp: sql<number>`sum(${dailyStat.grossProfit} * ${fx})`.as("gp"),
      gl: sql<number>`sum(${dailyStat.grossLoss} * ${fx})`.as("gl"),
      trades: sql<number>`sum(${dailyStat.trades})`.as("trades"),
      wins: sql<number>`sum(${dailyStat.wins})`.as("wins"),
      losses: sql<number>`sum(${dailyStat.losses})`.as("losses"),
    })
    .from(dailyStat)
    .innerJoin(tradingAccount, eq(tradingAccount.id, dailyStat.accountId))
    .where(
      and(
        inArray(dailyStat.accountId, accountIds),
        from ? gte(dailyStat.day, from) : undefined,
        to ? lte(dailyStat.day, to) : undefined,
      ),
    )
    .groupBy(dailyStat.day)
    .as("per_day");

  const [row] = await db
    .select({
      netPnl: sql<string>`coalesce(sum(${perDay.net}), 0)`,
      grossProfit: sql<string>`coalesce(sum(${perDay.gp}), 0)`,
      grossLoss: sql<string>`coalesce(sum(${perDay.gl}), 0)`,
      trades: sql<string>`coalesce(sum(${perDay.trades}), 0)`,
      wins: sql<string>`coalesce(sum(${perDay.wins}), 0)`,
      losses: sql<string>`coalesce(sum(${perDay.losses}), 0)`,
      tradingDays: sql<string>`count(*)`,
      greenDays: sql<string>`count(*) filter (where ${perDay.net} > 0)`,
    })
    .from(perDay);

  const totals = Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v ?? 0)])) as Summary;
  return { ...totals, currency };
}
