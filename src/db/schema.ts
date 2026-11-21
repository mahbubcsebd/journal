import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const money = (name: string) => numeric(name, { precision: 20, scale: 2, mode: "number" });
const price = (name: string) => numeric(name, { precision: 20, scale: 8, mode: "number" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* -------------------------------------------------------------------------- */
/*                         Auth (managed by Better Auth)                       */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // App-specific profile fields
  timezone: text("timezone").notNull().default("Asia/Dhaka"),
  baseCurrency: text("base_currency").notNull().default("USD"),
  onboarded: boolean("onboarded").notNull().default(false),
  settings: jsonb("settings").$type<UserSettings>().notNull().default({}),
  /** Set by a super admin: paused (temporary, optional end) or banned. Both block sign-in and sync. */
  status: text("status").$type<"active" | "paused" | "banned">().notNull().default("active"),
  statusReason: text("status_reason"),
  /** Paused accounts reopen at this time (null = until an admin unpauses). */
  statusUntil: timestamp("status_until", { withTimezone: true }),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  /** Last time the user opened the app (updated at most every 10 minutes). */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  ...timestamps,
});

export type UserSettings = {
  weekStartsOn?: 0 | 1 | 6;
  pnlDisplay?: "money" | "r" | "percent" | "pips";
  density?: "comfortable" | "compact";
  locale?: "en" | "bn";
  /** Pre-market checklist items the user ticks every trading day. */
  dailyChecklist?: string[];
  /** Email the weekly summary (default on). */
  emailWeeklyReport?: boolean;
  /** Email when a goal limit is broken (default on). */
  emailGoalAlerts?: boolean;
  /** Language for AI insights. */
  aiLanguage?: "en" | "bn";
  /** Minutes after a losing trade to wait before the next one (0 = off). Default 30. */
  cooldownMinutes?: number;
  /** Analytics charts starred into the Favorites tab. */
  favoriteCharts?: string[];
  /** Economic news: lowest impact to show/alert (default High). */
  newsImpact?: "High" | "Medium" | "Low";
  /** Currencies to watch; empty/undefined = from traded symbols (+ USD). "ALL" = every currency. */
  newsCurrencies?: string[];
  /** No-trade window around high-impact news, in minutes (defaults 15 / 15). */
  newsBefore?: number;
  newsAfter?: number;
  /** AI coach reply language: follow the user's message, or always English / Bangla. */
  coachLanguage?: "auto" | "en" | "bn";
  /** Automatic AI coach reviews (default on). */
  coachDailyReport?: boolean;
  coachWeeklyReport?: boolean;
  /** MT5 guard: alert in MT5 when a trade breaks a rule (default on). */
  guardAlerts?: boolean;
  /** MT5 guard: also close such trades (default off; the EA must allow it too). */
  guardAutoClose?: boolean;
  /** Phone/Telegram alerts by type (default on). */
  notifyNews?: boolean;
  notifyCooldown?: boolean;
  notifyLimits?: boolean;
  notifyReviews?: boolean;
  notifyGuard?: boolean;
  /** Minutes before high-impact news to send the reminder (default 15). */
  notifyNewsMinutes?: number;
  /** Telegram chat that receives alerts, and the one-time code that links it. */
  telegramChatId?: string;
  telegramLink?: { code: string; expires: number };
};

export type JournalPremarket = {
  bias?: "BULLISH" | "BEARISH" | "NEUTRAL" | null;
  plan?: unknown; // Tiptap doc
  checklist?: Record<string, boolean>;
};

export type JournalReview = {
  wentWell?: unknown;
  improve?: unknown;
  lessons?: unknown;
};

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Better Auth rate-limit counters, shared across serverless instances. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* -------------------------------------------------------------------------- */
/*                              Trading accounts                               */
/* -------------------------------------------------------------------------- */

