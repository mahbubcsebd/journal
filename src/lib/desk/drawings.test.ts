import assert from "node:assert/strict";
import { test } from "vitest";
import {
  appendDrawing,
  drawingStorageKey,
  fibLevels,
  hitTestDrawing,
  parseDrawingsJson,
  removeDrawing,
  type ChartDrawing,
} from "./drawings";

test("fibLevels computes OTE and equilibrium levels without mutating inputs", () => {
  const levels = fibLevels(4000, 4100);
  const byRatio = new Map(levels.map((l) => [l.ratio, l]));
  assert.equal(byRatio.get(0)?.price, 4100);
  assert.equal(byRatio.get(0.5)?.price, 4050);
  assert.equal(Math.abs((byRatio.get(0.618)?.price ?? 0) - 4038.2) < 1e-6, true);
  assert.equal(byRatio.get(0.705)?.isOte, true);
  assert.equal(byRatio.get(0.5)?.isOte, false);
  assert.equal(byRatio.get(1)?.price, 4000);
});

test("parseDrawingsJson filters invalid entries and preserves valid drawings", () => {
  const raw = JSON.stringify([
    { id: "1", kind: "hline", price: 4050.5 },
    { id: "bad", kind: "hline", price: "NaN" },
    { id: "2", kind: "rect", a: { time: 1000, price: 4000 }, b: { time: 2000, price: 4020 } },
    { id: "3", kind: "fib", a: { time: 1000, price: 4000 }, b: { time: 2000, price: 4100 } },
    null,
  ]);
  const list = parseDrawingsJson(raw);
  assert.equal(list.length, 3);
  assert.equal(list[0].kind, "hline");
  assert.equal(list[1].kind, "rect");
  assert.equal(list[2].kind, "fib");
  assert.equal(drawingStorageKey("xauusd"), "smc-desk.drawings.XAUUSD");
});

test("appendDrawing, removeDrawing and hitTestDrawing are pure and accurate", () => {
  const base: ChartDrawing[] = [{ id: "h1", kind: "hline", price: 4050 }];
  const withRect = appendDrawing(base, {
    id: "r1",
    kind: "rect",
    a: { time: 100, price: 4010 },
    b: { time: 200, price: 4025 },
  });
  assert.equal(base.length, 1);
  assert.equal(withRect.length, 2);

  assert.equal(hitTestDrawing(withRect, 150, 4051, 2)?.id, "h1");
  assert.equal(hitTestDrawing(withRect, 150, 4018, 2)?.id, "r1");
  assert.equal(hitTestDrawing(withRect, 300, 4018, 2), null);

  const removed = removeDrawing(withRect, "r1");
  assert.equal(removed.length, 1);
  assert.equal(withRect.length, 2);
});
