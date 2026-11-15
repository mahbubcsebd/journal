import { z } from "zod";
import type { OpenPosition } from "@/db/schema";
import type { RawDeal } from "../trading/build-trades";
import { normalizeSymbol } from "../trading/symbols";

/* ─────────────────────────────── MetaApi ─────────────────────────────── */
// Field names and enum values follow metaapi.cloud-sdk's MetatraderDeal / MetatraderPosition types.

export type MetaApiDeal = {
  id: string;
  type: string; // DEAL_TYPE_BUY | DEAL_TYPE_SELL | DEAL_TYPE_BALANCE | DEAL_TYPE_CREDIT | DEAL_TYPE_BONUS | …
  entryType?: string; // DEAL_ENTRY_IN | DEAL_ENTRY_OUT | DEAL_ENTRY_INOUT | DEAL_ENTRY_OUT_BY
  symbol?: string;
  magic?: number;
  time: Date | string;
  volume?: number;
  price?: number;
  commission?: number;
  swap?: number;
  profit: number;
  positionId?: string;
  orderId?: string;
  comment?: string;
  stopLoss?: number;
  takeProfit?: number;
};

export type MetaApiPosition = {
  id: string | number;
  type: string; // POSITION_TYPE_BUY | POSITION_TYPE_SELL
  symbol: string;
  time: Date | string;
  openPrice: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  volume: number;
  swap?: number;
  profit?: number;
  unrealizedProfit?: number;
};

const DEAL_TYPES: Record<string, string> = {
  DEAL_TYPE_BUY: "BUY",
  DEAL_TYPE_SELL: "SELL",
  DEAL_TYPE_BALANCE: "BALANCE",
  DEAL_TYPE_CREDIT: "CREDIT",
  DEAL_TYPE_BONUS: "BONUS",
};
const ENTRY: Record<string, string> = {
  DEAL_ENTRY_IN: "IN",
  DEAL_ENTRY_OUT: "OUT",
  DEAL_ENTRY_INOUT: "INOUT",
  DEAL_ENTRY_OUT_BY: "OUT_BY",
};

export function fromMetaApiDeal(d: MetaApiDeal): RawDeal | null {
  const type = DEAL_TYPES[d.type] ?? d.type.replace(/^DEAL_TYPE_/, "");
  const time = new Date(d.time);
  if (Number.isNaN(time.getTime())) return null;
  return {
    ticket: String(d.id),
    positionId: d.positionId ? String(d.positionId) : null,
    symbol: d.symbol ? normalizeSymbol(d.symbol) : null,
    type,
    entry: d.entryType ? (ENTRY[d.entryType] ?? null) : null,
    volume: d.volume ?? null,
    price: d.price ?? null,
    sl: d.stopLoss || null,
    tp: d.takeProfit || null,
    commission: d.commission ?? 0,
    swap: d.swap ?? 0,
    profit: d.profit ?? 0,
    time,
  };
}

export function fromMetaApiPosition(p: MetaApiPosition): OpenPosition {
  return {
    ticket: String(p.id),
    symbol: normalizeSymbol(p.symbol),
    side: p.type === "POSITION_TYPE_SELL" ? "SHORT" : "LONG",
    volume: p.volume,
    openPrice: p.openPrice,
    currentPrice: p.currentPrice ?? null,
    sl: p.stopLoss || null,
    tp: p.takeProfit || null,
    profit: p.unrealizedProfit ?? p.profit ?? 0,
    swap: p.swap ?? 0,
    openTime: new Date(p.time).toISOString(),
  };
}

/* ─────────────────────────────── MT5 EA ─────────────────────────────── */
// Payload sent by mql5/JournalSync.mq5. Times are UNIX seconds already converted to UTC by the EA.

// Lenient on purpose: accept numbers sent as strings, and any integer-ish
// value, so one oddly formatted field from a broker doesn't block a sync.
const num = z
  .union([z.number(), z.string().trim().regex(/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i).transform(Number)])
  .pipe(z.number().finite());
const int = num.transform(Math.trunc);
const id = z.union([z.string(), z.number()]).transform(String);

const eaDeal = z.object({
  ticket: id,
  order: id.optional(),
  position: id.optional(),
  symbol: z.string().max(64).optional().default(""),
  type: int, // ENUM_DEAL_TYPE
  entry: int.optional().default(0), // ENUM_DEAL_ENTRY
  volume: num.optional().default(0),
  price: num.optional().default(0),
  sl: num.optional().default(0),
  tp: num.optional().default(0),
  commission: num.optional().default(0),
  swap: num.optional().default(0),
  fee: num.optional().default(0),
  profit: num.optional().default(0),
  time: int.pipe(z.number().positive()),
  magic: num.optional(),
  comment: z.string().optional().transform((c) => c?.slice(0, 200)),
});
const eaPosition = z.object({
  ticket: id,
  symbol: z.string().max(64),
  type: int, // 0 buy, 1 sell
  volume: num,
  price_open: num,
  price_current: num.optional(),
  sl: num.optional().default(0),
  tp: num.optional().default(0),
  profit: num.optional().default(0),
  swap: num.optional().default(0),
  time: int.pipe(z.number().positive()),
});

