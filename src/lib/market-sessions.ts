/**
 * Live forex session clock: Sydney, Tokyo, London and New York in their own
 * time zones (so daylight saving is handled), clipped to the weekly forex
 * week (Sunday 17:00 to Friday 17:00 New York time). Pure — pass `now`.
 */

export type MarketKey = "SYDNEY" | "TOKYO" | "LONDON" | "NEW_YORK";

export type Market = {
  key: MarketKey;
  name: string;
  city: string;
  tz: string;
  /** Local opening and closing hour (24h). */
  open: number;
  close: number;
  flag: string;
  /** Instruments that usually move most in this session. */
  pairs: string[];
  activity: "Low" | "Medium" | "High";
};

export const MARKETS: Market[] = [
  { key: "SYDNEY", name: "Sydney", city: "Sydney", tz: "Australia/Sydney", open: 7, close: 16, flag: "🇦🇺", pairs: ["AUDUSD", "NZDUSD", "AUDJPY"], activity: "Low" },
  { key: "TOKYO", name: "Tokyo", city: "Tokyo", tz: "Asia/Tokyo", open: 9, close: 18, flag: "🇯🇵", pairs: ["USDJPY", "AUDJPY", "XAUUSD"], activity: "Medium" },
  { key: "LONDON", name: "London", city: "London", tz: "Europe/London", open: 8, close: 17, flag: "🇬🇧", pairs: ["EURUSD", "GBPUSD", "XAUUSD", "EURGBP"], activity: "High" },
  { key: "NEW_YORK", name: "New York", city: "New York", tz: "America/New_York", open: 8, close: 17, flag: "🇺🇸", pairs: ["XAUUSD", "EURUSD", "USDJPY", "US30"], activity: "High" },
];

const H = 3_600_000;
const D = 24 * H;

/** Wall-clock parts of an instant in a time zone. */
function parts(ms: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    min: Number(p.minute),
    s: Number(p.second),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
  };
}

/** Offset of a zone from UTC at an instant, in ms (e.g. +6h for Dhaka). */
export function tzOffset(ms: number, tz: string) {
  const p = parts(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant of a local wall-clock time in a zone (DST-safe). */
export function zonedTime(y: number, m: number, d: number, hour: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, hour);
  let t = guess - tzOffset(guess, tz);
  // Second pass for days when the offset changes.
  t = guess - tzOffset(t, tz);
  return t;
}

/** Forex week: closed from Friday 17:00 to Sunday 17:00 New York time. */
export function forexWeek(now: number) {
  const ny = parts(now, "America/New_York");
  // Most recent Sunday (New York) as a calendar date.
  const sunday = new Date(Date.UTC(ny.y, ny.m - 1, ny.d - ny.weekday));
  const open = (dd: Date) => zonedTime(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate(), 17, "America/New_York");
  let weekOpen = open(sunday);
  let weekClose = open(new Date(sunday.getTime() + 5 * D));
  if (now >= weekClose) {
    // Friday evening or Saturday: the next week.
    const next = new Date(sunday.getTime() + 7 * D);
    weekOpen = open(next);
    weekClose = open(new Date(next.getTime() + 5 * D));
  }
  return { open: now >= weekOpen && now < weekClose, weekOpen, weekClose };
}

/** Session intervals of one market around `now` (yesterday to a week ahead), clipped to forex weeks. */
export function marketIntervals(m: Market, now: number, days = 8): [number, number][] {
  const out: [number, number][] = [];
  const local = parts(now, m.tz);
  for (let i = -1; i <= days; i++) {
    const day = new Date(Date.UTC(local.y, local.m - 1, local.d + i));
    const wd = day.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const y = day.getUTCFullYear();
    const mo = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    let s = zonedTime(y, mo, d, m.open, m.tz);
    let e = zonedTime(y, mo, d, m.close, m.tz);
    // Clip to the forex week the session belongs to (Monday Sydney starts before New York's Sunday open).
    const { weekOpen: wkStart, weekClose: wkEnd } = forexWeek(s);
    if (s < wkStart) s = wkStart;
    if (e > wkEnd && s < wkEnd) e = wkEnd;
    if (s >= e || s >= wkEnd || e <= wkStart) continue;
    out.push([s, e]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export type SessionStatus = Market & {
  isOpen: boolean;
  /** Current session if open, otherwise the next one. */
  start: number;
  end: number;
  /** ms until it closes (open) or opens (closed). */
  msToChange: number;
  /** 0–1 through the current session; 0 when closed. */
  progress: number;
};

export function sessionStatus(now: number): SessionStatus[] {
  return MARKETS.map((m) => {
    const iv = marketIntervals(m, now);
    const cur = iv.find(([s, e]) => now >= s && now < e);
    const next = iv.find(([s]) => s > now) ?? [now, now];
    const [start, end] = cur ?? next;
    return {
      ...m,
      isOpen: Boolean(cur),
      start,
      end,
      msToChange: cur ? end - now : start - now,
      progress: cur ? (now - start) / (end - start) : 0,
    };
  });
}

export const OVERLAPS: { a: MarketKey; b: MarketKey; name: string; note: string }[] = [
  { a: "LONDON", b: "NEW_YORK", name: "London–New York", note: "The busiest hours of the day: biggest volume and moves, especially gold and USD pairs." },
  { a: "TOKYO", b: "LONDON", name: "Tokyo–London", note: "A short hand-over; JPY and EUR crosses can move." },
  { a: "SYDNEY", b: "TOKYO", name: "Sydney–Tokyo", note: "Asian liquidity: AUD, NZD and JPY pairs." },
];

/** Overlaps open right now, with when they end. */
export function activeOverlaps(status: SessionStatus[]) {
  const by = Object.fromEntries(status.map((s) => [s.key, s])) as Record<MarketKey, SessionStatus>;
  return OVERLAPS.filter((o) => by[o.a].isOpen && by[o.b].isOpen).map((o) => ({ ...o, end: Math.min(by[o.a].end, by[o.b].end) }));
}

/** Summary for the header: open sessions and the next change anywhere. */
export function clockSummary(now: number) {
  const status = sessionStatus(now);
  const week = forexWeek(now);
  const open = status.filter((s) => s.isOpen);
  const nextOpen = status.filter((s) => !s.isOpen).sort((a, b) => a.msToChange - b.msToChange)[0];
  return { status, open, nextOpen, overlaps: activeOverlaps(status), weekOpen: week.open, weekReopens: week.weekOpen };
}

/** Bars for a 24-hour timeline starting at `dayStart` (the viewer's local midnight). */
export function timeline(dayStart: number) {
  const end = dayStart + D;
  return MARKETS.map((m) => ({
    key: m.key,
    name: m.name,
    flag: m.flag,
    bars: marketIntervals(m, dayStart - D, 3)
      .filter(([s, e]) => e > dayStart && s < end)
      .map(([s, e]) => ({ from: (Math.max(s, dayStart) - dayStart) / D, to: (Math.min(e, end) - dayStart) / D })),
  }));
}

/** Local midnight of the day containing `now` in a zone. */
export function localMidnight(now: number, tz: string) {
  const p = parts(now, tz);
  return zonedTime(p.y, p.m, p.d, 0, tz);
}
