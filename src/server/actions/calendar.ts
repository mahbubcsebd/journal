"use server";

import { isDay } from "@/lib/dates";
import { getCurrentUser, getSelectedAccountIds } from "@/lib/session";
import { getClosedTrades } from "@/server/queries/calendar";
import { getReportingCurrency } from "@/server/queries/stats";

export async function getDayDetail(day: string) {
  const user = await getCurrentUser();
  if (!user || !isDay(day)) return null;
  const { ids } = await getSelectedAccountIds(user.id);
  const [trades, currency] = await Promise.all([
    getClosedTrades(user.id, ids, day, day, user.timezone),
    getReportingCurrency(ids),
  ]);
  return { day, currency, timezone: user.timezone, trades };
}

export type DayDetailData = NonNullable<Awaited<ReturnType<typeof getDayDetail>>>;
