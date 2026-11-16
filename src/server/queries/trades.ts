import "server-only";
import { and, asc, desc, eq, exists, gte, ilike, inArray, lt, lte, gt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { setup, tag, trade, tradeImage, tradeTag, tradingAccount } from "@/db/schema";
import type { TradeFilters } from "@/lib/trade-filters";
import { getReportingCurrency } from "./stats";

export const PAGE_SIZE = 50;

function where(userId: string, accountIds: string[], f: Omit<TradeFilters, "page" | "sort" | "dir">, tz: string) {
  const day = sql`(coalesce(${trade.closeTime}, ${trade.openTime}) at time zone ${tz})::date`;
  const conds: (SQL | undefined)[] = [
    eq(trade.userId, userId),
    inArray(trade.accountId, accountIds.length ? accountIds : ["__none__"]),
    f.symbol ? ilike(trade.symbol, `%${f.symbol}%`) : undefined,
    f.side ? eq(trade.side, f.side) : undefined,
    f.status ? eq(trade.status, f.status) : undefined,
    f.session ? eq(trade.session, f.session as never) : undefined,
    f.source ? eq(trade.source, f.source as never) : undefined,
    // Results only make sense for closed trades (an open one sits at 0).
    f.result ? eq(trade.status, "CLOSED") : undefined,
    f.result === "win" ? gt(trade.netPnl, 0) : undefined,
    f.result === "loss" ? lt(trade.netPnl, 0) : undefined,
    f.result === "be" ? eq(trade.netPnl, 0) : undefined,
    f.from ? gte(day, sql`${f.from}::date`) : undefined,
    f.to ? lte(day, sql`${f.to}::date`) : undefined,
    f.setup ? eq(trade.setupId, f.setup) : undefined,
    f.tag
      ? exists(
          db
            .select({ x: sql`1` })
            .from(tradeTag)
            .where(and(eq(tradeTag.tradeId, trade.id), eq(tradeTag.tagId, f.tag))),
        )
      : undefined,
  ];
  return and(...conds);
}

const ORDER = {
  date: sql`coalesce(${trade.closeTime}, ${trade.openTime})`,
  // Compare cent and dollar accounts on the same scale.
  pnl: sql`${trade.netPnl} * (case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`,
  volume: trade.volume,
  duration: trade.durationSec,
  r: trade.rMultiple,
};

export async function listTrades(userId: string, accountIds: string[], f: TradeFilters, tz: string, limit = PAGE_SIZE) {
  const w = where(userId, accountIds, f, tz);
  const orderCol = ORDER[f.sort];
  const order = f.dir === "asc" ? sql`${orderCol} asc nulls first` : sql`${orderCol} desc nulls last`;

  const rows = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      status: trade.status,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      volume: trade.volume,
      netPnl: trade.netPnl,
      pips: trade.pips,
      rMultiple: trade.rMultiple,
      durationSec: trade.durationSec,
      session: trade.session,
      rating: trade.rating,
      source: trade.source,
      isBacktest: trade.isBacktest,
      accountId: trade.accountId,
      accountName: tradingAccount.nickname,
      accountColor: tradingAccount.color,
      currency: tradingAccount.currency,
      setupName: setup.name,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .leftJoin(setup, eq(setup.id, trade.setupId))
    .where(w)
    .orderBy(order, desc(trade.id))
    .limit(limit)
    .offset((f.page - 1) * limit);

  const tags = rows.length
    ? await db
        .select({ tradeId: tradeTag.tradeId, id: tag.id, name: tag.name, color: tag.color, kind: tag.kind })
        .from(tradeTag)
        .innerJoin(tag, eq(tag.id, tradeTag.tagId))
        .where(inArray(tradeTag.tradeId, rows.map((r) => r.id)))
        .orderBy(asc(tag.name))
    : [];

  return rows.map((r) => ({ ...r, tags: tags.filter((t) => t.tradeId === r.id) }));
}

export type TradeRow = Awaited<ReturnType<typeof listTrades>>[number];

export async function summarizeTrades(userId: string, accountIds: string[], f: TradeFilters, tz: string) {
  const currency = await getReportingCurrency(accountIds);
  const fx = currency === "USC" ? sql`1` : sql`(case when ${tradingAccount.currency} = 'USC' then 0.01 else 1 end)`;
  const [row] = await db
    .select({
      total: sql<string>`count(*)`,
      closed: sql<string>`count(*) filter (where ${trade.status} = 'CLOSED')`,
      wins: sql<string>`count(*) filter (where ${trade.netPnl} > 0)`,
      losses: sql<string>`count(*) filter (where ${trade.netPnl} < 0)`,
      net: sql<string>`coalesce(sum(${trade.netPnl} * ${fx}) filter (where ${trade.status} = 'CLOSED'), 0)`,
      gp: sql<string>`coalesce(sum(${trade.netPnl} * ${fx}) filter (where ${trade.netPnl} > 0), 0)`,
      gl: sql<string>`coalesce(sum(${trade.netPnl} * ${fx}) filter (where ${trade.netPnl} < 0), 0)`,
      avgR: sql<string | null>`avg(${trade.rMultiple})`,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(where(userId, accountIds, f, tz));
  const n = (v: string | null) => Number(v ?? 0);
  return {
    currency,
    total: n(row.total),
    closed: n(row.closed),
    wins: n(row.wins),
    losses: n(row.losses),
    netPnl: n(row.net),
    grossProfit: n(row.gp),
    grossLoss: n(row.gl),
    avgR: row.avgR == null ? null : n(row.avgR),
  };
}

export async function getFilterOptions(userId: string) {
  const [symbols, tags, setups] = await Promise.all([
    db.selectDistinct({ symbol: trade.symbol }).from(trade).where(eq(trade.userId, userId)).orderBy(trade.symbol),
    db.select({ id: tag.id, name: tag.name, kind: tag.kind, color: tag.color }).from(tag).where(eq(tag.userId, userId)).orderBy(tag.kind, tag.name),
    db
      .select({ id: setup.id, name: setup.name, checklist: setup.checklist })
      .from(setup)
      .where(eq(setup.userId, userId))
      .orderBy(setup.name),
  ]);
  return { symbols: symbols.map((s) => s.symbol), tags, setups };
}

export async function getTrade(userId: string, id: string) {
  const [row] = await db
    .select({ trade, account: tradingAccount })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(and(eq(trade.id, id), eq(trade.userId, userId)))
    .limit(1);
  if (!row) return null;
  const [tags, images] = await Promise.all([
    db.select({ id: tradeTag.tagId }).from(tradeTag).where(eq(tradeTag.tradeId, id)),
    db
      .select({ id: tradeImage.id, caption: tradeImage.caption })
      .from(tradeImage)
      .where(eq(tradeImage.tradeId, id))
      .orderBy(asc(tradeImage.createdAt)),
  ]);
  return { ...row.trade, account: row.account, tagIds: tags.map((t) => t.id), images };
}

/** Previous / next trade by close time across the selected accounts. */
export async function getNeighbours(userId: string, accountIds: string[], at: Date, id: string) {
  const key = sql`coalesce(${trade.closeTime}, ${trade.openTime})`;
  const base = and(eq(trade.userId, userId), inArray(trade.accountId, accountIds.length ? accountIds : ["__none__"]));
  const [prev] = await db
    .select({ id: trade.id })
    .from(trade)
    .where(and(base, sql`(${key}, ${trade.id}) < (${at.toISOString()}::timestamptz, ${id})`))
    .orderBy(sql`${key} desc`, desc(trade.id))
    .limit(1);
  const [next] = await db
    .select({ id: trade.id })
    .from(trade)
    .where(and(base, sql`(${key}, ${trade.id}) > (${at.toISOString()}::timestamptz, ${id})`))
    .orderBy(sql`${key} asc`, asc(trade.id))
    .limit(1);
  return { prev: prev?.id ?? null, next: next?.id ?? null };
}
