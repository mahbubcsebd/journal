/**
 * Economic calendar logic: parse the weekly feed, decide which events matter
 * for the symbols a trader uses, and find trades opened in a news window.
 * Pure functions — no I/O.
 */
import { z } from "zod";
import type { ATrade } from "./analytics";

export const IMPACTS = ["High", "Medium", "Low"] as const;
export type Impact = (typeof IMPACTS)[number] | "Holiday";

/** No-trade window around high-impact news, minutes. A common prop-firm/journal rule. */
export const DEFAULT_NEWS_BEFORE = 15;
export const DEFAULT_NEWS_AFTER = 15;

export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "CNY"] as const;

export const CURRENCY_FLAG: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  CNY: "🇨🇳",
};

export type ParsedEvent = {
  id: string;
  title: string;
  currency: string;
  impact: Impact;
  time: Date;
  allDay: boolean;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

const feedItem = z.object({
  title: z.string().trim().min(1).max(200),
  country: z.string().trim().min(2).max(8),
  date: z.string().min(10),
  impact: z.string().optional().default("Low"),
  forecast: z.string().optional().nullable(),
  previous: z.string().optional().nullable(),
  actual: z.string().optional().nullable(),
});

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/** Stable id: same event at the same time → same row. */
export const eventId = (title: string, currency: string, time: Date) =>
  `${currency.toLowerCase()}-${time.toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${slug(title)}`;

const normImpact = (v: string): Impact => {
  const s = v.toLowerCase();
  if (s.startsWith("high")) return "High";
  if (s.startsWith("med")) return "Medium";
  if (s.startsWith("hol") || s.startsWith("non")) return "Holiday";
  return "Low";
};
const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** ForexFactory-style weekly JSON → events. Bad rows are skipped, not fatal. */
export function parseFeed(raw: unknown): ParsedEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedEvent[] = [];
  for (const row of raw) {
    const r = feedItem.safeParse(row);
    if (!r.success) continue;
    const time = new Date(r.data.date);
    if (Number.isNaN(time.getTime())) continue;
    const impact = normImpact(r.data.impact);
    const currency = r.data.country.toUpperCase();
    out.push({
      id: eventId(r.data.title, currency, time),
      title: r.data.title,
      currency,
      impact,
      time,
      // Holidays and "All Day" rows are dated at midnight with no real release time.
      allDay: impact === "Holiday",
      forecast: blank(r.data.forecast),
      previous: blank(r.data.previous),
      actual: blank(r.data.actual),
    });
  }
  return out;
}

const INDEX_CURRENCY: [RegExp, string][] = [
  [/^(US30|US100|US500|NAS|SPX|SP500|DJ|DOW|USTEC|USOIL|XTI|WTI|UKOIL|XBR|BRENT|XNG|NGAS)/, "USD"],
  [/^(DE30|DE40|GER|DAX|EU50|STOXX|FRA|FR40|ES35|IT40)/, "EUR"],
  [/^(UK100|FTSE)/, "GBP"],
  [/^(JP225|JPN|NIKKEI)/, "JPY"],
  [/^(AUS200|ASX)/, "AUD"],
  [/^(HK50|HSI|CHINA|CN50)/, "CNY"],
];

/** Currencies whose news moves a symbol: XAUUSD → USD, EURJPY → EUR + JPY, US30 → USD. */
export function currenciesForSymbol(symbol: string): string[] {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const [re, cur] of INDEX_CURRENCY) if (re.test(s)) return [cur];
  const known = CURRENCIES as readonly string[];
  const a = s.slice(0, 3);
  const b = s.slice(3, 6);
  const out = new Set<string>();
  // Metals and crypto are quoted in a currency; their own "code" has no news.
  if (known.includes(a)) out.add(a);
  if (known.includes(b)) out.add(b);
  if (out.size === 0 && /^(XAU|XAG|XPT|XPD|BTC|ETH|LTC|XRP|SOL|BNB|ADA|DOGE)/.test(s)) out.add("USD");
  return [...out];
}

/** Currencies to watch for a set of traded symbols (USD always, it moves everything). */
export function watchedCurrencies(symbols: string[], setting?: string[]) {
  if (setting?.includes("ALL")) return null; // every currency
  if (setting && setting.length) return new Set(setting);
  return new Set(["USD", ...symbols.flatMap(currenciesForSymbol)]);
}

export const impactRank = (i: string) => (i === "High" ? 3 : i === "Medium" ? 2 : i === "Low" ? 1 : 0);

export function isRelevant(e: { impact: string; currency: string }, minImpact: Impact, currencies: Set<string> | null) {
  return impactRank(e.impact) >= impactRank(minImpact) && (!currencies || currencies.has(e.currency));
}

export type NewsWindow = { before: number; after: number };

