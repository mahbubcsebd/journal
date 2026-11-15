"use server";

import { isDay } from "@/lib/dates";
import { getCurrentUser, getSelectedAccountIds } from "@/lib/session";
import { getClosedTrades, getDayTransactions, getOpenedTrades } from "@/server/queries/calendar";
import { getReportingCurrency } from "@/server/queries/stats";

/** Everything that happened on one day: closed trades, opened orders, balance operations. */
export async function getDayDetail(day: string) {
  const user = await getCurrentUser();
  if (!user || !isDay(day)) return null;
  const { ids } = await getSelectedAccountIds(user.id);
  const [trades, opened, transactions, currency] = await Promise.all([
    getClosedTrades(user.id, ids, day, day, user.timezone),
    getOpenedTrades(user.id, ids, day, user.timezone),
    getDayTransactions(ids, day, user.timezone),
    getReportingCurrency(ids),
  ]);
  return { day, currency, timezone: user.timezone, trades, opened, transactions };
}

export type DayDetailData = NonNullable<Awaited<ReturnType<typeof getDayDetail>>>;
