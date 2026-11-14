"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { setup } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}

export async function createPlaybookSetup(formData: FormData) {
  const u = await me();
  const name = z.string().trim().min(1).max(60).catch("New setup").parse(formData.get("name"));
  // Setup names are unique per user: reuse an existing one instead of duplicating it.
  const [existing] = await db
    .select({ id: setup.id })
    .from(setup)
    .where(and(eq(setup.userId, u.id), sql`lower(${setup.name}) = lower(${name})`))
    .limit(1);
  if (existing) redirect(`/playbook/${existing.id}`);
  const [row] = await db.insert(setup).values({ userId: u.id, name }).returning({ id: setup.id });
  revalidatePath("/playbook");
  redirect(`/playbook/${row.id}`);
}

const patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().max(5000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  rules: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
  checklist: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
});

export async function updatePlaybookSetup(id: string, input: z.infer<typeof patch>) {
  const u = await me();
  const data = patch.parse(input);
  await db.update(setup).set(data).where(and(eq(setup.id, id), eq(setup.userId, u.id)));
  revalidatePath("/playbook");
}

export async function deletePlaybookSetup(id: string) {
  const u = await me();
  await db.delete(setup).where(and(eq(setup.id, id), eq(setup.userId, u.id)));
  revalidatePath("/playbook");
  redirect("/playbook");
}
