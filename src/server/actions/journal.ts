"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { journalEntry, user } from "@/db/schema";
import { isDay } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";

const doc = z.unknown().refine((v) => v == null || (typeof v === "object" && JSON.stringify(v).length < 200_000), "Too long");

const schema = z.object({
  premarket: z.object({
    bias: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]).nullable().optional(),
    plan: doc.optional(),
    checklist: z.record(z.string().max(120), z.boolean()).optional(),
  }),
  review: z.object({ wentWell: doc.optional(), improve: doc.optional(), lessons: doc.optional() }),
  mood: z.number().int().min(1).max(5).nullable(),
});

export type JournalInput = z.infer<typeof schema>;

export async function saveJournal(day: string, input: JournalInput) {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  if (!isDay(day)) throw new Error("Invalid day");
  const data = schema.parse(input);
  await db
    .insert(journalEntry)
    .values({ userId: u.id, day, premarket: data.premarket, review: data.review, mood: data.mood })
    .onConflictDoUpdate({
      target: [journalEntry.userId, journalEntry.day],
      set: { premarket: data.premarket, review: data.review, mood: data.mood, updatedAt: new Date() },
    });
  revalidatePath("/journal");
}

export async function deleteJournal(day: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  await db.delete(journalEntry).where(and(eq(journalEntry.userId, u.id), eq(journalEntry.day, day)));
  revalidatePath("/journal");
}

export async function saveChecklistTemplate(items: string[]) {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  const clean = z.array(z.string().trim().min(1).max(120)).max(30).parse(items);
  await db.update(user).set({ settings: { ...u.settings, dailyChecklist: clean } }).where(eq(user.id, u.id));
}
