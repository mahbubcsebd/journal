import { afterEach, describe, expect, it, vi } from "vitest";
import type { ATrade } from "../analytics";
import { buildReviewContext } from "./context";
import { AiError, chatWithTools, generateJson, generateJsonWithMeta, resetModelCooldowns } from "./gemini";
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
  it("moves on to the next model when one is overloaded", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const ok = { headline: "h", grade: "A", summary: "s", strengths: [], weaknesses: [], patterns: [], actions: [{ title: "t", detail: "d" }] };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand." } }), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { name: "TimeoutError" }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ok) }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const r = await generateJsonWithMeta({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema });
    expect(fetch.mock.calls.map((c) => String(c[0]).match(/models\/([^:]+)/)![1])).toEqual(["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"]);
    expect(r.model).toBe("gemini-3.5-flash-lite");
    // The busy and silent models are skipped on the next call.
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ok) }] } }] }), { status: 200 }));
    expect((await generateJsonWithMeta({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema })).model).toBe("gemini-3.5-flash-lite");
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("falls back to Vertex AI when the Gemini API refuses the key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "AQ.test");
    const ok = { headline: "h", grade: "A", summary: "s", strengths: [], weaknesses: [], patterns: [], actions: [{ title: "t", detail: "d" }] };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "API key not valid." } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ok) }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const r = await generateJsonWithMeta({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema });
    expect(r.endpoint).toBe("vertex-ai");
    expect(String(fetch.mock.calls[1][0])).toContain("aiplatform.googleapis.com");
  });
  it("falls back to a current model when the configured one is retired, and trims long answers", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "gemini-1.0-pro");
    const long = { ...{ headline: "h".repeat(500), grade: "b+", summary: "s", strengths: [], weaknesses: [], patterns: [], actions: [{ title: "t", detail: "d" }] } };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "models/gemini-1.0-pro is not found" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(long) }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const out = await generateJson({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema });
    expect(String(fetch.mock.calls[1][0])).toContain("gemini-flash-latest");
    expect(out.headline.length).toBe(200);
    expect(out.grade).toBe("B");
  });

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
    resetModelCooldowns();
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
    vi.stubGlobal("fetch", reply(403, { error: { message: "API key expired. Please renew the API key." } }));
    await expect(generateJson({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema })).rejects.toThrow(/API key expired/);
    vi.stubGlobal("fetch", reply(200, { candidates: [{ content: { parts: [{ text: '{"headline":"x"}' }] } }] }));
    await expect(generateJson({ system: "s", prompt: "p", responseSchema: {}, validate: reviewSchema })).rejects.toBeInstanceOf(AiError);
  });
});

describe("chatWithTools streaming", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetModelCooldowns();
  });
  const sse = (...chunks: unknown[]) =>
    new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\r\n\r\n`).join(""), { status: 200, headers: { "content-type": "text/event-stream" } });

  it("runs tools, then streams the answer text in pieces", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        sse({ candidates: [{ content: { parts: [{ functionCall: { name: "get_x", args: { a: 1 } }, thoughtSignature: "s" }] } }] }),
      )
      .mockResolvedValueOnce(
        sse(
          { candidates: [{ content: { parts: [{ text: "Hello " }] } }] },
          { candidates: [{ content: { parts: [{ text: "world" }] } }] },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const events: unknown[] = [];
    const runTool = vi.fn(async () => ({ value: 42 }));
    const r = await chatWithTools({ system: "s", history: [{ role: "user", parts: [{ text: "hi" }] }], tools: [], runTool, onEvent: (e) => events.push(e) });
    expect(r.text).toBe("Hello world");
    expect(r.toolsUsed).toEqual(["get_x"]);
    expect(runTool).toHaveBeenCalledWith("get_x", { a: 1 });
    expect(events).toEqual([{ type: "tool", name: "get_x" }, { type: "text", text: "Hello " }, { type: "text", text: "world" }]);
    expect(String(fetch.mock.calls[0][0])).toContain(":streamGenerateContent?alt=sse");
    // Second call carries the model's turn (signature kept) and the tool result.
    const body = JSON.parse(fetch.mock.calls[1][1].body as string);
    expect(body.contents[1]).toEqual({ role: "model", parts: [{ functionCall: { name: "get_x", args: { a: 1 } }, thoughtSignature: "s" }] });
    expect(body.contents[2].parts[0].functionResponse).toEqual({ name: "get_x", response: { result: { value: 42 } } });
  });
});
