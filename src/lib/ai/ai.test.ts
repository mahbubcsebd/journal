import { afterEach, describe, expect, it, vi } from "vitest";
import type { ATrade } from "../analytics";
import { buildReviewContext } from "./context";
import { AiError, generateJson } from "./gemini";
import { reviewResponseSchema, reviewSchema } from "./schemas";

const t = (o: Partial<ATrade>): ATrade => ({
  id: Math.random().toString(36).slice(2),
  day: "2026-11-02",
  hour: 9,
  weekday: 1,
  symbol: "XAUUSD",
  side: "LONG",
  session: "LONDON",
  net: 0,
  commission: 0,
  swap: 0,
  volume: 0.1,
  durationSec: 600,
  rMultiple: 1,
  setup: "Breakout",
  setupId: "s1",
  tags: [],
  emotionBefore: "Calm",
  followedPlan: true,
  rating: 4,
  accountName: "Gold scalping #81234567",
  openAt: 0,
  closeAt: 600_000,
  ...o,
});

describe("buildReviewContext", () => {
  const trades = [t({ id: "a", net: 120, rMultiple: 2 }), t({ id: "b", net: -60, rMultiple: -1, tags: [{ name: "FOMO", kind: "MISTAKE" }] }), t({ id: "c", net: 40, symbol: "EURUSD" })];
  const ctx = buildReviewContext({
    periodLabel: "Week of Nov 2",
    currency: "USD",
    trades,
    journal: [{ day: "2026-11-02", mood: 4, lessons: "Wait for the retest." }],
    notes: [{ id: "b", text: "Chased the move after the news candle." }],
    goals: ["Daily Max loss: 100"],
  });
  it("summarises without leaking account names or ids", () => {
    const json = JSON.stringify(ctx);
    expect(json).not.toContain("81234567");
    expect(json).not.toContain("Gold scalping");
    expect(ctx.overall).toMatchObject({ trades: 3, net: 100, winRate: 67, tradingDays: 1 });
    expect(ctx.byMistake[0]).toMatchObject({ key: "FOMO", net: -60 });
  });
  it("attaches notes to notable trades and keeps journal text", () => {
    expect(ctx.notableTrades.find((x) => x.net === -60)?.note).toContain("Chased");
    expect(ctx.journal[0].lessons).toBe("Wait for the retest.");
  });
});

describe("generateJson", () => {
  const review = {
    headline: "Solid week",
    grade: "B",
    summary: "Good risk control.",
    strengths: [{ title: "Stops", detail: "Every trade had one." }],
    weaknesses: [],
    patterns: [{ title: "London", detail: "Best session", evidence: "+$300 in London" }],
    actions: [{ title: "Max 3 trades", detail: "Stop after three trades a day." }],
  };
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends the key in a header and parses JSON output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetch = reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(review) }] } }] });
    vi.stubGlobal("fetch", fetch);
    const out = await generateJson({ system: "s", prompt: "p", responseSchema: reviewResponseSchema, validate: reviewSchema });
    expect(out.grade).toBe("B");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body as string).generationConfig.responseMimeType).toBe("application/json");
  });

  it("explains missing keys, rate limits and malformed answers", async () => {
    await expect(generateJson({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", reply(429, {}));
    await expect(generateJson({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    vi.stubGlobal("fetch", reply(400, { error: { message: "API key not valid" } }));
    await expect(generateJson({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema })).rejects.toMatchObject({ code: "BAD_KEY" });
    vi.stubGlobal("fetch", reply(200, { candidates: [{ content: { parts: [{ text: '{"headline":"x"}' }] } }] }));
    await expect(generateJson({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema })).rejects.toBeInstanceOf(AiError);
  });
});
