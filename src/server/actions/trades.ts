"use server";

import { TZDate } from "@date-fns/tz";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { setup, tag, trade, tradeImage, tradeTag, tradingAccount } from "@/db/schema";
import { deleteObjects } from "@/lib/storage";
import { computeRMultiple } from "@/lib/trading/metrics";
import { normalizeSymbol } from "@/lib/trading/symbols";
import { getCurrentUser } from "@/lib/session";
import { rebuildDailyStats, tradeRow } from "@/server/services/trades";

async function me() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

async function ownTrade(userId: string, tradeId: string) {
  const [t] = await db
    .select()
    .from(trade)
    .where(and(eq(trade.id, tradeId), eq(trade.userId, userId)))
    .limit(1);
  if (!t) throw new Error("Trade not found");
  return t;
}

const journalSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable(),
  setupId: z.string().nullable(),
  emotionBefore: z.string().max(40).nullable(),
  emotionAfter: z.string().max(40).nullable(),
  followedPlan: z.boolean().nullable(),
  notes: z.string().max(20_000),
  sl: z.number().positive().nullable(),
  isBacktest: z.boolean(),
  tagIds: z.array(z.string()).max(50),
});

export type JournalInput = z.infer<typeof journalSchema>;

export async function saveTradeJournal(tradeId: string, input: JournalInput) {
  const u = await me();
  const data = journalSchema.parse(input);
  const t = await ownTrade(u.id, tradeId);

  if (data.setupId) {
    const [s] = await db.select({ id: setup.id }).from(setup).where(and(eq(setup.id, data.setupId), eq(setup.userId, u.id)));
    if (!s) throw new Error("Setup not found");
  }
  const tagIds = data.tagIds.length
    ? (await db.select({ id: tag.id }).from(tag).where(and(eq(tag.userId, u.id), inArray(tag.id, data.tagIds)))).map((r) => r.id)
    : [];

  await db.transaction(async (tx) => {
    await tx
      .update(trade)
      .set({
        rating: data.rating,
        setupId: data.setupId,
        emotionBefore: data.emotionBefore,
        emotionAfter: data.emotionAfter,
        followedPlan: data.followedPlan,
        notes: data.notes ? { text: data.notes } : null,
        sl: data.sl,
        rMultiple: computeRMultiple(t.side, t.openPrice, t.closePrice, data.sl),
        isBacktest: data.isBacktest,
      })
      .where(eq(trade.id, tradeId));
    await tx.delete(tradeTag).where(eq(tradeTag.tradeId, tradeId));
    if (tagIds.length) await tx.insert(tradeTag).values(tagIds.map((tagId) => ({ tradeId, tagId })));
  });

  if (data.isBacktest !== t.isBacktest) await rebuildDailyStats(t.accountId);
  revalidatePath("/trades");
  revalidatePath(`/trades/${tradeId}`);
}

export async function deleteTrade(tradeId: string) {
  const u = await me();
  const t = await ownTrade(u.id, tradeId);
  const images = await db.select({ url: tradeImage.url }).from(tradeImage).where(eq(tradeImage.tradeId, tradeId));
  await db.delete(trade).where(eq(trade.id, tradeId));
  await deleteObjects(images.map((i) => i.url));
  await rebuildDailyStats(t.accountId);
  revalidatePath("/", "layout");
  redirect("/trades");
}

const TAG_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444", "#84cc16", "#64748b"];

export async function createTag(input: { name: string; kind: "TAG" | "MISTAKE" | "EMOTION"; color?: string }) {
  const u = await me();
  const name = z.string().trim().min(1).max(40).parse(input.name);
  const kind = z.enum(["TAG", "MISTAKE", "EMOTION"]).parse(input.kind);
  const color = input.color && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  const [row] = await db
    .insert(tag)
    .values({ userId: u.id, name, kind, color })
    .onConflictDoUpdate({ target: [tag.userId, tag.kind, tag.name], set: { name } })
    .returning({ id: tag.id, name: tag.name, kind: tag.kind, color: tag.color });
  revalidatePath("/tags");
  return row;
}

export async function createSetup(name: string) {
  const u = await me();
  const n = z.string().trim().min(1).max(60).parse(name);
  const [existing] = await db
    .select({ id: setup.id, name: setup.name })
    .from(setup)
    .where(and(eq(setup.userId, u.id), sql`lower(${setup.name}) = lower(${n})`))
    .limit(1);
  if (existing) return existing;
  const [row] = await db.insert(setup).values({ userId: u.id, name: n }).returning({ id: setup.id, name: setup.name });
  return row;
}

/* ───────────────────────────── Manual trades ───────────────────────────── */

const num = (msg: string) =>
  z
    .string()
    .trim()
    .min(1, msg)
    .transform(Number)
    .pipe(z.number({ message: msg }).finite(msg));
const optNum = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .pipe(z.number().finite().nullable());
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time");

const manualSchema = z
  .object({
    accountId: z.string().min(1, "Choose an account"),
    symbol: z.string().trim().min(2, "Enter a symbol").max(20),
    side: z.enum(["LONG", "SHORT"]),
    volume: num("Enter the lot size").pipe(z.number().positive("Must be more than 0")),
    openTime: localDateTime,
    openPrice: num("Enter the entry price").pipe(z.number().positive("Must be more than 0")),
    closeTime: z.string().optional(),
    closePrice: optNum,
    sl: optNum,
    tp: optNum,
    commission: optNum,
    swap: optNum,
    profit: optNum,
    isBacktest: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const closed = Boolean(v.closeTime);
    if (closed && v.closePrice == null) ctx.addIssue({ code: "custom", path: ["closePrice"], message: "Enter the exit price" });
    if (closed && v.profit == null) ctx.addIssue({ code: "custom", path: ["profit"], message: "Enter the profit / loss" });
    if (v.closeTime && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.closeTime))
      ctx.addIssue({ code: "custom", path: ["closeTime"], message: "Pick a date and time" });
    if (v.closeTime && v.closeTime < v.openTime)
      ctx.addIssue({ code: "custom", path: ["closeTime"], message: "Exit must be after entry" });
  });

export type ManualTradeState = { fieldErrors?: Record<string, string[]>; error?: string };

/** "2026-11-10T08:15" typed in the user's timezone → UTC instant. */
function zonedToUtc(local: string, tz: string) {
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, day, h, mi, 0, tz).getTime());
}

export async function createManualTrade(_: ManualTradeState, formData: FormData): Promise<ManualTradeState> {
  const u = await me();
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const v = parsed.data;

  const [account] = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(and(eq(tradingAccount.id, v.accountId), eq(tradingAccount.userId, u.id)));
  if (!account) return { fieldErrors: { accountId: ["Account not found"] } };

  const closeTime = v.closeTime ? zonedToUtc(v.closeTime, u.timezone) : null;
  const [row] = await db
    .insert(trade)
    .values({
      ...tradeRow(u.id, account.id, "MANUAL", {
        positionId: null,
        symbol: normalizeSymbol(v.symbol),
        side: v.side,
        openTime: zonedToUtc(v.openTime, u.timezone),
        closeTime,
        openPrice: v.openPrice,
        closePrice: closeTime ? v.closePrice : null,
        volume: v.volume,
        sl: v.sl,
        tp: v.tp,
        commission: -Math.abs(v.commission ?? 0),
        swap: v.swap ?? 0,
        grossPnl: closeTime ? (v.profit ?? 0) : 0,
      }),
      isBacktest: v.isBacktest === "on",
    })
    .returning({ id: trade.id });
  await rebuildDailyStats(account.id);
  revalidatePath("/", "layout");
  redirect(`/trades/${row.id}`);
}
