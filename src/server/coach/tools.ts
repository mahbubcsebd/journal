import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { coachMemory, type User } from "@/db/schema";
import type { ToolDeclaration } from "@/lib/ai/gemini";
import { groupBy, tiltPatterns, type ATrade, type GroupRow } from "@/lib/analytics";
import { addDays, todayIn } from "@/lib/dates";
import { detailedStats } from "@/lib/detailed-stats";
import { docToText } from "@/lib/doc";
import { heatmap, holdTimes, setupConfidence, streakCheck } from "@/lib/mindset";
import { newsTrades } from "@/lib/news";
import { rangeStart, RANGES, type RangeKey } from "@/lib/ranges";
import { getDataMode, getSelectedAccountIds, getUserAccounts } from "@/lib/session";
import { parseTradeFilters } from "@/lib/trade-filters";
import { SESSION_LABEL } from "@/lib/trading/metrics";
import { getAnalyticsTrades, getSetupReps } from "@/server/queries/analytics";
import { listJournalEntries } from "@/server/queries/journal";
import { getEvents, getNewsPrefs } from "@/server/queries/news";
import { getTrade, listTrades } from "@/server/queries/trades";

const r2 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 100) / 100);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};

const rangeParams = {
  range: { type: "STRING", enum: RANGES.map((r) => r.key), description: "Preset period ending today. Default 90d." },
  from: { type: "STRING", description: "Start date YYYY-MM-DD (overrides range)." },
  to: { type: "STRING", description: "End date YYYY-MM-DD." },
};

export const COACH_TOOLS: ToolDeclaration[] = [
  {
    name: "get_performance",
    description:
      "Statistics for a period: net P&L, win rate, profit factor, expectancy, streaks, hold times, drawdown, plus breakdowns by symbol, session, weekday, hour, setup, month. Use for 'how am I doing', 'where do I lose money', comparisons.",
    parameters: { type: "OBJECT", properties: rangeParams },
  },
  {
    name: "list_trades",
    description:
      "List individual trades (newest first unless sort=pnl). Each has id, times, symbol, side, lots, net P&L, R, setup, tags/mistakes, emotion, plan followed, journal note. Use to review specific trades or find mistakes.",
    parameters: {
      type: "OBJECT",
      properties: {
        ...rangeParams,
        symbol: { type: "STRING", description: "e.g. XAUUSD" },
        side: { type: "STRING", enum: ["LONG", "SHORT"] },
        result: { type: "STRING", enum: ["win", "loss", "be"] },
        status: { type: "STRING", enum: ["OPEN", "CLOSED"] },
        sort: { type: "STRING", enum: ["date", "pnl"], description: "pnl sorts biggest losses first." },
        limit: { type: "INTEGER", description: "1-40, default 20" },
      },
    },
  },
  {
    name: "get_trade",
    description: "Everything about one trade by id: prices, SL/TP, P&L, R, timing, journal (setup, checklist, emotions, notes, mistakes) and high-impact news around its entry.",
    parameters: { type: "OBJECT", properties: { id: { type: "STRING" } }, required: ["id"] },
  },
  {
    name: "get_psychology",
    description:
      "Behaviour patterns over all history: current/record win and loss streaks, hold time of winners vs losers, revenge trades after losses, oversizing, overtrading, trades around high-impact news, best/worst day-hour windows, setup confidence, discipline.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "get_news",
    description:
      "Economic calendar (high/medium impact releases) with time, currency, impact, forecast, previous, actual. Use for upcoming risk, 'what news this week', or explaining past moves.",
    parameters: {
      type: "OBJECT",
      properties: {
        days_back: { type: "INTEGER", description: "0-14, default 0" },
        days_ahead: { type: "INTEGER", description: "0-14, default 7" },
        currency: { type: "STRING", description: "e.g. USD" },
        min_impact: { type: "STRING", enum: ["High", "Medium", "Low"] },
      },
    },
  },
  {
    name: "get_accounts",
    description: "The user's Exness MT5 accounts: name, type, real/demo, currency, balance, equity, open positions with floating P&L, last sync.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "remember",
    description:
      "Save a lasting fact about the trader for future chats: a rule they commit to, a goal, a recurring mistake, a preference (e.g. 'Rule: no trades 15 min around USD news', 'Goal: pass a 10k prop challenge'). Only when the user states it or agrees to it; keep it one short sentence.",
    parameters: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] },
  },
  {
    name: "forget",
    description: "Delete a saved memory by id when it is wrong, outdated or the user asks.",
    parameters: { type: "OBJECT", properties: { id: { type: "STRING" } }, required: ["id"] },
  },
  {
    name: "get_journal",
    description: "Daily journal entries (mood, pre-market plan, review notes, lessons). Use for mindset questions or to connect feelings with results.",
    parameters: { type: "OBJECT", properties: { limit: { type: "INTEGER", description: "1-30, default 10" } } },
  },
];

