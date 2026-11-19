import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { trade, tradingAccount } from "@/db/schema";
import { DEFAULT_COOLDOWN_MINUTES, ZONE_MIN_TRADES } from "@/lib/mindset";

export type MindsetAlert =
  | { kind: "cooldown"; key: string; symbol: string; net: number; currency: string; closedAt: string; until: string }
  | { kind: "revenge"; key: string; symbol: string; minutesAfter: number; openedAt: string; count: number }
  | { kind: "avoid"; key: string; symbol: string; openedAt: string; weekday: number; hour: number; trades: number; net: number; currency: string };

const RECENT_HOURS = 3;

/**
 * Live nudges for the app shell, across all of the user's accounts:
 * an active cooldown after a loss, a trade opened during one (revenge), and a
 * trade opened in a day/hour where the trader historically loses.
 */
export async function getMindsetAlerts(userId: string, tz: string, cooldownSetting: number | undefined): Promise<MindsetAlert[]> {
  const cooldown = cooldownSetting ?? DEFAULT_COOLDOWN_MINUTES;
  const window = cooldown || DEFAULT_COOLDOWN_MINUTES;
  const now = Date.now();
  const accounts = db.select({ id: tradingAccount.id }).from(tradingAccount).where(and(eq(tradingAccount.userId, userId), eq(tradingAccount.archived, false)));
  const live = and(eq(trade.userId, userId), inArray(trade.accountId, accounts), eq(trade.isBacktest, false));

  const [lastLoss, recent] = await Promise.all([
    cooldown
      ? db
          .select({ symbol: trade.symbol, net: trade.netPnl, closeTime: trade.closeTime, currency: tradingAccount.currency })
          .from(trade)
          .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
          .where(and(live, eq(trade.status, "CLOSED"), lt(trade.netPnl, 0), gte(trade.closeTime, new Date(now - cooldown * 60_000))))
          .orderBy(desc(trade.closeTime))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: trade.id,
        symbol: trade.symbol,
        openTime: trade.openTime,
        weekday: sql<number>`extract(dow from ${trade.openTime} at time zone ${tz})::int`,
        hour: sql<number>`extract(hour from ${trade.openTime} at time zone ${tz})::int`,
        // Minutes since the latest losing trade that closed before this one opened, within the window.
        // Outer column written out in full: inside the subquery a bare "open_time" would mean l.open_time.
        afterLoss: sql<number | null>`(
          select extract(epoch from "trade"."open_time" - max(l.close_time)) / 60
          from ${trade} l
          where l.user_id = ${userId} and l.status = 'CLOSED' and l.net_pnl < 0 and not l.is_backtest
            and l.close_time <= "trade"."open_time" and l.close_time > "trade"."open_time" - make_interval(mins => ${window}::int)
        )`,
      })
      .from(trade)
      .where(and(live, gte(trade.openTime, new Date(now - RECENT_HOURS * 3_600_000))))
      .orderBy(desc(trade.openTime))
      .limit(5),
  ]);

  const alerts: MindsetAlert[] = [];
  const loss = lastLoss[0];
  if (loss?.closeTime) {
    alerts.push({
      kind: "cooldown",
      key: `cooldown-${loss.closeTime.getTime()}`,
      symbol: loss.symbol,
      net: loss.net,
      currency: loss.currency,
      closedAt: loss.closeTime.toISOString(),
      until: new Date(loss.closeTime.getTime() + cooldown * 60_000).toISOString(),
    });
  }
  // One banner per symbol and minute: several positions opened together are one decision.
  const revenge = new Map<string, Extract<MindsetAlert, { kind: "revenge" }>>();
  for (const r of recent) {
    if (r.afterLoss == null) continue;
    const minutesAfter = Math.max(0, Math.round(Number(r.afterLoss)));
    const k = `${r.symbol}-${minutesAfter}`;
    const seen = revenge.get(k);
    if (seen) seen.count++;
    else revenge.set(k, { kind: "revenge", key: `revenge-${r.id}`, symbol: r.symbol, minutesAfter, openedAt: r.openTime.toISOString(), count: 1 });
  }
  alerts.push(...revenge.values());

  // Avoid zones: the day/hour of each recent trade, judged on the last 180 days.
  const cells = [...new Map(recent.map((r) => [`${r.weekday}-${r.hour}`, r])).values()];
  if (cells.length) {
    const since = new Date(now - 180 * 86_400_000);
    const fx = sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;
    const stats = await db
      .select({
        weekday: sql<number>`extract(dow from ${trade.openTime} at time zone ${tz})::int`,
        hour: sql<number>`extract(hour from ${trade.openTime} at time zone ${tz})::int`,
        trades: sql<string>`count(*)`,
        net: sql<string>`sum(${trade.netPnl} * ${fx})`,
      })
      .from(trade)
      .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
      .where(and(live, eq(trade.status, "CLOSED"), gte(trade.openTime, since)))
      .groupBy(sql`1`, sql`2`);
    const bad = new Map(
      stats
        .filter((s) => Number(s.trades) >= ZONE_MIN_TRADES && Number(s.net) < 0)
        .map((s) => [`${s.weekday}-${s.hour}`, { trades: Number(s.trades), net: Math.round(Number(s.net) * 100) / 100 }]),
    );
    for (const r of cells) {
      const z = bad.get(`${r.weekday}-${r.hour}`);
      if (z) {
        alerts.push({
          kind: "avoid",
          key: `avoid-${r.id}`,
          symbol: r.symbol,
          openedAt: r.openTime.toISOString(),
          weekday: r.weekday,
          hour: r.hour,
          trades: z.trades,
          net: z.net,
          currency: "USD",
        });
      }
    }
  }
  return alerts;
}
