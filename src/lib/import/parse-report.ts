import { buildTradesFromDeals, type RawDeal } from "@/lib/trading/build-trades";
import { round, type Side, type TradeInput } from "@/lib/trading/metrics";
import { normalizeSymbol } from "@/lib/trading/symbols";
import type { Grid } from "./table";

export type ReportAccount = {
  login: string;
  currency: string;
  server: string | null;
  environment: "REAL" | "DEMO";
  name: string | null;
};

export type ParsedTransaction = {
  ticket: string | null;
  type: "DEPOSIT" | "WITHDRAWAL" | "CREDIT" | "BONUS" | "ADJUSTMENT";
  amount: number;
  time: Date;
  comment: string | null;
};

export type ParsedReport = {
  format: "MT5_REPORT" | "EXNESS_CSV" | "CSV";
  account: ReportAccount | null;
  trades: TradeInput[];
  deals: RawDeal[];
  transactions: ParsedTransaction[];
  warnings: string[];
};

export class ReportParseError extends Error {}

/* ───────────────────────────── helpers ───────────────────────────── */

const norm = (s: string) => s.toLowerCase().replace(/[\s_/.()-]+/g, "");

export function parseNumber(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.replace(/[\s ]/g, "").replace(/[$€£]/g, "");
  if (t === "" || t === "-") return null;
  // "1,234.56" → 1234.56 ; "1234,56" (decimal comma) → 1234.56
  const cleaned = /,\d{1,2}$/.test(t) && !t.includes(".") ? t.replace(",", ".") : t.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parses "2024.01.02 10:00:05", "2024-01-02 10:00", ISO strings. Times are broker server time + offset. */
export function parseDate(s: string | undefined, offsetHours = 0): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, se ? +se : 0);
    return new Date(utc - offsetHours * 3600_000);
  }
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function sideOf(s: string): Side | null {
  const t = s.toLowerCase();
  if (t.startsWith("buy") || t === "long" || t === "0") return "LONG";
  if (t.startsWith("sell") || t === "short" || t === "1") return "SHORT";
  return null;
}

/** Map header names (with duplicates like Time…Time) to column indices. */
function headerIndex(header: string[]) {
  const map = new Map<string, number[]>();
  header.forEach((h, i) => {
    const k = norm(h);
    if (!k) return;
    map.set(k, [...(map.get(k) ?? []), i]);
  });
  return (names: string[], occurrence = 0): number => {
    for (const n of names) {
      const hit = map.get(norm(n));
      if (hit && hit[occurrence] != null) return hit[occurrence];
    }
    return -1;
  };
}

/** Commission is always a cost, whatever sign the export uses. */
const cost = (n: number | null) => -Math.abs(n ?? 0);

const at = (row: string[], i: number) => (i >= 0 ? row[i] : undefined);

/* ───────────────────────── MT5 terminal report ───────────────────────── */

const SECTIONS = ["positions", "orders", "deals", "openpositions", "workingorders", "summary", "results"];

function sectionOf(row: string[]): string | null {
  const filled = row.filter((c) => c !== "");
  if (filled.length !== 1) return null;
  const k = norm(filled[0]);
  return SECTIONS.includes(k) ? k : null;
}

function sectionRows(grid: Grid, name: string): { header: string[]; rows: string[][] } | null {
  const start = grid.findIndex((r) => sectionOf(r) === name);
  if (start < 0) return null;
  const header = grid[start + 1] ?? [];
  const rows: string[][] = [];
  for (let i = start + 2; i < grid.length; i++) {
    const r = grid[i];
    if (sectionOf(r)) break;
    if (r.every((c) => c === "")) {
      if (rows.length) break;
      continue;
    }
    rows.push(r);
  }
  return { header, rows };
}

function parseAccountHeader(grid: Grid): ReportAccount | null {
  let name: string | null = null;
  for (const row of grid.slice(0, 30)) {
    const joined = row.filter(Boolean).join(" ");
    const n = joined.match(/^Name:?\s+(.+)$/i);
    if (n) name = n[1].trim();
    const m = joined.match(/Account:?\s*(\d{4,12})\s*\(([A-Z]{3})(?:,\s*([^,)]+))?(?:,\s*(real|demo|contest))?/i);
    if (m) {
      return {
        login: m[1],
        currency: m[2].toUpperCase(),
        server: m[3]?.trim() ?? null,
        environment: m[4]?.toLowerCase() === "demo" ? "DEMO" : "REAL",
        name,
      };
    }
  }
  return null;
}