export const platformEnum = pgEnum("platform", ["MT5", "MT4"]);
export const syncMethodEnum = pgEnum("sync_method", ["METAAPI", "EA", "IMPORT", "MANUAL"]);
export const accountEnvEnum = pgEnum("account_env", ["REAL", "DEMO"]);
export const accountStatusEnum = pgEnum("account_status", [
  "PENDING",
  "CONNECTED",
  "SYNCING",
  "ERROR",
  "DISCONNECTED",
]);

/**
 * One row per MT5 login. Exness lets a single Personal Area own many
 * trading accounts (Standard, Pro, Raw, Zero, Cent ... real & demo) — each
 * is a separate login, so each is tracked and filterable on its own.
 */
export const tradingAccount = pgTable(
  "trading_account",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    broker: text("broker").notNull().default("Exness"),
    platform: platformEnum("platform").notNull().default("MT5"),
    login: text("login").notNull(),
    server: text("server").notNull(),
    nickname: text("nickname").notNull(),
    color: text("color").notNull().default("#10b981"),
    accountType: text("account_type").notNull().default("Standard"), // Standard | Standard Cent | Pro | Raw Spread | Zero
    environment: accountEnvEnum("environment").notNull().default("REAL"),
    currency: text("currency").notNull().default("USD"), // USC for cent accounts
    leverage: integer("leverage"),
    syncMethod: syncMethodEnum("sync_method").notNull().default("MANUAL"),
    status: accountStatusEnum("status").notNull().default("PENDING"),
    statusMessage: text("status_message"),
    metaapiAccountId: text("metaapi_account_id"),
    encryptedInvestorPassword: text("encrypted_investor_password"),
    balance: money("balance"),
    equity: money("equity"),
    initialBalance: money("initial_balance"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    /** Latest snapshot of open positions from the EA / MetaApi (floating P&L). */
    openPositions: jsonb("open_positions").$type<OpenPosition[]>(),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("trading_account_login_uq").on(t.userId, t.login, t.server),
    index("trading_account_user_idx").on(t.userId),
  ],
);

export type OpenPosition = {
  ticket: string;
  symbol: string;
  side: "LONG" | "SHORT";
  volume: number;
  openPrice: number;
  currentPrice: number | null;
  sl: number | null;
  tp: number | null;
  profit: number;
  swap: number;
  openTime: string;
};

/** Per-user key used by the MT5 Expert Advisor to push deals (HMAC signed). */
export const syncKey = pgTable("sync_key", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("MT5 EA"),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/*                               Raw broker data                               */
/* -------------------------------------------------------------------------- */

/** Raw MT5 deals exactly as received. Trades are rebuilt from these. */
export const deal = pgTable(
  "deal",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    ticket: text("ticket").notNull(),
    orderTicket: text("order_ticket"),
    positionId: text("position_id"),
    symbol: text("symbol"),
    type: text("type").notNull(), // BUY | SELL | BALANCE | CREDIT | ...
    entry: text("entry"), // IN | OUT | INOUT | OUT_BY
    volume: real("volume"),
    price: price("price"),
    sl: price("sl"),
    tp: price("tp"),
    commission: money("commission").notNull().default(0),
    swap: money("swap").notNull().default(0),
    fee: money("fee").notNull().default(0),
    profit: money("profit").notNull().default(0),
    magic: bigint("magic", { mode: "number" }),
    comment: text("comment"),
    time: timestamp("time", { withTimezone: true }).notNull(),
    source: syncMethodEnum("source").notNull(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("deal_ticket_uq").on(t.accountId, t.ticket),
    index("deal_position_idx").on(t.accountId, t.positionId),
  ],
);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "DEPOSIT",
  "WITHDRAWAL",
  "CREDIT",
  "BONUS",
  "ADJUSTMENT",
]);

export const transaction = pgTable(
  "transaction",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    ticket: text("ticket"),
    type: transactionTypeEnum("type").notNull(),
    amount: money("amount").notNull(),
    comment: text("comment"),
    time: timestamp("time", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("transaction_ticket_uq").on(t.accountId, t.ticket)],
);

/* -------------------------------------------------------------------------- */
/*                                   Trades                                    */
/* -------------------------------------------------------------------------- */

