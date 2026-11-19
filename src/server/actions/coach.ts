"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { coachConversation } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

export async function deleteConversation(id: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const cid = z.string().min(1).max(64).parse(id);
  await db.delete(coachConversation).where(and(eq(coachConversation.id, cid), eq(coachConversation.userId, user.id)));
  return { ok: true as const };
}

export async function renameConversation(id: string, title: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const t = z.string().trim().min(1).max(80).parse(title);
  await db
    .update(coachConversation)
    .set({ title: t })
    .where(and(eq(coachConversation.id, z.string().min(1).max(64).parse(id)), eq(coachConversation.userId, user.id)));
  return { ok: true as const };
}