function parseMt5Report(grid: Grid, offsetHours: number): ParsedReport {
  const warnings: string[] = [];
  const account = parseAccountHeader(grid);
  const trades: TradeInput[] = [];

  const positions = sectionRows(grid, "positions");
  if (positions) {
    const col = headerIndex(positions.header);
    const c = {
      openTime: col(["Time", "Open Time"], 0),
      position: col(["Position", "Ticket"]),
      symbol: col(["Symbol"]),
      type: col(["Type"]),
      volume: col(["Volume"]),
      openPrice: col(["Price", "Open Price"], 0),
      sl: col(["S / L", "SL"]),
      tp: col(["T / P", "TP"]),
      closeTime: col(["Time", "Close Time"], 1),
      closePrice: col(["Price", "Close Price"], 1),
      commission: col(["Commission"]),
      swap: col(["Swap"]),
      profit: col(["Profit"]),
    };
    if (c.symbol < 0 || c.type < 0 || c.profit < 0) {
      throw new ReportParseError("The Positions table has unexpected columns. Please export the report again from MT5.");
    }
    for (const r of positions.rows) {
      const side = sideOf(at(r, c.type) ?? "");
      const openTime = parseDate(at(r, c.openTime), offsetHours);
      const openPrice = parseNumber(at(r, c.openPrice));
      const symbol = at(r, c.symbol);
      if (!side || !openTime || openPrice == null || !symbol) continue;
      const closeTime = parseDate(at(r, c.closeTime), offsetHours);
      trades.push({
        positionId: at(r, c.position) || null,
        symbol: normalizeSymbol(symbol),
        side,
        openTime,
        closeTime,
        openPrice,
        closePrice: parseNumber(at(r, c.closePrice)),
        volume: parseNumber(at(r, c.volume)?.split("/")[0]) ?? 0,
        sl: parseNumber(at(r, c.sl)) || null,
        tp: parseNumber(at(r, c.tp)) || null,
        commission: cost(parseNumber(at(r, c.commission))),
        swap: parseNumber(at(r, c.swap)) ?? 0,
        grossPnl: parseNumber(at(r, c.profit)) ?? 0,
      });
    }
  }

  const deals: RawDeal[] = [];
  const transactions: ParsedTransaction[] = [];
  const dealSection = sectionRows(grid, "deals");
  if (dealSection) {
    const col = headerIndex(dealSection.header);
    const c = {
      time: col(["Time"]),
      deal: col(["Deal", "Ticket"]),
      symbol: col(["Symbol"]),
      type: col(["Type"]),
      direction: col(["Direction", "Entry"]),
      volume: col(["Volume"]),
      price: col(["Price"]),
      order: col(["Order"]),
      position: col(["Position"]),
      commission: col(["Commission"]),
      fee: col(["Fee"]),
      swap: col(["Swap"]),
      profit: col(["Profit"]),
      comment: col(["Comment"]),
    };
    for (const r of dealSection.rows) {
      const time = parseDate(at(r, c.time), offsetHours);
      const ticket = at(r, c.deal);
      const type = (at(r, c.type) ?? "").toUpperCase().replace(/\s+/g, "_");
      if (!time || !ticket || !type) continue;
      const profit = parseNumber(at(r, c.profit)) ?? 0;
      const comment = at(r, c.comment) || null;
      if (type === "BALANCE" || type === "CREDIT" || type === "BONUS") {
        transactions.push({
          ticket,
          type: type === "BALANCE" ? (profit >= 0 ? "DEPOSIT" : "WITHDRAWAL") : (type as "CREDIT" | "BONUS"),
          amount: Math.abs(profit),
          time,
          comment,
        });
      }
      const dir = (at(r, c.direction) ?? "").toUpperCase().replace(/\s+/g, "");
      deals.push({
        ticket,
        positionId: at(r, c.position) || null,
        symbol: at(r, c.symbol) ? normalizeSymbol(at(r, c.symbol)!) : null,
        type,
        entry: dir === "IN/OUT" ? "INOUT" : dir === "OUTBY" ? "OUT_BY" : dir || null,
        volume: parseNumber(at(r, c.volume)),
        price: parseNumber(at(r, c.price)),
        commission: parseNumber(at(r, c.commission)) ?? 0,
        fee: parseNumber(at(r, c.fee)) ?? 0,
        swap: parseNumber(at(r, c.swap)) ?? 0,
        profit,
        time,
      });
    }
  }

  // Some report variants only have deals (with a Position column).
  if (trades.length === 0 && deals.some((d) => d.positionId)) {
    trades.push(...buildTradesFromDeals(deals));
  }

  if (!positions && !dealSection) {
    throw new ReportParseError("Couldn't find a Positions or Deals table in this file.");
  }
  if (!account) warnings.push("Account number not found in the report header — choose the account manually.");
  return { format: "MT5_REPORT", account, trades, deals, transactions, warnings };
}

