"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { note } from "@/db/schema";
import { NOTE_TEMPLATES } from "@/lib/note-templates";
import { getCurrentUser } from "@/lib/session";

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}

export async function createNote(input: { folder?: string; template?: string }) {
  const u = await me();
  const tpl = NOTE_TEMPLATES.find((t) => t.key === input.template);
  const folder = z.string().trim().min(1).max(40).catch("General").parse(input.folder ?? tpl?.folder ?? "General");
  const [row] = await db
    .insert(note)
    .values({ userId: u.id, folder, title: tpl?.title ?? "Untitled", content: tpl?.doc ?? null })
    .returning({ id: note.id });
  revalidatePath("/notebook");
  return row.id;
}

const patch = z.object({
  title: z.string().trim().max(160).optional(),
  folder: z.string().trim().min(1).max(40).optional(),
  pinned: z.boolean().optional(),
  content: z.unknown().optional(),
});

export async function updateNote(id: string, input: z.infer<typeof patch>) {
  const u = await me();
  const data = patch.parse(input);
  if (data.content !== undefined && JSON.stringify(data.content).length > 500_000) throw new Error("Note is too long");
  await db
    .update(note)
    .set({ ...data, ...(data.title !== undefined ? { title: data.title || "Untitled" } : {}) })
    .where(and(eq(note.id, id), eq(note.userId, u.id)));
  revalidatePath("/notebook");
}

export async function deleteNote(id: string) {
  const u = await me();
  await db.delete(note).where(and(eq(note.id, id), eq(note.userId, u.id)));
  revalidatePath("/notebook");
}
