import { describe, expect, it } from "vitest";
import type { ATrade } from "./analytics";
import { sessionStats } from "./session-stats";

let n = 0;
const t = (session: string, net: number, symbol = "XAUUSD", weekday = 2): ATrade =>
  ({ id: String(n++), session, net, symbol, weekday, durationSec: 600, day: "2026-11-17", hour: 10, side: "LONG", openAt: 0, closeAt: 0, tags: [] }) as unknown as ATrade;

describe("sessionStats", () => {
  const trades = [
    ...Array.from({ length: 6 }, () => t("LONDON", 20)),
    t("LONDON", -10, "EURUSD"),
    ...Array.from({ length: 5 }, () => t("NEW_YORK", -15, "XAUUSD", 4)),
    t("NEW_YORK", 5, "US30"),
    t("ASIA", 3),
  ];
  const s = sessionStats(trades);
  it("aggregates per session in a fixed order", () => {
    expect(s.rows.map((r) => r.key)).toEqual(["ASIA", "LONDON", "LONDON_NY_OVERLAP", "NEW_YORK", "OFF_HOURS"]);
    const london = s.rows[1];
    expect(london).toMatchObject({ trades: 7, wins: 6, losses: 1, net: 110 });
    expect(london.profitFactor).toBe(12);
    expect(london.share).toBeCloseTo(7 / 14);
    expect(london.best).toEqual({ symbol: "XAUUSD", net: 120, trades: 6 });
    expect(london.worst).toEqual({ symbol: "EURUSD", net: -10, trades: 1 });
    expect(s.rows[3].weekday[4]).toBe(-75);
  });
  it("names the best and worst sessions and where losses come from", () => {
    expect(s.best?.key).toBe("LONDON");
    expect(s.worst?.key).toBe("NEW_YORK");
    expect(s.lossShare?.row.key).toBe("NEW_YORK");
    expect(s.lossShare?.share).toBeCloseTo(75 / 85);
  });
  it("needs 5 trades before calling a session best", () => {
    expect(sessionStats([t("ASIA", 10)]).best).toBeNull();
  });
});
