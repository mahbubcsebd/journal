import { z } from "zod";

const item = z.object({ title: z.string().min(1).max(200), detail: z.string().min(1).max(1200) });

export const reviewSchema = z.object({
  headline: z.string().min(1).max(200),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  summary: z.string().min(1).max(2000),
  strengths: z.array(item).max(6),
  weaknesses: z.array(item).max(6),
  patterns: z.array(item.extend({ evidence: z.string().max(600).default("") })).max(8),
  actions: z.array(item).min(1).max(5),
});
export type Review = z.infer<typeof reviewSchema>;

export const tradeFeedbackSchema = z.object({
  verdict: z.string().min(1).max(300),
  score: z.number().int().min(1).max(10),
  wentWell: z.array(z.string().max(400)).max(5),
  improve: z.array(z.string().max(400)).max(5),
  ruleCheck: z.string().max(800).default(""),
  nextTime: z.string().min(1).max(600),
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