/* ─────────────────────── Exness Personal Area / generic CSV ─────────────────────── */

function parseCsvTrades(grid: Grid, offsetHours: number): ParsedReport {
  const headerRow = grid.findIndex((r) => r.filter(Boolean).length >= 4);
  if (headerRow < 0) throw new ReportParseError("The file is empty.");
  const header = grid[headerRow];
  const col = headerIndex(header);
  const isExness = col(["opening_time_utc"]) >= 0;
  // Exness PA exports are in UTC regardless of the server-time offset.
  const off = isExness ? 0 : offsetHours;

  const c = {
    position: col(["ticket", "position", "position_id", "positionid", "order", "id"]),
    symbol: col(["symbol", "instrument", "pair"]),
    side: col(["type", "side", "direction", "action"]),
    volume: col(["lots", "volume", "size", "quantity", "original_position_size"]),
    openTime: col(["opening_time_utc", "open_time", "opentime", "open time", "time"], 0),
    closeTime: col(["closing_time_utc", "close_time", "closetime", "close time"], 0),
    openPrice: col(["opening_price", "open_price", "openprice", "entry", "entry_price", "price"], 0),
    closePrice: col(["closing_price", "close_price", "closeprice", "exit", "exit_price"], 0),
    sl: col(["stop_loss", "sl", "s/l", "stoploss"]),
    tp: col(["take_profit", "tp", "t/p", "takeprofit"]),
    commission: col(["commission_usd", "commission", "commissions", "fee"]),
    swap: col(["swap_usd", "swap", "swaps", "rollover"]),
    profit: col(["profit_usd", "profit", "gross_profit", "pnl", "p&l", "pl"]),
  };
  const missing = (["symbol", "side", "openTime", "openPrice", "profit"] as const).filter((k) => c[k] < 0);
  if (missing.length) {
    throw new ReportParseError(
      `Couldn't recognise this file. Missing column(s): ${missing.join(", ")}. Use an MT5 history report or the CSV template.`,
    );
  }

  const trades: TradeInput[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  for (const r of grid.slice(headerRow + 1)) {
    const side = sideOf(at(r, c.side) ?? "");
    const openTime = parseDate(at(r, c.openTime), off);
    const openPrice = parseNumber(at(r, c.openPrice));
    const symbol = at(r, c.symbol);
    if (!side || !openTime || openPrice == null || !symbol) {
      skipped++;
      continue;
    }
    trades.push({
      positionId: at(r, c.position) || null,
      symbol: normalizeSymbol(symbol),
      side,
      openTime,
      closeTime: parseDate(at(r, c.closeTime), off),
      openPrice,
      closePrice: parseNumber(at(r, c.closePrice)),
      volume: parseNumber(at(r, c.volume)) ?? 0,
      sl: parseNumber(at(r, c.sl)) || null,
      tp: parseNumber(at(r, c.tp)) || null,
      commission: round(cost(parseNumber(at(r, c.commission))), 2),
      swap: round(parseNumber(at(r, c.swap)) ?? 0, 2),
      grossPnl: round(parseNumber(at(r, c.profit)) ?? 0, 2),
    });
  }
  if (skipped) warnings.push(`${skipped} row(s) skipped (not buy/sell trades or missing data).`);
  return { format: isExness ? "EXNESS_CSV" : "CSV", account: null, trades, deals: [], transactions: [], warnings };
}

export function parseReportGrid(grid: Grid, offsetHours = 0): ParsedReport {
  const isMt5 = grid.some((r) => {
    const s = sectionOf(r);
    return s === "positions" || s === "deals";
  });
  return isMt5 ? parseMt5Report(grid, offsetHours) : parseCsvTrades(grid, offsetHours);
}
