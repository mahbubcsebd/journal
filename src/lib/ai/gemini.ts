import "server-only";
import type { z } from "zod";

/**
 * Minimal Gemini REST client (no SDK). The key is sent in the
 * `x-goog-api-key` header; `GEMINI_BASE_URL` exists so tests can point at a
 * local mock server.
 */
export class AiError extends Error {
  constructor(
    message: string,
    public code: "NOT_CONFIGURED" | "RATE_LIMITED" | "BAD_KEY" | "BAD_RESPONSE" | "UNAVAILABLE",
  ) {
    super(message);
  }
}

// "gemini-flash-latest" always points at Google's current Flash model, so the
// app keeps working when a pinned version is retired. GEMINI_MODEL overrides it.
const DEFAULT_MODEL = "gemini-flash-latest";
// Busy, retired or slow models fall through to the next; the lite model is
// the fast, high-capacity last resort.
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"];
/** Per-model wait: a few attempts must fit in a 60-second function. */
const ATTEMPT_TIMEOUT_MS = 18_000;
/** Statuses where another model may succeed: retired, quota/rate, overloaded. */
const TRY_NEXT = new Set([404, 429, 500, 502, 503, 504]);

/** Models that were busy or silent recently are skipped for a few minutes (per server instance). */
const COOLDOWN_MS = 5 * 60_000;
const coolingUntil = new Map<string, number>();
const cooling = (model: string) => (coolingUntil.get(model) ?? 0) > Date.now();
const coolDown = (model: string) => coolingUntil.set(model, Date.now() + COOLDOWN_MS);
/** Tests only: forget which models were cooling down. */
export const resetModelCooldowns = () => coolingUntil.clear();

export const aiModel = () => process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
export const aiConfigured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

/** Google's own error text, e.g. "API key expired. Please renew the API key." */
async function googleMessage(res: Response) {
  const body = await res.text().catch(() => "");
  try {
    const m = (JSON.parse(body) as { error?: { message?: string } }).error?.message;
    if (m) return m.slice(0, 300);
  } catch {}
  return body.slice(0, 300);
}

type Endpoint = { name: "gemini-api" | "vertex-ai"; url: (model: string, stream?: boolean) => string };

/**
 * Google serves Gemini from two APIs. AI Studio keys ("AIza…") work on the
 * Gemini API; Vertex AI express-mode keys (often "AQ.…") work on Vertex AI.
 * Try the Gemini API first and fall back to Vertex AI if the key is refused.
 */
