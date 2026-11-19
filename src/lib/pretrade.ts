/**
 * Pre-trade check: before opening a position, compare the planned trade with
 * the trader's own rules and history. Pure — the server gathers the inputs.
 */
import { formatDuration } from "./mindset";
import { currenciesForSymbol, type NewsWindow } from "./news";
import { defaultContractSize, quoteCurrency, riskReward } from "./risk";
import { normalizeSymbol } from "./trading/symbols";

export type Lang = "en" | "bn";
export type Level = "ok" | "caution" | "stop";
export type Check = { id: string; level: Level; title: string; detail: string };

export type PlannedTrade = {
  symbol: string;
  side: "LONG" | "SHORT";
  entry: number;
  sl?: number | null;
  tp?: number | null;
  lots: number;
};

export type PreTradeContext = {
  now: number;
  /** Current weekday (0 = Sunday) and hour in the trader's timezone. */
  weekday: number;
  hour: number;
  balance: number | null;
  currency: string;
  cooldownMinutes: number;
  window: NewsWindow;
  /** High/medium impact events from 1h ago to 4h ahead. */
  events: { id: string; title: string; currency: string; impact: string; time: number; allDay?: boolean }[];
  lastLoss: { symbol: string; net: number; closedAt: number } | null;
  /** Trades closed today (oldest first). */
  today: { net: number }[];
  openSameSymbol: number;
  avoidZones: { weekday: number; hour: number; trades: number; net: number }[];
  bestZones: { weekday: number; hour: number }[];
  symbolStats: { trades: number; net: number; winRate: number | null } | null;
  /** Active limit goals and how far along they are. */
  limits: { label: string; status: string }[];
};

/** Recommended risk per trade, % of balance (common professional standard). */
export const RISK_OK_PCT = 1;
export const RISK_MAX_PCT = 2;

