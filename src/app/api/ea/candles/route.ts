import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { trade, tradeCandles, tradingAccount } from "@/db/schema";
import { candlePlan } from "@/lib/replay";
import { userForKey } from "@/lib/sync/keys";

async function account(request: Request, login: string) {
  const key = await userForKey(request.headers.get("authorization"));
  if (!key) return null;
  const [a] = await db
    .select({ id: tradingAccount.id, userId: tradingAccount.userId })
    .from(tradingAccount)
    .where(and(eq(tradingAccount.userId, key.userId), eq(tradingAccount.login, login)))
    .limit(1);
  return a ?? null;
}

/** Closed trades (last 60 days) still missing candles: `need=<position>|<symbol>|<from>|<to>|<tf minutes>`. */
export async function GET(request: Request) {
  await connection();
  const login = new URL(request.url).searchParams.get("login") ?? "";
  const a = await account(request, login);
  if (!a) return new Response("error=Unknown key or account\n", { status: 401 });
  const rows = await db
    .select({ positionId: trade.positionId, symbol: trade.symbol, openTime: trade.openTime, closeTime: trade.closeTime })
    .from(trade)
    .leftJoin(tradeCandles, eq(tradeCandles.tradeId, trade.id))
    .where(
      and(
        eq(trade.accountId, a.id),
        eq(trade.status, "CLOSED"),
        isNull(tradeCandles.tradeId),
        gte(trade.closeTime, new Date(Date.now() - 60 * 86_400_000)),
      ),
    )
    .orderBy(desc(trade.closeTime))
    .limit(3);
  const lines = rows
    .filter((r) => r.positionId && r.closeTime)
    .map((r) => {
      const p = candlePlan(r.openTime.getTime(), r.closeTime!.getTime());
      return `need=${r.positionId}|${r.symbol}|${p.from}|${p.to}|${p.tf}`;
    });
  return new Response([...lines, "end=1", ""].join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

const body = z.object({
  login: z.string().max(32),
  position: z.string().max(40),
  tf: z.number().int().min(1).max(1440),
  rates: z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()])).min(1).max(1000),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad candles" }, { status: 400 });
  const a = await account(request, parsed.data.login);
  if (!a) return Response.json({ error: "Unknown key or account" }, { status: 401 });
  const [t] = await db
    .select({ id: trade.id })
    .from(trade)
    .where(and(eq(trade.accountId, a.id), eq(trade.positionId, parsed.data.position)))
    .limit(1);
  if (!t) return Response.json({ error: "Trade not found" }, { status: 404 });
  const candles = parsed.data.rates.sort((x, y) => x[0] - y[0]).slice(-600);
  await db
    .insert(tradeCandles)
    .values({ tradeId: t.id, timeframe: parsed.data.tf, candles })
    .onConflictDoUpdate({ target: tradeCandles.tradeId, set: { timeframe: parsed.data.tf, candles, createdAt: new Date() } });
  return Response.json({ ok: true, stored: candles.length });
}