function endpoints(): Endpoint[] {
  const custom = process.env.GEMINI_BASE_URL?.replace(/\/$/, "");
  const method = (stream?: boolean) => (stream ? "streamGenerateContent?alt=sse" : "generateContent");
  if (custom) return [{ name: "gemini-api", url: (m, st) => `${custom}/v1beta/models/${encodeURIComponent(m)}:${method(st)}` }];
  return [
    {
      name: "gemini-api",
      url: (m, st) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:${method(st)}`,
    },
    {
      name: "vertex-ai",
      url: (m, st) => `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(m)}:${method(st)}`,
    },
  ];
}

export type AiMeta = { endpoint: Endpoint["name"]; model: string };

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  validate: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  return (await generateJsonWithMeta(opts)).data;
}

export type GeminiPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
};
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GeminiReply = {
  candidates?: { content?: { role?: string; parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

/**
 * One generateContent call with the shared resilience: configured model,
 * then fallbacks on busy/retired/slow models, Gemini API then Vertex AI.
 */
export async function callGemini(body: Record<string, unknown>, budgetMs = 50_000): Promise<{ reply: GeminiReply } & AiMeta> {
  const { res, ...used } = await openGemini(body, budgetMs, false);
  const reply = (await res.json()) as GeminiReply;
  if (reply.promptFeedback?.blockReason) throw new AiError("Gemini declined to answer this request.", "BAD_RESPONSE");
  return { reply, ...used };
}

/** Wait this long for a streamed answer to start; the stream itself may take longer. */
const STREAM_START_MS = 18_000;

/**
 * Streamed call: same fallbacks, then the answer's parts arrive as server-sent
 * events. Text is passed to `onText` as it comes; all parts are returned.
 */
export async function streamGemini(
  body: Record<string, unknown>,
  onText: (t: string) => void,
  budgetMs = 50_000,
): Promise<{ parts: GeminiPart[] } & AiMeta> {
  const started = Date.now();
  const { res, ...used } = await openGemini(body, budgetMs, true);
  const parts: GeminiPart[] = [];
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  const left = () => budgetMs - (Date.now() - started);
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const json = line.slice(5).trim();
    if (!json || json === "[DONE]") return;
    let chunk: GeminiReply;
    try {
      chunk = JSON.parse(json) as GeminiReply;
    } catch {
      return;
    }
    if (chunk.promptFeedback?.blockReason) throw new AiError("Gemini declined to answer this request.", "BAD_RESPONSE");
    for (const p of chunk.candidates?.[0]?.content?.parts ?? []) {
      parts.push(p);
      if (p.text && !p.thought && !p.functionCall) onText(p.text);
    }
  };
  for (;;) {
    const timer = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new AiError("Gemini stopped answering midway. Please try again.", "UNAVAILABLE")), Math.max(1_000, Math.min(STREAM_START_MS, left()))),
    );
    const { value, done } = await Promise.race([reader.read(), timer]);
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      handle(buf.slice(0, i).replace(/\r$/, ""));
      buf = buf.slice(i + 1);
    }
  }
  if (buf.trim()) handle(buf.trim());
  return { parts: mergeText(parts), ...used };
}

/** Streams split text into many parts; join neighbours (keeping signatures and calls). */
function mergeText(parts: GeminiPart[]) {
  const out: GeminiPart[] = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    const plain = (x: GeminiPart) => x.text != null && !x.functionCall && !x.thought;
    if (prev && plain(prev) && plain(p) && !p.thoughtSignature) prev.text += p.text!;
    else out.push({ ...p });
  }
  return out;
}

async function openGemini(body: Record<string, unknown>, budgetMs: number, stream: boolean): Promise<{ res: Response } & AiMeta> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AiError("AI isn't set up yet. Add GEMINI_API_KEY to the server environment.", "NOT_CONFIGURED");
  const payload = JSON.stringify(body);
  const models = [...new Set([aiModel(), ...FALLBACK_MODELS])];
  const apis = endpoints();
  let res: Response | null = null;
  let used: AiMeta | null = null;
  let timedOut = 0;
  const started = Date.now();
  apis: for (const [ai, api] of apis.entries()) {
    for (const [mi, model] of models.entries()) {
      const last = mi === models.length - 1;
      if (cooling(model) && !last) continue;
      // Stay inside the function's time limit.
      if (Date.now() - started > budgetMs) break apis;
      try {
        // Time out waiting for the answer to start, never in the middle of reading it.
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), last ? 25_000 : stream ? STREAM_START_MS : ATTEMPT_TIMEOUT_MS);
        try {
          res = await fetch(api.url(model, stream), {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: payload,
            signal: ctl.signal,
          });
        } finally {
          if (stream) clearTimeout(t);
        }
        if (!stream) {
          // A slow body still counts against this model's time.
          const text = await res.text().finally(() => clearTimeout(t));
          res = new Response(text, { status: res.status, headers: res.headers });
        }
      } catch (e) {
        timedOut++;
        coolDown(model);
        console.warn(`[ai] ${api.name}: ${model} gave no answer in time`, e instanceof Error ? e.name : e);
        res = null;
        continue;
      }
      used = { endpoint: api.name, model };
      if (TRY_NEXT.has(res.status) && res.status !== 404) coolDown(model);
      if (TRY_NEXT.has(res.status) && !last) {
        console.warn(`[ai] ${api.name}: ${model} → ${res.status} ${await googleMessage(res)}; trying the next model`);
        continue;
      }
      // Key refused by this API: it may belong to the other one.
      if ((res.status === 401 || res.status === 403) && ai < apis.length - 1) {
        console.warn(`[ai] ${api.name} refused the key (${res.status}): ${await googleMessage(res)}; trying ${apis[ai + 1].name}`);
        continue apis;
      }
      break apis;
    }
  }
  if (!res || !used)
    throw new AiError(
      timedOut ? "Gemini is very busy right now and didn't answer in time. Please try again in a minute." : "Couldn't reach Gemini. Please try again.",
      "UNAVAILABLE",
    );

  if (!res.ok) {
    const msg = await googleMessage(res);
    console.error(`[ai] ${used.endpoint} ${used.model} ${res.status}: ${msg}`);
    if (res.status === 429) throw new AiError(`Gemini's free-tier limit was reached. Wait a minute and try again. (${msg})`, "RATE_LIMITED");
    if (/api[ _-]?key|API_KEY|permission|unauthori[sz]ed|credential/i.test(msg) || res.status === 401 || res.status === 403)
      throw new AiError(`Google rejected the Gemini API key: ${msg}`, "BAD_KEY");
    if (res.status === 404) throw new AiError(`No Gemini model was found for this key (tried ${models.join(", ")}): ${msg}`, "UNAVAILABLE");
    if (res.status === 400) throw new AiError(`Gemini rejected the request: ${msg}`, "BAD_RESPONSE");
    throw new AiError(`Gemini is unavailable right now (${res.status}): ${msg}`, "UNAVAILABLE");
  }
  return { res, ...used };
}

