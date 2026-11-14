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
  ...timestamps,
});

export type UserSettings = {
  weekStartsOn?: 0 | 1 | 6;
  pnlDisplay?: "money" | "r" | "percent" | "pips";
  density?: "comfortable" | "compact";
  locale?: "en" | "bn";
  /** Pre-market checklist items the user ticks every trading day. */
  dailyChecklist?: string[];
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
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("trading_account_login_uq").on(t.userId, t.login, t.server),
    index("trading_account_user_idx").on(t.userId),
  ],
);

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

export const aiInsight = pgTable("ai_insight", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // WEEK | MONTH | TRADE | CUSTOM
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
