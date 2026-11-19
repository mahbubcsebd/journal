import "server-only";
import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { economicEvent, trade, tradingAccount, type User } from "@/db/schema";
import { DEFAULT_NEWS_AFTER, DEFAULT_NEWS_BEFORE, isRelevant, watchedCurrencies, type Impact } from "@/lib/news";

export async function getEvents(from: Date, to: Date) {
  return db
    .select()
    .from(economicEvent)
    .where(and(gte(economicEvent.time, from), lte(economicEvent.time, to)))
    .orderBy(asc(economicEvent.time), asc(economicEvent.currency));
}

export async function getEvent(id: string) {
  const [e] = await db.select().from(economicEvent).where(eq(economicEvent.id, id)).limit(1);
  return e ?? null;
}

/** A user's news preferences: impact floor, currencies (from settings or traded symbols), no-trade window. */
export async function getNewsPrefs(user: Pick<User, "id" | "settings">) {
  const rows = await db.selectDistinct({ symbol: trade.symbol }).from(trade).where(eq(trade.userId, user.id)).limit(200);
  const symbols = rows.map((r) => r.symbol);
  return {
    minImpact: (user.settings.newsImpact ?? "High") as Impact,
    currencies: watchedCurrencies(symbols, user.settings.newsCurrencies),
    window: { before: user.settings.newsBefore ?? DEFAULT_NEWS_BEFORE, after: user.settings.newsAfter ?? DEFAULT_NEWS_AFTER },
    symbols,
  };
}

/** Upcoming events that matter to this user (plus those still inside their after-window). */
export async function getUpcomingRelevant(user: Pick<User, "id" | "settings">, limit = 12) {
  const prefs = await getNewsPrefs(user);
  const now = Date.now();
  const events = await getEvents(new Date(now - prefs.window.after * 60_000), new Date(now + 8 * 86_400_000));
  const timed = events.filter((e) => !e.allDay);
  return {
    prefs,
    events: timed.filter((e) => isRelevant(e, prefs.minImpact, prefs.currencies)).slice(0, limit),
    /** The next high/medium releases in any currency, for when nothing matches the filter. */
    fallback: timed.filter((e) => isRelevant(e, "Medium", null)).slice(0, 3),
  };
}

/** Earlier releases of the same indicator (newest first). */
export async function getPastReleases(title: string, currency: string, before: Date, limit = 8) {
  return db
    .select({ id: economicEvent.id, time: economicEvent.time, actual: economicEvent.actual, forecast: economicEvent.forecast, previous: economicEvent.previous })
    .from(economicEvent)
    .where(and(eq(economicEvent.title, title), eq(economicEvent.currency, currency), lt(economicEvent.time, before)))
    .orderBy(desc(economicEvent.time))
    .limit(limit);
}

/** The user's trades opened inside a time window (for "your trades around this release"). */
export async function getTradesOpenedBetween(userId: string, from: Date, to: Date) {
  return db
    .select({ id: trade.id, symbol: trade.symbol, side: trade.side, openTime: trade.openTime, netPnl: trade.netPnl, status: trade.status, currency: tradingAccount.currency })
    .from(trade)
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(and(eq(trade.userId, userId), gte(trade.openTime, from), lte(trade.openTime, to)))
    .orderBy(asc(trade.openTime));
}