export async function generateJsonWithMeta<T>(opts: {
  system: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  validate: z.ZodType<T>;
  temperature?: number;
}): Promise<{ data: T } & AiMeta> {
  const { reply: json, ...used } = await callGemini({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
    },
  });
  const text =
    json.candidates?.[0]?.content?.parts
      ?.filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("") ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    console.error("[ai] unreadable answer", json.candidates?.[0]?.finishReason, text.slice(0, 300));
    throw new AiError("Gemini returned an unreadable answer. Try again.", "BAD_RESPONSE");
  }
  const out = opts.validate.safeParse(parsed);
  if (!out.success) {
    console.error("[ai] answer failed validation", out.error.issues.slice(0, 3));
    throw new AiError("Gemini's answer was incomplete. Try again.", "BAD_RESPONSE");
  }
  return { data: out.data, ...used };
}

export type ToolDeclaration = { name: string; description: string; parameters?: Record<string, unknown> };

/**
 * Chat with function calling: the model may call tools (run on our server
 * against the user's own data) several times before writing its answer.
 */
export async function chatWithTools(opts: {
  system: string;
  history: GeminiContent[];
  tools: ToolDeclaration[];
  runTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  maxSteps?: number;
  budgetMs?: number;
  /** Stream: text as it is written, and each tool as it is called. */
  onEvent?: (e: { type: "text"; text: string } | { type: "tool"; name: string }) => void;
}): Promise<{ text: string; toolsUsed: string[] } & AiMeta> {
  const contents = [...opts.history];
  const toolsUsed: string[] = [];
  const started = Date.now();
  const budget = opts.budgetMs ?? 100_000;
  let meta: AiMeta | null = null;
  // While streaming, the reader sees text from every step, so that is what is saved.
  let streamed = "";
  for (let step = 0; step < (opts.maxSteps ?? 6); step++) {
    const left = budget - (Date.now() - started);
    if (left < 8_000) break;
    const last = step === (opts.maxSteps ?? 6) - 1 || left < 25_000;
    const body = {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents,
      // On the last step, no more tools: the model must answer.
      ...(last ? {} : { tools: [{ functionDeclarations: opts.tools }] }),
      generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
    };
    const onEvent = opts.onEvent;
    let parts: GeminiPart[];
    if (onEvent) {
      const r = await streamGemini(
        body,
        (t) => {
          streamed += t;
          onEvent({ type: "text", text: t });
        },
        left - 5_000,
      );
      parts = r.parts;
      meta = { endpoint: r.endpoint, model: r.model };
    } else {
      const { reply, ...used } = await callGemini(body, Math.min(50_000, left - 5_000));
      meta = used;
      parts = reply.candidates?.[0]?.content?.parts ?? [];
    }
    const used = meta;
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      const text = parts
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join("")
        .trim();
      if (!text) throw new AiError("Gemini returned an empty answer. Try again.", "BAD_RESPONSE");
      return { text: onEvent ? streamed.trim() : text, toolsUsed, ...used };
    }
    if (onEvent && streamed && !streamed.endsWith("\n\n")) {
      streamed += "\n\n";
      onEvent({ type: "text", text: "\n\n" });
    }
    // Keep the model's turn as-is (thought signatures included), then answer each call.
    contents.push({ role: "model", parts });
    const responses: GeminiPart[] = [];
    for (const c of calls) {
      const name = c.functionCall!.name;
      toolsUsed.push(name);
      opts.onEvent?.({ type: "tool", name });
      let result: unknown;
      try {
        result = await opts.runTool(name, c.functionCall!.args ?? {});
      } catch (e) {
        console.error(`[ai] tool ${name} failed`, e);
        result = { error: e instanceof Error ? e.message : "Tool failed" };
      }
      responses.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  if (!meta) throw new AiError("Gemini didn't answer in time. Please try again.", "UNAVAILABLE");
  throw new AiError("This question needed too many lookups. Try asking something narrower.", "BAD_RESPONSE");
}