const T = {
  en: {
    noSl: ["No stop loss", "Every trade needs a stop loss. Without one, a single news spike can wipe out days of profit."],
    badSl: (e: string) => ["Stop or target on the wrong side", e],
    risk: (pct: string, amt: string) => `Risk ${amt} = ${pct}% of balance.`,
    riskOk: "Risk is within 1%",
    riskHigh: "Risk is above 1%",
    riskTooHigh: "Risk is above 2%",
    riskOkD: "Professional traders risk 1% or less per trade.",
    riskHighD: "Keep it at 1% so a losing streak doesn't hurt. Consider fewer lots.",
    riskTooHighD: "One loss this size is a big hit. Cut the lot size.",
    riskUnknown: ["Risk not calculated", "Couldn't convert this symbol's risk to your account currency; check the lot size in MT5."],
    rr: (rr: string) => `Reward:risk ${rr}`,
    rrGood: "Good reward for the risk.",
    rrLow: "Below 1.5R you need a high win rate to make money.",
    rrBad: "You risk more than you can make. Move the target or skip.",
    noTp: ["No take profit", "Plan where you'll take profit before you enter."],
    newsNow: (t: string, m: string) => [`News window: ${t}`, m],
    newsSoon: (t: string, m: string) => [`News soon: ${t}`, m],
    newsNone: ["No big news nearby", "No high-impact release for this symbol in the next 2 hours."],
    in: (n: number) => `in ${n} min`,
    ago: (n: number) => `${n} min ago`,
    newsNowD: "Spreads widen and price whipsaws around releases. Wait until the window ends.",
    newsSoonD: "If you enter now, close or protect the trade before the release.",
    cooldown: (left: string, sym: string, net: string) => [
      "Cooldown after a loss",
      `You lost ${net} on ${sym}. Wait ${left} more — trading right after a loss is how revenge trades start.`,
    ],
    streak: (n: number) => [`${n} losses in a row today`, "Take a break. Your next trade should be your best setup, at normal size."],
    tooMany: (n: number) => [`${n} trades today already`, "More trades rarely means more profit. Is this an A+ setup?"],
    limit: (l: string) => [`Limit reached: ${l}`, "You set this rule for yourself. Stop trading for this period."],
    limitNear: (l: string) => [`Close to your limit: ${l}`, "One more loss could break it. Be extra selective."],
    avoid: (net: string, n: number) => ["You usually lose at this hour", `${net} over ${n} trades at this day and hour.`],
    best: ["This is one of your best hours", "Your history is positive at this day and hour."],
    symbolBad: (s: string, net: string, n: number) => [`${s} has cost you money`, `${net} over ${n} trades. Trade it only with your best setup.`],
    symbolGood: (s: string, net: string, n: number) => [`${s} works for you`, `${net} over ${n} trades.`],
    stacking: (n: number) => [`${n} ${n === 1 ? "position" : "positions"} already open on this symbol`, "Adding to it doubles the risk on one idea."],
  },
  bn: {
    noSl: ["স্টপ লস নেই", "প্রতিটা ট্রেডে স্টপ লস দরকার। স্টপ ছাড়া একটা নিউজ স্পাইকেই কয়েক দিনের লাভ শেষ হয়ে যেতে পারে।"],
    badSl: (e: string) => ["স্টপ বা টার্গেট ভুল দিকে", e],
    risk: (pct: string, amt: string) => `রিস্ক ${amt} = ব্যালান্সের ${pct}%।`,
    riskOk: "রিস্ক ১%-এর মধ্যে",
    riskHigh: "রিস্ক ১%-এর বেশি",
    riskTooHigh: "রিস্ক ২%-এর বেশি",
    riskOkD: "প্রফেশনাল ট্রেডাররা প্রতি ট্রেডে ১% বা তার কম রিস্ক নেয়।",
    riskHighD: "১%-এ রাখুন যাতে পরপর লস হলেও ক্ষতি কম হয়। লট কমানোর কথা ভাবুন।",
    riskTooHighD: "এত বড় একটা লসই বড় ধাক্কা। লট সাইজ কমান।",
    riskUnknown: ["রিস্ক হিসাব করা যায়নি", "এই সিম্বলের রিস্ক আপনার অ্যাকাউন্টের কারেন্সিতে বের করা যায়নি; MT5-এ লট সাইজ দেখে নিন।"],
    rr: (rr: string) => `রিওয়ার্ড:রিস্ক ${rr}`,
    rrGood: "রিস্কের তুলনায় রিওয়ার্ড ভালো।",
    rrLow: "১.৫R-এর কমে লাভ করতে অনেক বেশি উইন রেট লাগে।",
    rrBad: "যত লাভ হতে পারে তার চেয়ে বেশি রিস্ক নিচ্ছেন। টার্গেট সরান বা ট্রেডটা বাদ দিন।",
    noTp: ["টেক প্রফিট নেই", "এন্ট্রির আগেই ঠিক করুন কোথায় লাভ তুলবেন।"],
    newsNow: (t: string, m: string) => [`নিউজ উইন্ডো: ${t}`, m],
    newsSoon: (t: string, m: string) => [`শিগগিরই নিউজ: ${t}`, m],
    newsNone: ["কাছাকাছি বড় নিউজ নেই", "আগামী ২ ঘণ্টায় এই সিম্বলের কোনো হাই-ইমপ্যাক্ট নিউজ নেই।"],
    in: (n: number) => `${n} মিনিট পরে`,
    ago: (n: number) => `${n} মিনিট আগে`,
    newsNowD: "নিউজের সময় স্প্রেড বাড়ে আর দাম দুই দিকে লাফায়। উইন্ডো শেষ হওয়া পর্যন্ত অপেক্ষা করুন।",
    newsSoonD: "এখন ঢুকলে নিউজের আগেই ট্রেড বন্ধ করুন বা স্টপ ব্রেকইভেনে আনুন।",
    cooldown: (left: string, sym: string, net: string) => [
      "লসের পরে বিরতি",
      `${sym}-এ ${net} লস হয়েছে। আরও ${left} অপেক্ষা করুন — লসের পরপরই ট্রেড করা থেকেই রিভেঞ্জ ট্রেড শুরু হয়।`,
    ],
    streak: (n: number) => [`আজ পরপর ${n}টা লস`, "একটু বিরতি নিন। পরের ট্রেড হোক আপনার সেরা সেটআপ, স্বাভাবিক সাইজে।"],
    tooMany: (n: number) => [`আজ ইতিমধ্যে ${n}টা ট্রেড`, "বেশি ট্রেড মানেই বেশি লাভ নয়। এটা কি A+ সেটআপ?"],
    limit: (l: string) => [`লিমিট শেষ: ${l}`, "এই নিয়ম আপনি নিজেই দিয়েছেন। এই সময়ের জন্য ট্রেড বন্ধ করুন।"],
    limitNear: (l: string) => [`লিমিটের কাছাকাছি: ${l}`, "আর একটা লস হলেই নিয়ম ভাঙবে। খুব বেছে ট্রেড নিন।"],
    avoid: (net: string, n: number) => ["এই সময়ে সাধারণত লস হয়", `এই দিন ও ঘণ্টায় ${n}টা ট্রেডে ${net}।`],
    best: ["এটা আপনার সেরা সময়গুলোর একটা", "এই দিন ও ঘণ্টায় আপনার রেকর্ড লাভে।"],
    symbolBad: (s: string, net: string, n: number) => [`${s}-এ আপনার লস হচ্ছে`, `${n}টা ট্রেডে ${net}। শুধু সেরা সেটআপে এটা ট্রেড করুন।`],
    symbolGood: (s: string, net: string, n: number) => [`${s} আপনার জন্য ভালো`, `${n}টা ট্রেডে ${net}।`],
    stacking: (n: number) => [`এই সিম্বলে ইতিমধ্যে ${n}টা পজিশন খোলা`, "আরও যোগ করলে একই আইডিয়ায় রিস্ক দ্বিগুণ হয়।"],
  },
} as const;