export const eaPayloadSchema = z.object({
  version: int.optional(),
  login: id.pipe(z.string().trim().regex(/^\d{3,20}$/)),
  server: z.string().trim().min(1).max(120),
  company: z.string().optional(),
  // MT5 can report an empty currency right after start-up or while the market
  // is closed; the route falls back to the account's known currency.
  currency: z.string().trim().max(8).optional().default("").transform((c) => c.toUpperCase()),
  balance: num,
  equity: num,
  leverage: int.optional(),
  trade_mode: int.optional(), // 0 demo, 1 contest, 2 real
  deals: z.array(eaDeal).max(5000).default([]),
  positions: z.array(eaPosition).max(500).default([]),
});
export type EaPayload = z.infer<typeof eaPayloadSchema>;

/** "deals[3].time: Invalid input" — short enough to show on the MT5 chart. */
export function describeIssues(issues: z.core.$ZodIssue[]) {
  return issues
    .slice(0, 3)
    .map((i) => `${i.path.map((k) => (typeof k === "number" ? `[${k}]` : `.${String(k)}`)).join("").replace(/^\./, "") || "body"}: ${i.message}`)
    .join("; ");
}

/**
 * Validates an EA payload. The account fields must be valid; a deal or
 * position that isn't is skipped (and reported) instead of failing the sync.
 */
export function parseEaPayload(raw: unknown) {
  const base = eaPayloadSchema
    .omit({ deals: true, positions: true })
    .extend({ deals: z.array(z.unknown()).max(5000).default([]), positions: z.array(z.unknown()).max(500).default([]) })
    .safeParse(raw);
  if (!base.success) return { ok: false as const, error: describeIssues(base.error.issues) };

  const skipped: string[] = [];
  const deals: EaPayload["deals"] = [];
  base.data.deals.forEach((d, i) => {
    const r = eaDeal.safeParse(d);
    if (r.success) deals.push(r.data);
    else skipped.push(`deals[${i}] ${describeIssues(r.error.issues)}`);
  });
  const positions: EaPayload["positions"] = [];
  base.data.positions.forEach((p, i) => {
    const r = eaPosition.safeParse(p);
    if (r.success) positions.push(r.data);
    else skipped.push(`positions[${i}] ${describeIssues(r.error.issues)}`);
  });
  return { ok: true as const, data: { ...base.data, deals, positions } satisfies EaPayload, skipped };
}

// MQL5 ENUM_DEAL_TYPE / ENUM_DEAL_ENTRY values.
const EA_DEAL_TYPES = ["BUY", "SELL", "BALANCE", "CREDIT", "CHARGE", "CORRECTION", "BONUS", "COMMISSION", "COMMISSION_DAILY", "COMMISSION_MONTHLY", "COMMISSION_AGENT_DAILY", "COMMISSION_AGENT_MONTHLY", "INTEREST", "BUY_CANCELED", "SELL_CANCELED", "DIVIDEND", "DIVIDEND_FRANKED", "TAX"];
const EA_ENTRY = ["IN", "OUT", "INOUT", "OUT_BY"];

export function fromEaDeal(d: EaPayload["deals"][number]): RawDeal {
  return {
    ticket: d.ticket,
    positionId: d.position && d.position !== "0" ? d.position : null,
    symbol: d.symbol ? normalizeSymbol(d.symbol) : null,
    type: EA_DEAL_TYPES[d.type] ?? `TYPE_${d.type}`,
    entry: EA_ENTRY[d.entry] ?? null,
    volume: d.volume,
    price: d.price,
    sl: d.sl || null,
    tp: d.tp || null,
    commission: d.commission,
    swap: d.swap,
    fee: d.fee,
    profit: d.profit,
    time: new Date(d.time * 1000),
  };
}

export function fromEaPosition(p: EaPayload["positions"][number]): OpenPosition {
  return {
    ticket: p.ticket,
    symbol: normalizeSymbol(p.symbol),
    side: p.type === 1 ? "SHORT" : "LONG",
    volume: p.volume,
    openPrice: p.price_open,
    currentPrice: p.price_current ?? null,
    sl: p.sl || null,
    tp: p.tp || null,
    profit: p.profit,
    swap: p.swap,
    openTime: new Date(p.time * 1000).toISOString(),
  };
}