export const tradeSideEnum = pgEnum("trade_side", ["LONG", "SHORT"]);
export const tradeStatusEnum = pgEnum("trade_status", ["OPEN", "CLOSED"]);
export const marketSessionEnum = pgEnum("market_session", [
  "ASIA",
  "LONDON",
  "NEW_YORK",
  "LONDON_NY_OVERLAP",
  "OFF_HOURS",
]);

/** A position (all deals sharing a position id), the unit the journal works with. */
export const trade = pgTable(
  "trade",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    positionId: text("position_id"),
    symbol: text("symbol").notNull(),
    side: tradeSideEnum("side").notNull(),
    status: tradeStatusEnum("status").notNull().default("CLOSED"),
    openTime: timestamp("open_time", { withTimezone: true }).notNull(),
    closeTime: timestamp("close_time", { withTimezone: true }),
    openPrice: price("open_price").notNull(),
    closePrice: price("close_price"),
    volume: real("volume").notNull(),
    sl: price("sl"),
    tp: price("tp"),
    commission: money("commission").notNull().default(0),
    swap: money("swap").notNull().default(0),
    grossPnl: money("gross_pnl").notNull().default(0),
    netPnl: money("net_pnl").notNull().default(0),
    pips: real("pips"),
    riskAmount: money("risk_amount"),
    rMultiple: real("r_multiple"),
    mae: price("mae"),
    mfe: price("mfe"),
    durationSec: integer("duration_sec"),
    session: marketSessionEnum("session"),
    source: syncMethodEnum("source").notNull(),
    isBacktest: boolean("is_backtest").notNull().default(false),
    // Journal fields
    setupId: text("setup_id").references(() => setup.id, { onDelete: "set null" }),
    rating: integer("rating"),
    notes: jsonb("notes"),
    emotionBefore: text("emotion_before"),
    emotionAfter: text("emotion_after"),
    followedPlan: boolean("followed_plan"),
    /** Setup checklist ticked for this trade: item text → met. */
    checklist: jsonb("checklist").$type<Record<string, boolean>>(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("trade_position_uq")
      .on(t.accountId, t.positionId)
      .where(sql`${t.positionId} is not null`),
    index("trade_user_close_idx").on(t.userId, t.closeTime),
    index("trade_account_close_idx").on(t.accountId, t.closeTime),
    index("trade_symbol_idx").on(t.userId, t.symbol),
  ],
);

export const tradeImage = pgTable("trade_image", {
  id: id(),
  tradeId: text("trade_id")
    .notNull()
    .references(() => trade.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tagKindEnum = pgEnum("tag_kind", ["TAG", "MISTAKE", "EMOTION"]);

export const tag = pgTable(
  "tag",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: tagKindEnum("kind").notNull().default("TAG"),
    color: text("color").notNull().default("#64748b"),
    ...timestamps,
  },
  (t) => [uniqueIndex("tag_name_uq").on(t.userId, t.kind, t.name)],
);

export const tradeTag = pgTable(
  "trade_tag",
  {
    tradeId: text("trade_id")
      .notNull()
      .references(() => trade.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tradeId, t.tagId] })],
);

/** Playbook setups / strategies. */
export const setup = pgTable("setup", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  rules: jsonb("rules").$type<string[]>().notNull().default([]),
  checklist: jsonb("checklist").$type<string[]>().notNull().default([]),
  color: text("color").notNull().default("#6366f1"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/*                          Pre-aggregated statistics                          */
/* -------------------------------------------------------------------------- */

/** Per account per trading day (user timezone). Powers calendar + dashboard. */
export const dailyStat = pgTable(
  "daily_stat",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => tradingAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    netPnl: money("net_pnl").notNull().default(0),
    grossProfit: money("gross_profit").notNull().default(0),
    grossLoss: money("gross_loss").notNull().default(0),
    commission: money("commission").notNull().default(0),
    swap: money("swap").notNull().default(0),
    trades: integer("trades").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    volume: real("volume").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.day] }),
    index("daily_stat_user_day_idx").on(t.userId, t.day),
  ],
);

