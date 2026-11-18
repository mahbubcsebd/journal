import { z } from "zod";

// Lenient: an answer that runs a little long (common in Bengali) is trimmed,
// not rejected. Only missing content fails validation.
const text = (max: number) => z.string().trim().min(1).transform((s) => (s.length > max ? `${s.slice(0, max - 1)}…` : s));
const optText = (max: number) => z.string().trim().default("").transform((s) => s.slice(0, max));
const list = <T extends z.ZodTypeAny>(of: T, max: number) => z.array(of).default([]).transform((a) => a.slice(0, max));

const item = z.object({ title: text(200), detail: text(1200) });

export const reviewSchema = z.object({
  headline: text(200),
  grade: z.string().trim().transform((g) => (["A", "B", "C", "D", "F"].includes(g[0]?.toUpperCase()) ? g[0].toUpperCase() : "C") as "A" | "B" | "C" | "D" | "F"),
  summary: text(2000),
  strengths: list(item, 6),
  weaknesses: list(item, 6),
  patterns: list(item.extend({ evidence: optText(600) }), 8),
  actions: z.array(item).min(1).transform((a) => a.slice(0, 5)),
});
export type Review = z.infer<typeof reviewSchema>;

export const tradeFeedbackSchema = z.object({
  verdict: text(300),
  score: z.coerce.number().transform((n) => Math.min(10, Math.max(1, Math.round(n)))),
  wentWell: list(optText(400), 5),
  improve: list(optText(400), 5),
  ruleCheck: optText(800),
  nextTime: text(600),
});
export type TradeFeedback = z.infer<typeof tradeFeedbackSchema>;

// Gemini responseSchema (OpenAPI subset) mirrors of the zod schemas above.
const S = { type: "STRING" } as const;
const ITEM = { type: "OBJECT", properties: { title: S, detail: S }, required: ["title", "detail"] } as const;

export const reviewResponseSchema = {
  type: "OBJECT",
  properties: {
    headline: S,
    grade: { type: "STRING", enum: ["A", "B", "C", "D", "F"] },
    summary: S,
    strengths: { type: "ARRAY", items: ITEM },
    weaknesses: { type: "ARRAY", items: ITEM },
    patterns: { type: "ARRAY", items: { type: "OBJECT", properties: { title: S, detail: S, evidence: S }, required: ["title", "detail", "evidence"] } },
    actions: { type: "ARRAY", items: ITEM },
  },
  required: ["headline", "grade", "summary", "strengths", "weaknesses", "patterns", "actions"],
  propertyOrdering: ["headline", "grade", "summary", "strengths", "weaknesses", "patterns", "actions"],
};

export const tradeFeedbackResponseSchema = {
  type: "OBJECT",
  properties: {
    verdict: S,
    score: { type: "INTEGER" },
    wentWell: { type: "ARRAY", items: S },
    improve: { type: "ARRAY", items: S },
    ruleCheck: S,
    nextTime: S,
  },
  required: ["verdict", "score", "wentWell", "improve", "ruleCheck", "nextTime"],
};

/* ─────────────────────────── economic news explainer ─────────────────────────── */

const DIRECTIONS = ["up", "down", "volatile", "neutral"] as const;

export const eventAnalysisSchema = z.object({
  headline: text(200),
  whatItIs: text(900),
  whyItMatters: text(900),
  scenarios: list(
    z.object({
      outcome: text(120),
      currencyEffect: text(300),
      goldEffect: optText(300),
      explanation: text(600),
    }),
    4,
  ),
  affected: list(
    z.object({
      symbol: z.string().trim().min(1).transform((s) => s.toUpperCase().slice(0, 12)),
      direction: z
        .string()
        .trim()
        .transform((d) => (DIRECTIONS.includes(d.toLowerCase() as (typeof DIRECTIONS)[number]) ? d.toLowerCase() : "volatile") as (typeof DIRECTIONS)[number]),
      ifBetter: optText(200),
    }),
    6,
  ),
  volatility: z
    .string()
    .trim()
    .transform((v) => (["low", "medium", "high"].includes(v.toLowerCase()) ? v.toLowerCase() : "medium") as "low" | "medium" | "high"),
  tradingPlan: z.array(text(300)).min(1).transform((a) => a.slice(0, 5)),
  caution: optText(400),
});
export type EventAnalysis = z.infer<typeof eventAnalysisSchema>;

export const eventAnalysisResponseSchema = {
  type: "OBJECT",
  properties: {
    headline: S,
    whatItIs: S,
    whyItMatters: S,
    scenarios: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { outcome: S, currencyEffect: S, goldEffect: S, explanation: S },
        required: ["outcome", "currencyEffect", "explanation"],
      },
    },
    affected: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { symbol: S, direction: { type: "STRING", enum: ["up", "down", "volatile", "neutral"] }, ifBetter: S },
        required: ["symbol", "direction"],
      },
    },
    volatility: { type: "STRING", enum: ["low", "medium", "high"] },
    tradingPlan: { type: "ARRAY", items: S },
    caution: S,
  },
  required: ["headline", "whatItIs", "whyItMatters", "scenarios", "affected", "volatility", "tradingPlan"],
} as const;
