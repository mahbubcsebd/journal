import { describe, expect, it } from "vitest";
import { candlePlan, downsample } from "./replay";

const NOW = Date.parse("2026-11-20T00:00:00Z");
describe("candlePlan", () => {
  it("short recent trade → M1 with padding", () => {
    const open = Date.parse("2026-11-19T10:00:00Z");
    const p = candlePlan(open, open + 20 * 60_000, NOW);
    expect(p.tf).toBe(1);
    expect(p.from).toBe(open / 1000 - 40 * 60);
    expect(p.to).toBe(open / 1000 + 20 * 60 + 20 * 60);
  });
  it("old short trade → M5; multi-day trade → H1", () => {
    const old = Date.parse("2026-10-01T10:00:00Z");
    expect(candlePlan(old, old + 20 * 60_000, NOW).tf).toBe(5);
    expect(candlePlan(old, old + 5 * 86_400_000, NOW).tf).toBe(60);
  });
  it("never asks for the future", () => {
    expect(candlePlan(NOW - 600_000, NOW - 60_000, NOW).to).toBe(NOW / 1000);
  });
});

it("downsample merges bars keeping high/low", () => {
  const c = Array.from({ length: 10 }, (_, i) => [i, i, i + 1, i - 1, i + 0.5] as [number, number, number, number, number]);
  expect(downsample(c, 5)).toEqual([
    [0, 0, 2, -1, 1.5],
    [2, 2, 4, 1, 3.5],
    [4, 4, 6, 3, 5.5],
    [6, 6, 8, 5, 7.5],
    [8, 8, 10, 7, 9.5],
  ]);
});
