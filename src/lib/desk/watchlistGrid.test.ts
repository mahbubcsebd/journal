import assert from "node:assert/strict";
import { test } from "vitest";
import { buildWatchlistPanes } from "./watchlistGrid";

test("buildWatchlistPanes deduplicates multi-symbol watchlist and respects MAX_PANES without mutating input", () => {
  const input = ["xauusd", "EURUSD", "GBPUSD", "EURUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD"];
  const snap = [...input];
  const panes = buildWatchlistPanes(input, "H1");
  assert.deepEqual(input, snap);
  assert.equal(panes.length, 6);
  assert.equal(panes[0].symbol, "XAUUSD");
  assert.equal(panes[0].defaultTf, "H1");
  assert.equal(panes.some((p) => p.symbol === "NZDUSD"), false);
});

test("buildWatchlistPanes fans a single symbol into M15/H1/H4 grid", () => {
  const panes = buildWatchlistPanes(["XAUUSD"], "M15");
  assert.deepEqual(
    panes.map((p) => p.defaultTf),
    ["M15", "H1", "H4"],
  );
  assert.equal(panes.every((p) => p.symbol === "XAUUSD"), true);
});

