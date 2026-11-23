import { describe, expect, it } from "vitest";
import { mapPaperTrades } from "./paper-trades";
import type { JournalTrade } from "./types";

const base: JournalTrade = {
  id: "t1",
  symbol: "XAUUSD",
  tf: "M15",
  dir: "bull",
  grade: null,
  entry: 2000,
  stop: 1990,
  target: 2030,
  rr: 3,
  digits: 2,
  createdAt: 1_700_000_000,
  filledAt: 1_700_000_600,
  closedAt: 1_700_003_600,
  status: "won",
  resultR: 2,
  emotion: "calm",
  note: "",
} as JournalTrade;

describe("mapPaperTrades", () => {
  it("maps a closed paper trade and rebuilds the exit from R", () => {
    const [row] = mapPaperTrades([{ ...base, pnlUsd: 40 }]);
    expect(row).toMatchObject({
      positionId: "smc:t1",
      side: "LONG",
      openPrice: 2000,
      closePrice: 2020,
      sl: 1990,
      grossPnl: 40,
    });
    expect(row.openTime.toISOString()).toBe(new Date(1_700_000_600_000).toISOString());
    expect(row.closeTime?.getTime()).toBe(1_700_003_600_000);
  });

  it("keeps open trades open and short exits below entry", () => {
    const [open] = mapPaperTrades([{ ...base, status: "open", closedAt: undefined, resultR: undefined }]);
    expect(open.closeTime).toBeNull();
    expect(open.closePrice).toBeNull();
    const [short] = mapPaperTrades([{ ...base, dir: "bear", stop: 2010, resultR: 1 }]);
    expect(short.side).toBe("SHORT");
    expect(short.closePrice).toBe(1990);
  });

  it("skips MT5 copies, pending and cancelled orders without mutating input", () => {
    const input = [
      { ...base, id: "a", source: "mt5" as const },
      { ...base, id: "b", status: "pending" as const },
      { ...base, id: "c", status: "cancelled" as const },
      { ...base, id: "d" },
    ];
    const snapshot = structuredClone(input);
    expect(mapPaperTrades(input).map((r) => r.positionId)).toEqual(["smc:d"]);
    expect(input).toEqual(snapshot);
  });
});
