import "server-only";
import { isDay, todayIn, type WeekStart } from "@/lib/dates";
import { PERIODS, resolvePeriod, type Period } from "@/lib/periods";
import type { User } from "@/db/schema";
import { getAnalyticsTrades } from "./analytics";

type Params = Record<string, string | string[] | undefined>;

export async function loadReport(user: User, accountIds: string[], sp: Params) {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const period = (PERIODS.find((p) => p === one("period")) ?? "month") as Period;
  const today = todayIn(user.timezone);
  const anchor = isDay(one("d")) ? one("d")! : today;
  const resolved = resolvePeriod(period, anchor, (user.settings.weekStartsOn ?? 1) as WeekStart, {
    from: one("from"),
    to: one("to"),
  });
  const [cur, prev] = await Promise.all([
    getAnalyticsTrades(user.id, accountIds, resolved.from, resolved.to, user.timezone),
    getAnalyticsTrades(user.id, accountIds, resolved.prev.from, resolved.prev.to, user.timezone),
  ]);
  return { anchor, today, resolved, currency: cur.currency, trades: cur.trades, prevTrades: prev.trades };
}