/* -------------------------------------------------------------------------- */
/*                         Journal, notebook, discipline                       */
/* -------------------------------------------------------------------------- */

export const journalEntry = pgTable(
  "journal_entry",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    premarket: jsonb("premarket").$type<JournalPremarket>(),
    review: jsonb("review").$type<JournalReview>(),
    mood: integer("mood"),
    lessons: text("lessons"),
    ...timestamps,
  },
  (t) => [uniqueIndex("journal_day_uq").on(t.userId, t.day)],
);

export const note = pgTable("note", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  folder: text("folder").notNull().default("General"),
  title: text("title").notNull(),
  content: jsonb("content"),
  pinned: boolean("pinned").notNull().default(false),
  ...timestamps,
});

export const goal = pgTable("goal", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => tradingAccount.id, { onDelete: "cascade" }),
  period: text("period").$type<"DAY" | "WEEK" | "MONTH">().notNull(),
  metric: text("metric").$type<"NET_PNL" | "WIN_RATE" | "MAX_LOSS" | "MAX_TRADES" | "GREEN_DAYS">().notNull(),
  target: money("target").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const challenge = pgTable("challenge", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .notNull()
    .references(() => tradingAccount.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startBalance: money("start_balance").notNull(),
  profitTarget: money("profit_target").notNull(),
  maxDrawdown: money("max_drawdown").notNull(),
  maxDailyDrawdown: money("max_daily_drawdown"),
  minTradingDays: integer("min_trading_days"),
  /** Trailing: the floor rises with the highest balance reached. Static: fixed below the start balance. */
  trailingDrawdown: boolean("trailing_drawdown").notNull().default(false),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/*                              Sync & AI logs                                 */
/* -------------------------------------------------------------------------- */

export const syncLog = pgTable(
  "sync_log",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, { onDelete: "cascade" }),
    source: syncMethodEnum("source").notNull(),
    status: text("status").notNull(), // OK | ERROR
    message: text("message"),
    itemCount: integer("item_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sync_log_user_idx").on(t.userId, t.createdAt)],
);

/** Emails already sent, so cron runs and re-imports never send the same one twice. */
export const notificationLog = pgTable(
  "notification_log",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // WEEKLY_REPORT | GOAL_ALERT
    key: text("key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notification_log_uq").on(t.userId, t.kind, t.key)],
);

/** AI Coach chats. */
export const coachConversation = pgTable(
  "coach_conversation",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ...timestamps,
  },
  (t) => [index("coach_conversation_user_idx").on(t.userId, t.updatedAt)],
);

export const coachMessage = pgTable(
  "coach_message",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => coachConversation.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    /** Data the assistant looked up for this answer (tool names). */
    toolsUsed: jsonb("tools_used").$type<string[]>(),
    model: text("model"),
    /** Thumbs up (1) / down (-1) from the trader. */
    feedback: integer("feedback"),
    /** Pictures sent with this message (not stored, only counted). */
    images: integer("images").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("coach_message_conversation_idx").on(t.conversationId, t.createdAt)],
);

/** Things the coach remembers about the trader across chats (rules, goals, habits). */
export const coachMemory = pgTable(
  "coach_memory",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("coach_memory_user_idx").on(t.userId, t.createdAt)],
);