/** Trades opened inside the window of a high-impact event for one of the symbol's currencies. */
export function newsTrades(
  trades: ATrade[],
  events: { id: string; title: string; currency: string; impact: string; time: Date | string; allDay?: boolean }[],
  w: NewsWindow = { before: DEFAULT_NEWS_BEFORE, after: DEFAULT_NEWS_AFTER },
) {
  const high = events
    .filter((e) => e.impact === "High" && !e.allDay)
    .map((e) => ({ ...e, at: new Date(e.time).getTime() }))
    .sort((a, b) => a.at - b.at);
  const hits: { trade: ATrade; event: (typeof high)[number]; minutes: number }[] = [];
  for (const t of trades) {
    const curs = new Set(currenciesForSymbol(t.symbol));
    const e = high.find((x) => curs.has(x.currency) && t.openAt >= x.at - w.before * 60_000 && t.openAt <= x.at + w.after * 60_000);
    if (e) hits.push({ trade: t, event: e, minutes: Math.round((t.openAt - e.at) / 60_000) });
  }
  return hits;
}

/** "2d 3h", "2h 14m", "14:05" (under an hour, mm:ss). */
export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export type CountdownEvent = {
  id: string;
  title: string;
  currency: string;
  impact: string;
  time: string;
  forecast?: string | null;
  previous?: string | null;
  actual?: string | null;
};

/** The event to show now: one inside its no-trade window, else the next upcoming one. */
export function pickCountdown(events: CountdownEvent[], now: number, w: NewsWindow) {
  const sorted = [...events].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const live = sorted.find((e) => {
    const t = Date.parse(e.time);
    return e.impact === "High" && now >= t - w.before * 60_000 && now <= t + w.after * 60_000;
  });
  if (live) return { event: live, phase: (now < Date.parse(live.time) ? "before" : "after") as "before" | "after", ms: Date.parse(live.time) - now };
  const next = sorted.find((e) => Date.parse(e.time) > now);
  return next ? { event: next, phase: "upcoming" as const, ms: Date.parse(next.time) - now } : null;
}

/** Impact colours (tokens), shared by server and client components. */
export const IMPACT_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  High: { dot: "bg-loss", label: "High", text: "text-loss" },
  Medium: { dot: "bg-warning", label: "Medium", text: "text-warning-ink" },
  Low: { dot: "bg-muted-foreground/50", label: "Low", text: "text-muted-foreground" },
  Holiday: { dot: "bg-brand", label: "Holiday", text: "text-brand-ink" },
};

/** "0.3%", "221K", "-1.2B", "<0.10%" → a number (units dropped; both sides of a comparison share them). */
export function parseFigure(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(v.replace(/,/g, "").replace(/−/g, "-"));
  if (!m) return null;
  const n = Number(m[0]);
  const unit = v.trim().slice(-1).toUpperCase();
  const scale = unit === "K" ? 1e3 : unit === "M" ? 1e6 : unit === "B" ? 1e9 : unit === "T" ? 1e12 : 1;
  return Number.isFinite(n) ? n * scale : null;
}

/** Indicators where a higher number is bad news for the currency. */
const INVERSE = /unemployment|jobless|claimant|initial claims|continuing claims|trade deficit|budget deficit/i;
/** Releases with no number to compare: the market moves on the words. */
const WORDS_ONLY = /statement|press conference|speaks|minutes|testifies|testimony|monetary policy report|outlook/i;

export type GoldBias = {
  /** Likely first move in gold (XAUUSD): up, down, or a big move either way. */
  dir: "up" | "down" | "volatile";
  /** "actual": released figure vs forecast. "forecast": what the market expects vs last time. */
  basis: "actual" | "forecast" | "words";
  why: string;
};

/**
 * Rule-of-thumb gold reaction to a USD release. Gold is priced in dollars, so
 * USD-positive data usually pushes gold down and USD-negative data pushes it
 * up. Only USD events; other currencies move gold far less.
 */
export function goldBias(e: { title: string; currency: string; impact: string; forecast?: string | null; previous?: string | null; actual?: string | null }): GoldBias | null {
  if (e.currency !== "USD" || e.impact === "Holiday") return null;
  const actual = parseFigure(e.actual);
  const forecast = parseFigure(e.forecast);
  const previous = parseFigure(e.previous);
  let basis: GoldBias["basis"];
  let a: number | null;
  let b: number | null;
  let pair: [string, string];
  if (actual != null && (forecast != null || previous != null)) {
    basis = "actual";
    a = actual;
    b = forecast ?? previous;
    pair = [`actual ${e.actual}`, forecast != null ? `forecast ${e.forecast}` : `previous ${e.previous}`];
  } else if (forecast != null && previous != null) {
    basis = "forecast";
    a = forecast;
    b = previous;
    pair = [`forecast ${e.forecast}`, `previous ${e.previous}`];
  } else {
    if (e.impact === "High" && (WORDS_ONLY.test(e.title) || forecast == null)) {
      return { dir: "volatile", basis: "words", why: "No figure to compare: gold can move sharply either way on the wording." };
    }
    return null;
  }
  if (a === b) return { dir: "volatile", basis, why: `${pair[0]} = ${pair[1]}: the surprise decides the move.` };
  const usdStronger = INVERSE.test(e.title) ? a! < b! : a! > b!;
  const dir = usdStronger ? "down" : "up";
  return {
    dir,
    basis,
    why: `${pair[0]} ${a! > b! ? ">" : "<"} ${pair[1]} → USD ${usdStronger ? "stronger" : "weaker"} → gold usually ${dir}.`,
  };
}
