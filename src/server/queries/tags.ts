import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { tag, trade, tradeTag, tradingAccount } from "@/db/schema";
import { getReportingCurrency } from "./stats";

/** Every tag with how often it's used and what it earned on the selected accounts. */
export async function getTagStats(userId: string, accountIds: string[]) {
  const currency = await getReportingCurrency(accountIds);
  const fx = currency === "USC" ? sql`1` : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;
  const ids = accountIds.length ? accountIds : ["__none__"];
  const tags = await db.select().from(tag).where(eq(tag.userId, userId)).orderBy(tag.name);

  const linked = await db
    .select({
      tagId: tradeTag.tagId,
      trades: sql<string>`count(*)`,
      wins: sql<string>`count(*) filter (where ${trade.netPnl} > 0)`,
      net: sql<string>`coalesce(sum(${trade.netPnl} * ${fx}), 0)`,
    })
    .from(tradeTag)
    .innerJoin(trade, eq(trade.id, tradeTag.tradeId))
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(and(eq(trade.userId, userId), inArray(trade.accountId, ids), eq(trade.status, "CLOSED")))
    .groupBy(tradeTag.tagId);

  // Emotions live on the trade itself (before / after).
  const emotions = await db
    .select({
      tagId: tag.id,
      trades: sql<string>`count(${trade.id})`,
      wins: sql<string>`count(${trade.id}) filter (where ${trade.netPnl} > 0)`,
      net: sql<string>`coalesce(sum(${trade.netPnl} * ${fx}), 0)`,
    })
    .from(tag)
    .innerJoin(trade, or(eq(trade.emotionBefore, tag.name), eq(trade.emotionAfter, tag.name)))
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(
      and(eq(tag.userId, userId), eq(tag.kind, "EMOTION"), eq(trade.userId, userId), inArray(trade.accountId, ids), eq(trade.status, "CLOSED")),
    )
    .groupBy(tag.id);

  const stats = new Map([...linked, ...emotions].map((s) => [s.tagId, s]));
  return {
    currency,
    tags: tags.map((t) => {
      const s = stats.get(t.id);
      return { ...t, trades: Number(s?.trades ?? 0), wins: Number(s?.wins ?? 0), netPnl: Number(s?.net ?? 0) };
    }),
  };
}
