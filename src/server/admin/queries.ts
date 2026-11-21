import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAudit,
  coachConversation,
  coachMessage,
  coachReport,
  pretradeLog,
  pushSubscription,
  session,
  syncKey,
  trade,
  tradingAccount,
  user,
} from "@/db/schema";

const DAY = 86_400_000;

export async function adminStats() {
  const since7 = new Date(Date.now() - 7 * DAY);
  const since1 = new Date(Date.now() - DAY);
  const [[u], [accounts], [trades], [ai]] = await Promise.all([
    db
      .select({
        total: count(),
        active7: sql<number>`count(*) filter (where ${user.lastSeenAt} >= ${since7.toISOString()})::int`,
        new7: sql<number>`count(*) filter (where ${user.createdAt} >= ${since7.toISOString()})::int`,
        paused: sql<number>`count(*) filter (where ${user.status} = 'paused')::int`,
        banned: sql<number>`count(*) filter (where ${user.status} = 'banned')::int`,
      })
      .from(user),
    db
      .select({
        total: count(),
        syncing: sql<number>`count(*) filter (where ${tradingAccount.lastSyncAt} >= ${new Date(Date.now() - 3_600_000).toISOString()})::int`,
      })
      .from(tradingAccount),
    db
      .select({ total: count(), day: sql<number>`count(*) filter (where ${trade.openTime} >= ${since1.toISOString()})::int` })
      .from(trade),
    db
      .select({ day: count() })
      .from(coachMessage)
      .where(and(eq(coachMessage.role, "user"), gte(coachMessage.createdAt, since1)))
      .catch(() => [{ day: 0 }]),
  ]);
  return { users: u, accounts, trades, aiMessages24h: ai.day };
}

export type UserSort = "joined" | "seen" | "trades" | "name";
export const PAGE_SIZE = 25;

export async function listUsers(opts: { q?: string; status?: string; sort?: UserSort; page?: number }) {
  const where: SQL[] = [];
  const q = opts.q?.trim();
  if (q) where.push(or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`))!);
  if (opts.status === "active" || opts.status === "paused" || opts.status === "banned") where.push(eq(user.status, opts.status));
  const accounts = sql<number>`(select count(*)::int from ${tradingAccount} a where a.user_id = "user"."id")`;
  const trades = sql<number>`(select count(*)::int from ${trade} t where t.user_id = "user"."id")`;
  const lastTrade = sql<Date | null>`(select max(t.open_time) from ${trade} t where t.user_id = "user"."id")`;
  const lastSync = sql<Date | null>`(select max(a.last_sync_at) from ${tradingAccount} a where a.user_id = "user"."id")`;
  const order =
    opts.sort === "seen"
      ? [sql`${user.lastSeenAt} desc nulls last`]
      : opts.sort === "trades"
        ? [desc(trades)]
        : opts.sort === "name"
          ? [asc(user.email)]
          : [desc(user.createdAt)];
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        statusUntil: user.statusUntil,
        statusReason: user.statusReason,
        onboarded: user.onboarded,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
        accounts,
        trades,
        lastTrade,
        lastSync,
      })
      .from(user)
      .where(where.length ? and(...where) : undefined)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(user).where(where.length ? and(...where) : undefined),
  ]);
  return { rows, total: n, page, pages: Math.max(1, Math.ceil(n / PAGE_SIZE)) };
}

export async function userDetail(id: string) {
  const [u] = await db.select().from(user).where(eq(user.id, id)).limit(1);
  if (!u) return null;
  const since30 = new Date(Date.now() - 30 * DAY);
  const mine = db.select({ id: coachConversation.id }).from(coachConversation).where(eq(coachConversation.userId, id));
  const [accounts, tradeStats, sessions, keys, recent, audit, usage] = await Promise.all([
    db.select().from(tradingAccount).where(eq(tradingAccount.userId, id)).orderBy(asc(tradingAccount.createdAt)),
    db
      .select({
        accountId: trade.accountId,
        trades: count(),
        closed: sql<number>`count(*) filter (where ${trade.status} = 'CLOSED')::int`,
        net: sql<number>`coalesce(sum(${trade.netPnl}) filter (where ${trade.status} = 'CLOSED' and not ${trade.isBacktest}), 0)::float`,
        first: sql<Date | null>`min(${trade.openTime})`,
        last: sql<Date | null>`max(${trade.openTime})`,
      })
      .from(trade)
      .where(eq(trade.userId, id))
      .groupBy(trade.accountId),
    db
      .select({ id: session.id, createdAt: session.createdAt, updatedAt: session.updatedAt, expiresAt: session.expiresAt, ip: session.ipAddress, ua: session.userAgent })
      .from(session)
      .where(and(eq(session.userId, id), gte(session.expiresAt, new Date())))
      .orderBy(desc(session.updatedAt)),
    db.select().from(syncKey).where(eq(syncKey.userId, id)).orderBy(desc(syncKey.createdAt)),
    db
      .select({ id: trade.id, symbol: trade.symbol, side: trade.side, openTime: trade.openTime, net: trade.netPnl, status: trade.status, accountId: trade.accountId })
      .from(trade)
      .where(eq(trade.userId, id))
      .orderBy(desc(trade.openTime))
      .limit(10),
    db.select().from(adminAudit).where(eq(adminAudit.targetUserId, id)).orderBy(desc(adminAudit.createdAt)).limit(30),
    Promise.all([
      db.select({ n: count() }).from(coachMessage).where(and(inArray(coachMessage.conversationId, mine), eq(coachMessage.role, "user"), gte(coachMessage.createdAt, since30))).catch(() => [{ n: 0 }]),
      db.select({ n: count() }).from(coachReport).where(eq(coachReport.userId, id)).catch(() => [{ n: 0 }]),
      db.select({ n: count() }).from(pretradeLog).where(and(eq(pretradeLog.userId, id), gte(pretradeLog.createdAt, since30))).catch(() => [{ n: 0 }]),
      db.select({ n: count() }).from(pushSubscription).where(eq(pushSubscription.userId, id)).catch(() => [{ n: 0 }]),
    ]),
  ]);
  return {
    user: u,
    accounts: accounts.map((a) => ({ ...a, stats: tradeStats.find((t) => t.accountId === a.id) ?? null })),
    sessions,
    keys,
    recent,
    audit,
    usage: {
      coachMessages30d: usage[0][0].n,
      reviews: usage[1][0].n,
      preTradeChecks30d: usage[2][0].n,
      pushDevices: usage[3][0].n,
      telegram: Boolean(u.settings.telegramChatId),
    },
  };
}

export async function recentAudit(limit = 20) {
  return db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(limit);
}
