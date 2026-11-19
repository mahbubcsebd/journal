/**
 * Rich blocks the AI coach writes inside fenced code blocks
 * (```chart / ```table / ```cards / ```callout + one JSON object).
 * Pure parsing and validation — rendering lives in components/coach.
 */
import { z } from "zod";

const label = z.coerce.string().trim().min(1).max(80);
const cell = z.union([z.string(), z.number(), z.null()]).transform((v) => (v == null ? "" : String(v)));

const chart = z.object({
  type: z.enum(["bar", "line", "pie"]).catch("bar"),
  title: z.string().max(120).optional(),
  unit: z.enum(["money", "percent", "count", "r"]).catch("count").optional(),
  currency: z.string().max(5).optional(),
  data: z
    .array(z.object({ label, value: z.coerce.number().refine(Number.isFinite) }))
    .min(1)
    .max(40),
});

const table = z.object({
  title: z.string().max(120).optional(),
  columns: z.array(label).min(1).max(8),
  rows: z.array(z.array(cell).max(8)).max(30),
  money: z.array(z.number().int().min(0)).max(8).optional(),
});

const TONES = ["profit", "loss", "warning", "info", "neutral"] as const;
const cards = z.object({
  items: z
    .array(
      z.object({
        label,
        value: z.coerce.string().max(40),
        tone: z.enum(TONES).catch("neutral").optional(),
        sub: z.string().max(80).optional(),
      }),
    )
    .min(1)
    .max(6),
});

const callout = z.object({
  tone: z.enum(["tip", "warning", "danger", "success", "info"]).catch("info").optional(),
  title: z.string().max(120).optional(),
  text: z.string().min(1).max(1500),
});

/** A one-click button that turns advice into a setting, goal or rule. */
export const coachAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("goal"),
    metric: z.enum(["NET_PNL", "WIN_RATE", "MAX_LOSS", "MAX_TRADES", "GREEN_DAYS"]),
    period: z.enum(["DAY", "WEEK", "MONTH"]),
    target: z.coerce.number().positive().max(1e9),
    label: z.string().trim().min(1).max(100),
  }),
  z.object({ type: z.literal("checklist"), item: z.string().trim().min(2).max(140), label: z.string().trim().min(1).max(100) }),
  z.object({ type: z.literal("cooldown"), minutes: z.coerce.number().int().min(0).max(240), label: z.string().trim().min(1).max(100) }),
  z.object({
    type: z.literal("news_window"),
    before: z.coerce.number().int().min(0).max(240),
    after: z.coerce.number().int().min(0).max(240),
    label: z.string().trim().min(1).max(100),
  }),
  z.object({ type: z.literal("memory"), text: z.string().trim().min(2).max(300), label: z.string().trim().min(1).max(100) }),
]);
export type CoachAction = z.infer<typeof coachAction>;
const action = z.object({ items: z.array(z.unknown()).min(1).max(4) }).transform((v) => ({
  items: v.items.map((i) => coachAction.safeParse(i)).flatMap((r) => (r.success ? [r.data] : [])),
}));

export type ChartBlock = z.infer<typeof chart> & { kind: "chart" };
export type TableBlock = z.infer<typeof table> & { kind: "table" };
export type CardsBlock = z.infer<typeof cards> & { kind: "cards" };
export type CalloutBlock = z.infer<typeof callout> & { kind: "callout" };
export type ActionBlock = { items: CoachAction[]; kind: "action" };
export type CoachBlock = ChartBlock | TableBlock | CardsBlock | CalloutBlock | ActionBlock;

export const BLOCK_KINDS = ["chart", "table", "cards", "callout", "action"] as const;
const SCHEMAS = { chart, table, cards, callout, action } as const;

/** Lenient JSON: models sometimes add trailing commas or wrap in prose. */
function looseJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const text = raw.slice(start, end + 1);
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

/** A fenced block → typed block, or null when it isn't one of ours or is malformed. */
export function parseBlock(lang: string, raw: string): CoachBlock | null {
  const kind = lang.trim().toLowerCase() as (typeof BLOCK_KINDS)[number];
  if (!BLOCK_KINDS.includes(kind)) return null;
  const json = looseJson(raw);
  if (!json) return null;
  const r = SCHEMAS[kind].safeParse(json);
  if (!r.success) return null;
  const block = { ...r.data, kind } as CoachBlock;
  if (block.kind === "chart" && block.type === "pie") {
    // A pie of negatives makes no sense; fall back to bars.
    if (block.data.some((d) => d.value < 0)) block.type = "bar";
  }
  if (block.kind === "action" && block.items.length === 0) return null;
  if (block.kind === "table") {
    const n = block.columns.length;
    block.rows = block.rows.map((r) => (r.length >= n ? r.slice(0, n) : [...r, ...Array(n - r.length).fill("")]));
  }
  return block;
}

/** Signed number in a table cell ("-$35.20", "+1.2R", "(40)") for profit/loss colouring. */
export function cellSign(text: string): number {
  const t = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
  if (/^\(.*\)$/.test(t) || /^[−-]/.test(t) || /^[A-Z$€£¥]{0,4}\s?[−-]\d/.test(t)) return -1;
  if (/\d/.test(t) && !/^0+([.,]0+)?\D*$/.test(t.replace(/^[+$€£¥\s]+/, ""))) return /^\+/.test(t) || /^[$€£¥]?\d/.test(t) ? 1 : 0;
  return 0;
}

/** While streaming or if the model forgot to close a fence, hide the partial block. */
export function closeOpenFence(md: string) {
  const fences = md.match(/^```/gm)?.length ?? 0;
  return fences % 2 === 1 ? md + "\n```" : md;
}