function period(user: User, args: Record<string, unknown>) {
  const today = todayIn(user.timezone);
  const from = str(args.from);
  const to = str(args.to);
  if (from && DATE.test(from)) return { from, to: to && DATE.test(to) ? to : today };
  const range = (RANGES.find((r) => r.key === args.range)?.key ?? "90d") as RangeKey;
  return { from: rangeStart(range, today), to: today };
}

const compactGroup = (rows: GroupRow[], top = 8) =>
  rows
    .filter((r) => r.trades > 0)
    .slice(0, top)
    .map((r) => ({ key: r.key, trades: r.trades, net: r2(r.net), winRate: r2(r.winRate), profitFactor: r2(r.profitFactor), expectancy: r2(r.expectancy) }));

const byNet = (rows: GroupRow[]) => [...rows].sort((a, b) => b.net - a.net);

/** Run one tool for this user. Results are plain JSON for the model. */
export async function runCoachTool(user: User, name: string, args: Record<string, unknown>) {
  const tz = user.timezone;
  const { ids } = await getSelectedAccountIds(user.id);
  const mode = await getDataMode();

  switch (name) {
    case "get_performance": {
      const p = period(user, args);
      const { currency, trades } = await getAnalyticsTrades(user.id, ids, p.from, p.to, tz);
      if (!trades.length) return { period: p, currency, dataMode: mode, trades: 0, note: "No closed trades in this period." };
      const s = detailedStats(trades);
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return {
        period: p,
        currency,
        dataMode: mode,
        stats: { ...s.trade, ...s.day, winRate: r2(s.trade.winningTrades / Math.max(1, s.trade.winningTrades + s.trade.losingTrades)) },
        bySymbol: compactGroup(byNet(groupBy(trades, (t) => t.symbol))),
        bySession: compactGroup(groupBy(trades, (t) => (t.session ? SESSION_LABEL[t.session as keyof typeof SESSION_LABEL] : null))),
        byWeekday: compactGroup(groupBy(trades, (t) => weekdays[t.weekday], weekdays), 7),
        byHourBestWorst: (() => {
          const h = byNet(groupBy(trades, (t) => `${String(t.hour).padStart(2, "0")}:00`)).filter((r) => r.trades >= 2);
          return { best: compactGroup(h.slice(0, 3)), worst: compactGroup(h.slice(-3).reverse()) };
        })(),
        bySide: compactGroup(groupBy(trades, (t) => t.side)),
        bySetup: compactGroup(byNet(groupBy(trades, (t) => t.setup ?? "No setup"))),
        byMistake: compactGroup(byNet(groupBy(trades, (t) => t.tags.filter((g) => g.kind === "MISTAKE").map((g) => g.name))).reverse()),
        byMonth: compactGroup(groupBy(trades, (t) => t.day.slice(0, 7)), 12),
      };
    }

    case "list_trades": {
      const p = period(user, args);
      const f = parseTradeFilters({
        from: p.from,
        to: p.to,
        symbol: str(args.symbol),
        side: str(args.side),
        result: str(args.result),
        status: str(args.status),
        sort: args.sort === "pnl" ? "pnl" : "date",
        dir: args.sort === "pnl" ? "asc" : "desc",
      });
      const rows = await listTrades(user.id, ids, f, tz, num(args.limit, 1, 40, 20));
      const time = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(d) : null);
      return {
        period: p,
        dataMode: mode,
        trades: rows.map((t) => ({
          id: t.id,
          link: `/trades/${t.id}`,
          symbol: t.symbol,
          side: t.side,
          status: t.status,
          opened: time(t.openTime),
          closed: time(t.closeTime),
          lots: t.volume,
          entry: t.openPrice,
          exit: t.closePrice,
          net: r2(t.netPnl),
          currency: t.currency,
          r: r2(t.rMultiple),
          holdMinutes: t.durationSec == null ? null : Math.round(t.durationSec / 60),
          session: t.session,
          setup: t.setupName,
          tags: t.tags.map((g) => `${g.kind === "MISTAKE" ? "mistake:" : g.kind === "EMOTION" ? "emotion:" : ""}${g.name}`),
          rating: t.rating,
          account: t.accountName,
        })),
      };
    }

    case "get_trade": {
      const id = str(args.id);
      if (!id) return { error: "id is required" };
      const t = await getTrade(user.id, id);
      if (!t) return { error: "Trade not found" };
      const pre = await getNewsPrefs(user);
      const around = await getEvents(new Date(t.openTime.getTime() - 2 * 3_600_000), new Date(t.openTime.getTime() + 2 * 3_600_000)).catch(() => []);
      const time = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(d) : null);
      return {
        id: t.id,
        link: `/trades/${t.id}`,
        symbol: t.symbol,
        side: t.side,
        status: t.status,
        account: t.account.nickname,
        currency: t.account.currency,
        opened: time(t.openTime),
        closed: time(t.closeTime),
        entry: t.openPrice,
        exit: t.closePrice,
        sl: t.sl,
        tp: t.tp,
        lots: t.volume,
        net: r2(t.netPnl),
        commission: r2(t.commission),
        swap: r2(t.swap),
        r: r2(t.rMultiple),
        pips: r2(t.pips),
        holdMinutes: t.durationSec == null ? null : Math.round(t.durationSec / 60),
        session: t.session,
        backtest: t.isBacktest,
        journal: {
          rating: t.rating,
          setupId: t.setupId,
          emotionBefore: t.emotionBefore,
          emotionAfter: t.emotionAfter,
          followedPlan: t.followedPlan,
          checklist: t.checklist,
          notes: (t.notes as { text?: string } | null)?.text?.slice(0, 1500) ?? null,
          tagIds: t.tagIds,
          screenshots: t.images.length,
        },
        newsAroundEntry: around
          .filter((e) => e.impact !== "Low")
          .map((e) => ({
            time: time(e.time),
            minutesFromEntry: Math.round((e.time.getTime() - t.openTime.getTime()) / 60_000),
            currency: e.currency,
            title: e.title,
            impact: e.impact,
            forecast: e.forecast,
            previous: e.previous,
            actual: e.actual,
          })),
        noTradeWindow: pre.window,
      };
    }

    case "get_psychology": {
      const { currency, trades } = await getAnalyticsTrades(user.id, ids, undefined, todayIn(tz), tz);
      if (!trades.length) return { currency, trades: 0, note: "No closed trades yet." };
      const prefs = await getNewsPrefs(user);
      const first = Math.min(...trades.map((t) => t.openAt));
      const events = (await getEvents(new Date(first - 3_600_000), new Date()).catch(() => [])).filter((e) => e.impact === "High");
      const news = newsTrades(trades, events, prefs.window);
      const newsIds = new Set(news.map((h) => h.trade.id));
      const exp = (ts: ATrade[]) => (ts.length ? r2(ts.reduce((s, t) => s + t.net, 0) / ts.length) : null);
      const tilt = tiltPatterns(trades);
      const heat = heatmap(trades);
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const zone = (z: { weekday: number; hour: number; trades: number; net: number; winRate: number }) => ({
        when: `${weekdays[z.weekday]} ${String(z.hour).padStart(2, "0")}:00`,
        trades: z.trades,
        net: r2(z.net),
        winRate: r2(z.winRate),
      });
      const setups = setupConfidence(await getSetupReps(user.id, ids));
      return {
        currency,
        dataMode: mode,
        closedTrades: trades.length,
        streaks: streakCheck(trades),
        holdTimes: holdTimes(trades),
        revengeTrades: { trades: tilt.revenge.trades, net: r2(tilt.revenge.net), expectancy: r2(tilt.revenge.expectancy), baselineExpectancy: r2(tilt.baseline.expectancy) },
        sizedUpAfterLoss: { trades: tilt.sizedUp.trades, net: r2(tilt.sizedUp.net) },
        afterTwoLosses: { trades: tilt.afterStreak.trades, net: r2(tilt.afterStreak.net) },
        overtradingDays: { days: tilt.overtrading.days, expectancy: r2(tilt.overtrading.expectancy), usualTradesPerDay: tilt.overtrading.medianTradesPerDay },
        newsTrades: {
          window: prefs.window,
          trades: news.length,
          net: r2(news.reduce((s, h) => s + h.trade.net, 0)),
          expectancy: exp(news.map((h) => h.trade)),
          otherExpectancy: exp(trades.filter((t) => !newsIds.has(t.id))),
          worst: [...news]
            .sort((a, b) => a.trade.net - b.trade.net)
            .slice(0, 3)
            .map((h) => ({ tradeId: h.trade.id, symbol: h.trade.symbol, net: r2(h.trade.net), event: `${h.event.currency} ${h.event.title}`, minutesFromRelease: h.minutes })),
        },
        tradeZones: heat.best.map(zone),
        avoidZones: heat.avoid.map(zone),
        setupConfidence: setups.slice(0, 6).map((s) => ({ setup: s.name, score: s.score, level: s.level, liveTrades: s.live, backtests: s.backtest, winRate: r2(s.winRate) })),
        planFollowed: compactGroup(groupBy(trades, (t) => (t.followedPlan == null ? null : t.followedPlan ? "followed plan" : "broke plan"))),
        byEmotion: compactGroup(groupBy(trades, (t) => t.emotionBefore)),
        cooldownMinutes: user.settings.cooldownMinutes ?? 30,
      };
    }

    case "get_news": {
      const back = num(args.days_back, 0, 14, 0);
      const ahead = num(args.days_ahead, 0, 14, 7);
      const prefs = await getNewsPrefs(user);
      const min = (["High", "Medium", "Low"] as const).find((m) => m === args.min_impact) ?? "Medium";
      const rank = { High: 3, Medium: 2, Low: 1, Holiday: 0 } as Record<string, number>;
      const cur = str(args.currency)?.toUpperCase();
      const now = Date.now();
      const events = await getEvents(new Date(now - back * 86_400_000), new Date(now + ahead * 86_400_000)).catch(() => null);
      if (!events) return { error: "The economic calendar isn't available yet." };
      const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
      return {
        now: time(new Date()),
        timezone: tz,
        watchedCurrencies: prefs.currencies ? [...prefs.currencies] : "all",
        noTradeWindow: prefs.window,
        events: events
          .filter((e) => (rank[e.impact] ?? 0) >= rank[min] && (!cur || e.currency === cur))
          .slice(0, 60)
          .map((e) => ({
            id: e.id,
            link: `/news/${e.id}`,
            time: e.allDay ? "all day" : time(e.time),
            inMinutes: Math.round((e.time.getTime() - now) / 60_000),
            currency: e.currency,
            title: e.title,
            impact: e.impact,
            forecast: e.forecast,
            previous: e.previous,
            actual: e.actual,
          })),
      };
    }

    case "get_accounts": {
      const accounts = await getUserAccounts(user.id);
      return {
        selectedInFilter: ids,
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.nickname,
          login: a.login,
          type: a.accountType,
          environment: a.environment,
          currency: a.currency,
          balance: r2(a.balance),
          equity: r2(a.equity),
          floating: a.balance != null && a.equity != null ? r2(a.equity - a.balance) : null,
          openPositions: (a.openPositions ?? []).map((p) => ({ symbol: p.symbol, side: p.side, lots: p.volume, entry: p.openPrice, current: p.currentPrice, sl: p.sl, tp: p.tp, profit: r2(p.profit), opened: p.openTime })),
          status: a.status,
          lastSync: a.lastSyncAt?.toISOString() ?? null,
        })),
      };
    }

    case "remember": {
      const text = str(args.text)?.slice(0, 300);
      if (!text) return { error: "text is required" };
      const [{ n }] = await db.select({ n: count() }).from(coachMemory).where(eq(coachMemory.userId, user.id));
      if (n >= MAX_MEMORIES) return { error: `Memory is full (${MAX_MEMORIES}). Ask the user which memory to forget.` };
      const [row] = await db.insert(coachMemory).values({ userId: user.id, text }).returning({ id: coachMemory.id });
      return { saved: true, id: row.id };
    }

    case "forget": {
      const id = str(args.id);
      if (!id) return { error: "id is required" };
      const del = await db
        .delete(coachMemory)
        .where(and(eq(coachMemory.id, id), eq(coachMemory.userId, user.id)))
        .returning({ id: coachMemory.id });
      return { deleted: del.length > 0 };
    }

    case "get_journal": {
      const rows = await listJournalEntries(user.id, num(args.limit, 1, 30, 10));
      return {
        entries: rows.map((j) => ({
          day: j.day,
          link: `/journal/${j.day}`,
          mood: j.mood,
          premarket: j.premarket ? { bias: j.premarket.bias, plan: docToText(j.premarket.plan, 600) } : null,
          review: j.review
            ? { wentWell: docToText(j.review.wentWell, 400), improve: docToText(j.review.improve, 400), lessons: docToText(j.review.lessons, 400) }
            : null,
        })),
      };
    }
  }
  return { error: `Unknown tool ${name}` };
}

