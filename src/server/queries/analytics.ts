import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { setup, tag, trade, tradeTag, tradingAccount } from "@/db/schema";
import type { ATrade } from "@/lib/analytics";
import { getReportingCurrency } from "./stats";

/** Closed live trades in a day range, flattened for the analytics engine. */
export async function getAnalyticsTrades(
  userId: string,
  accountIds: string[],
  from: string | undefined,
  to: string | undefined,
  tz: string,
): Promise<{ currency: string; trades: ATrade[] }> {
  const currency = await getReportingCurrency(accountIds);
  if (accountIds.length === 0) return { currency, trades: [] };
  const fx = currency === "USC" ? sql`1` : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;
  const closeDay = sql`(${trade.closeTime} at time zone ${tz})::date`;

  const rows = await db
    .select({
      id: trade.id,
      day: sql<string>`to_char(${trade.closeTime} at time zone ${tz}, 'YYYY-MM-DD')`,
      hour: sql<number>`extract(hour from ${trade.openTime} at time zone ${tz})::int`,
      weekday: sql<number>`extract(dow from ${trade.openTime} at time zone ${tz})::int`,
      symbol: trade.symbol,
      side: trade.side,
      session: trade.session,
      net: sql<string>`${trade.netPnl} * ${fx}`,
      commission: sql<string>`${trade.commission} * ${fx}`,
      swap: sql<string>`${trade.swap} * ${fx}`,
      volume: trade.volume,
      durationSec: trade.durationSec,
      rMultiple: trade.rMultiple,
      setup: setup.name,
      emotionBefore: trade.emotionBefore,
      followedPlan: trade.followedPlan,
      rating: trade.rating,
      accountName: tradingAccount.nickname,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .leftJoin(setup, eq(setup.id, trade.setupId))
    .where(
      and(
        eq(trade.userId, userId),
        inArray(trade.accountId, accountIds),
        eq(trade.status, "CLOSED"),
        eq(trade.isBacktest, false),
        from ? sql`${closeDay} >= ${from}::date` : undefined,
        to ? sql`${closeDay} <= ${to}::date` : undefined,
      ),
    )
    .orderBy(asc(trade.closeTime));

  const tagRows = rows.length
    ? await db
        .select({ tradeId: tradeTag.tradeId, name: tag.name, kind: tag.kind })
        .from(tradeTag)
        .innerJoin(tag, eq(tag.id, tradeTag.tagId))
        .where(inArray(tradeTag.tradeId, rows.map((r) => r.id)))
    : [];
  const tagsByTrade = new Map<string, ATrade["tags"]>();
  for (const t of tagRows) tagsByTrade.set(t.tradeId, [...(tagsByTrade.get(t.tradeId) ?? []), { name: t.name, kind: t.kind }]);

  return {
    currency,
    trades: rows.map((r) => ({
      ...r,
      net: Math.round(Number(r.net) * 100) / 100,
      commission: Number(r.commission),
      swap: Number(r.swap),
      tags: tagsByTrade.get(r.id) ?? [],
    })),
  };
}