/** Automatic daily / weekly AI review, one per period. */
export const coachReport = pgTable(
  "coach_report",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"daily" | "weekly">().notNull(),
    /** First day of the period (YYYY-MM-DD, user timezone). */
    period: text("period").notNull(),
    language: text("language").$type<"en" | "bn">().notNull().default("en"),
    content: text("content").notNull(),
    model: text("model"),
    /** The chat that holds this review, so the trader can ask follow-ups. */
    conversationId: text("conversation_id").references(() => coachConversation.id, { onDelete: "set null" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("coach_report_period_uq").on(t.userId, t.kind, t.period)],
);

/** Economic calendar (shared by every user), refreshed from the weekly feed. */
export const economicEvent = pgTable(
  "economic_event",
  {
    /** Stable hash of title + currency + scheduled time. */
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    currency: text("currency").notNull(),
    impact: text("impact").notNull(), // High | Medium | Low | Holiday
    time: timestamp("time", { withTimezone: true }).notNull(),
    /** No exact time (e.g. "All Day", "Tentative"). */
    allDay: boolean("all_day").notNull().default(false),
    forecast: text("forecast"),
    previous: text("previous"),
    actual: text("actual"),
    source: text("source").notNull().default("forexfactory"),
    /** AI explanation per language: { en?: EventAnalysis, bn?: EventAnalysis }. */
    analysis: jsonb("analysis").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("economic_event_time_idx").on(t.time)],
);
export type EconomicEvent = typeof economicEvent.$inferSelect;

export const aiInsight = pgTable("ai_insight", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // WEEK | MONTH | RANGE | TRADE
  tradeId: text("trade_id").references(() => trade.id, { onDelete: "cascade" }),
  rangeStart: date("range_start", { mode: "string" }),
  rangeEnd: date("range_end", { mode: "string" }),
  accountIds: jsonb("account_ids").$type<string[]>(),
  content: jsonb("content").notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*                                  Relations                                  */
/* -------------------------------------------------------------------------- */

export const userRelations = relations(user, ({ many }) => ({
  tradingAccounts: many(tradingAccount),
  trades: many(trade),
}));

export const tradingAccountRelations = relations(tradingAccount, ({ one, many }) => ({
  user: one(user, { fields: [tradingAccount.userId], references: [user.id] }),
  trades: many(trade),
  deals: many(deal),
}));

export const tradeRelations = relations(trade, ({ one, many }) => ({
  account: one(tradingAccount, { fields: [trade.accountId], references: [tradingAccount.id] }),
  setup: one(setup, { fields: [trade.setupId], references: [setup.id] }),
  tags: many(tradeTag),
  images: many(tradeImage),
}));

export const tradeTagRelations = relations(tradeTag, ({ one }) => ({
  trade: one(trade, { fields: [tradeTag.tradeId], references: [trade.id] }),
  tag: one(tag, { fields: [tradeTag.tagId], references: [tag.id] }),
}));

export type User = typeof user.$inferSelect;
export type TradingAccount = typeof tradingAccount.$inferSelect;
export type Trade = typeof trade.$inferSelect;
export type Deal = typeof deal.$inferSelect;

/** Every pre-trade check, so plan can be compared with what was actually traded. */
export const pretradeLog = pgTable(
  "pretrade_log",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => tradingAccount.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    side: text("side").$type<"LONG" | "SHORT">().notNull(),
    entry: price("entry").notNull(),
    sl: price("sl"),
    tp: price("tp"),
    lots: real("lots").notNull(),
    verdict: text("verdict").$type<"ok" | "caution" | "stop">().notNull(),
    checks: jsonb("checks").$type<{ id: string; level: string; title: string }[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pretrade_log_user_idx").on(t.userId, t.createdAt)],
);

/** Browsers/phones that receive web push alerts. */
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_subscription_endpoint_uq").on(t.endpoint), index("push_subscription_user_idx").on(t.userId)],
);

/** Price candles around a trade, sent by the EA, for the replay chart. */
export const tradeCandles = pgTable("trade_candles", {
  tradeId: text("trade_id")
    .primaryKey()
    .references(() => trade.id, { onDelete: "cascade" }),
  /** Bar size in minutes. */
  timeframe: integer("timeframe").notNull(),
  /** [time (unix s, UTC), open, high, low, close][] */
  candles: jsonb("candles").$type<[number, number, number, number, number][]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every super-admin action, for accountability. */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: id(),
    adminEmail: text("admin_email").notNull(),
    action: text("action").notNull(),
    targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
    targetEmail: text("target_email"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_created_idx").on(t.createdAt), index("admin_audit_target_idx").on(t.targetUserId)],
);
