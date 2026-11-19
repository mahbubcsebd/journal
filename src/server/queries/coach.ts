import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { coachConversation, coachMessage } from "@/db/schema";

export async function listConversations(userId: string, limit = 50) {
  return db
    .select({ id: coachConversation.id, title: coachConversation.title, updatedAt: coachConversation.updatedAt })
    .from(coachConversation)
    .where(eq(coachConversation.userId, userId))
    .orderBy(desc(coachConversation.updatedAt))
    .limit(limit);
}

export async function getConversation(userId: string, id: string) {
  const [c] = await db
    .select()
    .from(coachConversation)
    .where(and(eq(coachConversation.id, id), eq(coachConversation.userId, userId)))
    .limit(1);
  if (!c) return null;
  const messages = await db
    .select({ id: coachMessage.id, role: coachMessage.role, content: coachMessage.content, toolsUsed: coachMessage.toolsUsed, createdAt: coachMessage.createdAt })
    .from(coachMessage)
    .where(eq(coachMessage.conversationId, id))
    .orderBy(asc(coachMessage.createdAt));
  return { ...c, messages };
}

export type CoachMessageView = { id: string; role: "user" | "assistant"; content: string; toolsUsed: string[] | null };