const money = (v: number, cur: string) => {
  const sign = v < 0 ? "-" : v > 0 ? "+" : "";
  if (cur === "USC") return `${sign}${Math.abs(v).toFixed(2)} USC`;
  return `${sign}${new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD" }).format(Math.abs(v))}`;
};

/** Money at risk if the stop is hit, in the account currency; null when it can't be known. */
export function riskAmount(t: PlannedTrade, currency: string) {
  if (t.sl == null) return null;
  const s = normalizeSymbol(t.symbol);
  const dist = Math.abs(t.entry - t.sl);
  let usd = dist * t.lots * defaultContractSize(s);
  const quote = quoteCurrency(s);
  if (quote !== "USD") {
    if (s.startsWith("USD") && t.entry > 0) usd /= t.entry;
    else return null;
  }
  if (currency === "USD") return usd;
  if (currency === "USC") return usd * 100;
  return null;
}

const rank: Record<Level, number> = { ok: 0, caution: 1, stop: 2 };
export const worst = (checks: Check[]): Level => checks.reduce<Level>((w, c) => (rank[c.level] > rank[w] ? c.level : w), "ok");

export function preTradeCheck(t: PlannedTrade, ctx: PreTradeContext, lang: Lang = "en"): { verdict: Level; checks: Check[] } {
  const L = T[lang];
  const checks: Check[] = [];
  const add = (id: string, level: Level, [title, detail]: readonly [string, string] | string[]) => checks.push({ id, level, title, detail });

  // 1. Stop loss, direction, reward:risk.
  if (t.sl == null) add("sl", "stop", L.noSl);
  else {
    const rr = riskReward({ side: t.side, entry: t.entry, sl: t.sl, tp: t.tp ?? null, symbol: t.symbol });
    if ("error" in rr) add("sl", "stop", L.badSl(rr.error ?? ""));
    else if (rr.rr == null) add("tp", "caution", L.noTp);
    else {
      const level: Level = rr.rr >= 1.5 ? "ok" : rr.rr >= 1 ? "caution" : "stop";
      add("rr", level, [L.rr(`${rr.rr.toFixed(2)}R`), level === "ok" ? L.rrGood : level === "caution" ? L.rrLow : L.rrBad]);
    }
  }

  // 2. Risk as % of balance.
  if (t.sl != null) {
    const amt = riskAmount(t, ctx.currency);
    if (amt == null || !ctx.balance || ctx.balance <= 0) add("risk", "caution", L.riskUnknown);
    else {
      const pct = (amt / ctx.balance) * 100;
      const level: Level = pct <= RISK_OK_PCT + 1e-9 ? "ok" : pct <= RISK_MAX_PCT + 1e-9 ? "caution" : "stop";
      add("risk", level, [
        level === "ok" ? L.riskOk : level === "caution" ? L.riskHigh : L.riskTooHigh,
        `${L.risk(pct.toFixed(2), money(amt, ctx.currency).replace(/^\+/, ""))} ${level === "ok" ? L.riskOkD : level === "caution" ? L.riskHighD : L.riskTooHighD}`,
      ]);
    }
  }

  // 3. News for this symbol's currencies.
  const curs = new Set(currenciesForSymbol(t.symbol));
  const high = ctx.events.filter((e) => e.impact === "High" && !e.allDay && curs.has(e.currency)).sort((a, b) => a.time - b.time);
  const inWindow = high.find((e) => ctx.now >= e.time - ctx.window.before * 60_000 && ctx.now <= e.time + ctx.window.after * 60_000);
  const soon = high.find((e) => e.time > ctx.now && e.time - ctx.now <= 2 * 3_600_000);
  const when = (e: { time: number }) => {
    const m = Math.round((e.time - ctx.now) / 60_000);
    return m >= 0 ? L.in(m) : L.ago(-m);
  };
  if (inWindow) add("news", "stop", L.newsNow(`${inWindow.currency} ${inWindow.title} (${when(inWindow)})`, L.newsNowD));
  else if (soon) add("news", "caution", L.newsSoon(`${soon.currency} ${soon.title} (${when(soon)})`, L.newsSoonD));
  else add("news", "ok", L.newsNone);

  // 4. Cooldown after a loss.
  if (ctx.lastLoss && ctx.cooldownMinutes > 0) {
    const leftMs = ctx.lastLoss.closedAt + ctx.cooldownMinutes * 60_000 - ctx.now;
    if (leftMs > 0) add("cooldown", "stop", L.cooldown(formatDuration(Math.ceil(leftMs / 1000)), ctx.lastLoss.symbol, money(ctx.lastLoss.net, ctx.currency)));
  }

  // 5. Today: losing streak and overtrading.
  let streak = 0;
  for (let i = ctx.today.length - 1; i >= 0 && ctx.today[i].net < 0; i--) streak++;
  if (streak >= 3) add("streak", "stop", L.streak(streak));
  else if (streak === 2) add("streak", "caution", L.streak(streak));
  if (ctx.today.length >= 6) add("count", "caution", L.tooMany(ctx.today.length));

  // 6. The trader's own limit goals.
  for (const g of ctx.limits) {
    if (g.status === "breached") add(`limit-${g.label}`, "stop", L.limit(g.label));
    else if (g.status === "warning") add(`limit-${g.label}`, "caution", L.limitNear(g.label));
  }

  // 7. Time of day, from the trader's own history.
  const avoid = ctx.avoidZones.find((z) => z.weekday === ctx.weekday && z.hour === ctx.hour);
  if (avoid) add("zone", "caution", L.avoid(money(avoid.net, ctx.currency), avoid.trades));
  else if (ctx.bestZones.some((z) => z.weekday === ctx.weekday && z.hour === ctx.hour)) add("zone", "ok", L.best);

  // 8. This symbol's record.
  const s = ctx.symbolStats;
  if (s && s.trades >= 10) {
    const sym = normalizeSymbol(t.symbol);
    if (s.net < 0) add("symbol", "caution", L.symbolBad(sym, money(s.net, ctx.currency), s.trades));
    else add("symbol", "ok", L.symbolGood(sym, money(s.net, ctx.currency), s.trades));
  }

  // 9. Stacking on the same symbol.
  if (ctx.openSameSymbol > 0) add("open", "caution", L.stacking(ctx.openSameSymbol));

  checks.sort((a, b) => rank[b.level] - rank[a.level]);
  return { verdict: worst(checks), checks };
}
