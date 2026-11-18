import { describe, expect, it } from "vitest";
import type { ATrade } from "./analytics";
import { currenciesForSymbol, eventId, formatCountdown, isRelevant, newsTrades, parseFeed, pickCountdown, watchedCurrencies } from "./news";

describe("parseFeed", () => {
  it("parses the weekly feed and skips bad rows", () => {
    const ev = parseFeed([
      { title: "CPI m/m", country: "USD", date: "2026-11-18T08:30:00-05:00", impact: "High", forecast: "0.3%", previous: "0.2%" },
      { title: "Bank Holiday", country: "JPY", date: "2026-11-23T00:00:00-05:00", impact: "Holiday", forecast: "", previous: "" },
      { title: "Broken", country: "EUR", date: "not a date", impact: "Low" },
      { nope: 1 },
    ]);
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ title: "CPI m/m", currency: "USD", impact: "High", forecast: "0.3%", previous: "0.2%", actual: null, allDay: false });
    expect(ev[0].time.toISOString()).toBe("2026-11-18T13:30:00.000Z");
    expect(ev[0].id).toBe(eventId("CPI m/m", "USD", ev[0].time));
    expect(ev[0].id).toBe("usd-202611181330-cpi-m-m");
    expect(ev[1]).toMatchObject({ impact: "Holiday", allDay: true, forecast: null });
    expect(parseFeed({})).toEqual([]);
  });
});

describe("symbols → currencies", () => {
  it("maps forex, metals, crypto and indices", () => {
    expect(currenciesForSymbol("XAUUSDm")).toEqual(["USD"]);
    expect(currenciesForSymbol("EURJPY")).toEqual(["EUR", "JPY"]);
    expect(currenciesForSymbol("BTCUSD")).toEqual(["USD"]);
    expect(currenciesForSymbol("US30")).toEqual(["USD"]);
    expect(currenciesForSymbol("DE40")).toEqual(["EUR"]);
    expect([...watchedCurrencies(["XAUUSD", "GBPJPY"])!].sort()).toEqual(["GBP", "JPY", "USD"]);
    expect(watchedCurrencies([], ["ALL"])).toBeNull();
    expect(isRelevant({ impact: "Medium", currency: "USD" }, "High", new Set(["USD"]))).toBe(false);
    expect(isRelevant({ impact: "High", currency: "EUR" }, "Medium", null)).toBe(true);
  });
});

describe("newsTrades", () => {
  const at = Date.UTC(2026, 10, 18, 13, 30);
  const t = (symbol: string, minutes: number) => ({ id: symbol + minutes, symbol, openAt: at + minutes * 60_000 }) as ATrade;
  const events = [
    { id: "cpi", title: "CPI m/m", currency: "USD", impact: "High", time: new Date(at) },
    { id: "low", title: "Minor", currency: "EUR", impact: "Low", time: new Date(at) },
  ];
  it("flags trades opened inside the window for the symbol's currencies", () => {
    const hits = newsTrades([t("XAUUSD", -10), t("XAUUSD", 20), t("EURGBP", 0), t("EURUSD", 5)], events, { before: 15, after: 15 });
    expect(hits.map((h) => [h.trade.symbol, h.minutes])).toEqual([
      ["XAUUSD", -10],
      ["EURUSD", 5],
    ]);
  });
});

describe("countdown", () => {
  const at = Date.UTC(2026, 10, 18, 13, 30);
  const ev = [
    { id: "cpi", title: "CPI", currency: "USD", impact: "High", time: new Date(at).toISOString() },
    { id: "pmi", title: "PMI", currency: "USD", impact: "Medium", time: new Date(at + 3_600_000).toISOString() },
  ];
  it("formats and picks the live or next event", () => {
    expect(formatCountdown(2 * 86_400_000 + 3 * 3_600_000)).toBe("2d 3h");
    expect(formatCountdown(2 * 3_600_000 + 14 * 60_000)).toBe("2h 14m");
    expect(formatCountdown(14 * 60_000 + 5_000)).toBe("14:05");
    const w = { before: 15, after: 15 };
    expect(pickCountdown(ev, at - 30 * 60_000, w)).toMatchObject({ phase: "upcoming", event: { id: "cpi" } });
    expect(pickCountdown(ev, at - 10 * 60_000, w)).toMatchObject({ phase: "before", event: { id: "cpi" } });
    expect(pickCountdown(ev, at + 5 * 60_000, w)).toMatchObject({ phase: "after", event: { id: "cpi" } });
    expect(pickCountdown(ev, at + 20 * 60_000, w)).toMatchObject({ phase: "upcoming", event: { id: "pmi" } });
    expect(pickCountdown(ev, at + 2 * 3_600_000, w)).toBeNull();
  });
});
