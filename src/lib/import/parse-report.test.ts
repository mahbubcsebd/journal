import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseReportFile } from "./index";
import { parseDate, parseNumber } from "./parse-report";

const fixture = readFileSync(join(__dirname, "__fixtures__/mt5-report.html"), "utf8");

function utf16(text: string) {
  const buf = Buffer.from("﻿" + text, "utf16le");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("MT5 HTML report", () => {
  it("parses a UTF-16 report with hidden spacer cells", async () => {
    const r = await parseReportFile("ReportHistory-12345678.html", utf16(fixture));
    expect(r.format).toBe("MT5_REPORT");
    expect(r.account).toEqual({
      login: "12345678",
      currency: "USD",
      server: "Exness-MT5Real8",
      environment: "REAL",
      name: "Mahbub Test",
    });
    expect(r.trades).toHaveLength(3);
    const [gold, eur, jpy] = r.trades;
    expect(gold).toMatchObject({
      positionId: "1001",
      symbol: "XAUUSD",
      side: "LONG",
      volume: 0.1,
      openPrice: 2650.5,
      closePrice: 2660.5,
      sl: 2645.5,
      tp: 2660.5,
      commission: -0.7,
      grossPnl: 100,
    });
    expect(gold.openTime.toISOString()).toBe("2026-11-10T08:15:03.000Z");
    expect(eur).toMatchObject({ side: "SHORT", tp: null, swap: -1.25, grossPnl: -200 });
    expect(jpy).toMatchObject({ symbol: "USDJPY", sl: null });
  });

  it("extracts deposits and withdrawals from the deals table", async () => {
    const r = await parseReportFile("r.html", utf16(fixture));
    expect(r.transactions).toEqual([
      expect.objectContaining({ ticket: "9000", type: "DEPOSIT", amount: 1000 }),
      expect.objectContaining({ ticket: "9010", type: "WITHDRAWAL", amount: 50 }),
    ]);
    expect(r.deals.filter((d) => d.type === "BUY" || d.type === "SELL")).toHaveLength(2);
    expect(r.deals[1]).toMatchObject({ entry: "IN", symbol: "XAUUSD", commission: -0.35 });
  });

  it("applies a server-time offset", async () => {
    const r = await parseReportFile("r.html", utf16(fixture), 2);
    expect(r.trades[0].openTime.toISOString()).toBe("2026-11-10T06:15:03.000Z");
  });
});

describe("CSV", () => {
  it("parses an Exness Personal Area export", async () => {
    const csv = [
      "ticket,opening_time_utc,closing_time_utc,type,lots,original_position_size,symbol,opening_price,closing_price,stop_loss,take_profit,commission_usd,swap_usd,profit_usd,equity_usd,margin_level,close_reason",
      "777,2026-11-03T10:00:00.000Z,2026-11-03T11:30:00.000Z,sell,0.2,0.2,GBPUSDm,1.29000,1.28500,1.29200,0,1.4,0,100,1100,,tp",
      "778,2026-11-03T12:00:00.000Z,,buy,0.1,0.1,BTCUSDm,90000,,,,0,0,0,1100,,",
    ].join("\n");
    const r = await parseReportFile("history.csv", new TextEncoder().encode(csv).buffer as ArrayBuffer);
    expect(r.format).toBe("EXNESS_CSV");
    expect(r.trades[0]).toMatchObject({
      positionId: "777",
      symbol: "GBPUSD",
      side: "SHORT",
      sl: 1.292,
      tp: null,
      commission: -1.4,
      grossPnl: 100,
    });
    expect(r.trades[1].closeTime).toBeNull();
  });

  it("explains which columns are missing", async () => {
    const csv = "foo,bar,baz,qux\n1,2,3,4\n";
    await expect(parseReportFile("x.csv", new TextEncoder().encode(csv).buffer as ArrayBuffer)).rejects.toThrow(/Missing column/);
  });
});

describe("number and date parsing", () => {
  it("handles MT5 number formats", () => {
    expect(parseNumber("1 234.56")).toBe(1234.56);
    expect(parseNumber("-0.70")).toBe(-0.7);
    expect(parseNumber("1,234.50")).toBe(1234.5);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("")).toBeNull();
  });
  it("handles MT5 dates", () => {
    expect(parseDate("2026.01.02 03:04")?.toISOString()).toBe("2026-01-02T03:04:00.000Z");
    expect(parseDate("nope")).toBeNull();
  });
});
