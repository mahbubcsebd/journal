import "server-only";
import { and, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { economicEvent } from "@/db/schema";
import { parseFeed, type ParsedEvent } from "@/lib/news";

/**
 * Weekly economic calendar feeds (ForexFactory's public JSON). NEWS_FEED_URLS
 * (comma separated) overrides them, e.g. for a mirror or tests.
 */
const FEEDS = () =>
  (process.env.NEWS_FEED_URLS ||
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json,https://nfs.faireconomy.media/ff_calendar_nextweek.json")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** The provider asks clients not to poll often: refresh at most this often. */
const MAX_AGE_MIN = 60;

async function fetchFeed(url: string): Promise<ParsedEvent[]> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Journal trading journal (calendar sync)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  // "Next week" is not published early in the week.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return parseFeed(await res.json());
}

/** Pull the feeds and upsert events; events that vanished from the feed (rescheduled) are removed. */
export async function refreshCalendar() {
  const results = await Promise.allSettled(FEEDS().map(fetchFeed));
  const events = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const errors = results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
  if (events.length === 0) {
    console.error("[news] calendar refresh got no events", errors);
    return { ok: false as const, count: 0, error: errors[0] ?? "Feed returned no events" };
  }
  const unique = [...new Map(events.map((e) => [e.id, e])).values()];
  for (let i = 0; i < unique.length; i += 200) {
    await db
      .insert(economicEvent)
      .values(unique.slice(i, i + 200).map((e) => ({ ...e, updatedAt: new Date() })))
      .onConflictDoUpdate({
        target: economicEvent.id,
        set: {
          impact: sql`excluded.impact`,
          forecast: sql`excluded.forecast`,
          previous: sql`excluded.previous`,
          actual: sql`coalesce(excluded.actual, ${economicEvent.actual})`,
          allDay: sql`excluded.all_day`,
          updatedAt: new Date(),
        },
      });
  }
  // Rescheduled events get a new id; drop the old future copies inside the covered range.
  const times = unique.map((e) => e.time.getTime());
  await db
    .delete(economicEvent)
    .where(
      and(
        gte(economicEvent.time, new Date(Math.max(Date.now(), Math.min(...times)))),
        lte(economicEvent.time, new Date(Math.max(...times))),
        notInArray(
          economicEvent.id,
          unique.map((e) => e.id),
        ),
      ),
    );
  if (errors.length) console.warn("[news] some feeds failed", errors);
  return { ok: true as const, count: unique.length };
}

let inflight: Promise<unknown> | null = null;

/** Refresh when the newest row is older than MAX_AGE_MIN (one refresh at a time per instance). */
export async function ensureFreshCalendar(maxAgeMin = MAX_AGE_MIN) {
  const [r] = await db.select({ last: sql<Date | null>`max(${economicEvent.updatedAt})` }).from(economicEvent);
  const last = r?.last ? new Date(r.last).getTime() : 0;
  if (Date.now() - last < maxAgeMin * 60_000) return false;
  inflight ??= refreshCalendar()
    .catch((e) => console.error("[news] refresh failed", e))
    .finally(() => {
      inflight = null;
    });
  await inflight;
  return true;
}

export async function setEventAnalysis(id: string, lang: string, value: unknown) {
  await db
    .update(economicEvent)
    .set({ analysis: sql`coalesce(${economicEvent.analysis}, '{}'::jsonb) || ${JSON.stringify({ [lang]: value })}::jsonb` })
    .where(inArray(economicEvent.id, [id]));
}
