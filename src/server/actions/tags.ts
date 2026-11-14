"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { tag } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

const patch = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export async function updateTag(id: string, input: z.infer<typeof patch>) {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  const data = patch.parse(input);
  try {
    await db.update(tag).set(data).where(and(eq(tag.id, id), eq(tag.userId, u.id)));
  } catch {
    return { error: "A tag with that name already exists" };
  }
  revalidatePath("/tags");
  return { ok: true };
}

export async function deleteTag(id: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  await db.delete(tag).where(and(eq(tag.id, id), eq(tag.userId, u.id)));
  revalidatePath("/tags");
}
