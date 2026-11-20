import { expect, it } from "vitest";
import { guardText } from "./guard";

it("writes the EA's line format", () => {
  const txt = guardText(
    {
      alerts: true,
      autoClose: false,
      noSlSeconds: 60,
      cooldownUntil: 1_763_600_000_000,
      cooldownReason: "Loss -$20 on XAUUSD",
      blocked: ["Daily max loss reached"],
      news: [{ start: 1_763_601_000_000, end: 1_763_602_800_000, currency: "USD", title: "CPI m/m|x\nnew" }],
    },
    1_763_599_000_000,
  );
  expect(txt).toBe(
    ["v=1", "now=1763599000", "alerts=1", "autoclose=0", "nosl=60", "cooldown=1763600000|Loss -$20 on XAUUSD", "blocked=Daily max loss reached", "news=1763601000|1763602800|USD|CPI m/m x new", "end=1", ""].join("\n"),
  );
});