export const TOOL_LABEL: Record<string, string> = {
  get_performance: "Performance",
  list_trades: "Trades",
  get_trade: "Trade details",
  get_psychology: "Psychology",
  get_news: "News calendar",
  get_accounts: "Accounts",
  get_journal: "Journal",
  remember: "Memory",
  forget: "Memory",
};

export const MAX_MEMORIES = 50;

export async function listMemories(userId: string) {
  return db
    .select({ id: coachMemory.id, text: coachMemory.text, createdAt: coachMemory.createdAt })
    .from(coachMemory)
    .where(eq(coachMemory.userId, userId))
    .orderBy(asc(coachMemory.createdAt))
    .limit(MAX_MEMORIES);
}

/** Short context for every chat: who, when, which accounts. */
export async function coachContext(user: User) {
  const accounts = await getUserAccounts(user.id);
  const mode = await getDataMode();
  const today = todayIn(user.timezone);
  return {
    today,
    yesterday: addDays(today, -1),
    now: new Intl.DateTimeFormat("en-GB", { timeZone: user.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date()),
    timezone: user.timezone,
    name: user.name,
    dataMode: mode,
    accounts: accounts.map((a) => `${a.nickname} (#${a.login}, ${a.accountType}, ${a.environment}, ${a.currency})`),
  };
}
