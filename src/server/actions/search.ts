"use server";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { setup, trade, tradingAccount } from "@/db/schema";
import { getCurrentUser, getSelectedAccountIds } from "@/lib/session";

/** Quick search for the command palette: symbol, setup name or note text. */
export async function searchTrades(query: string) {
  const u = await getCurrentUser();
  if (!u) return [];
  const q = query.trim().slice(0, 40);
  if (q.length < 2) return [];
  const { ids } = await getSelectedAccountIds(u.id);
  if (ids.length === 0) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      status: trade.status,
      at: sql<string>`coalesce(${trade.closeTime}, ${trade.openTime})`,
      netPnl: trade.netPnl,
      currency: tradingAccount.currency,
      setupName: setup.name,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .leftJoin(setup, eq(setup.id, trade.setupId))
    .where(
      and(
        eq(trade.userId, u.id),
        inArray(trade.accountId, ids),
        or(ilike(trade.symbol, `${q.replace(/[%_\\]/g, "")}%`), ilike(setup.name, like), sql`${trade.notes}->>'text' ilike ${like}`),
      ),
    )
    .orderBy(desc(sql`coalesce(${trade.closeTime}, ${trade.openTime})`))
    .limit(8);
  return rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() }));
}
