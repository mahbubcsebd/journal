"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { syncKey } from "@/db/schema";
import { newKey } from "@/lib/sync/keys";
import { getCurrentUser } from "@/lib/session";

/** Creates a sync key and returns it once — it can't be shown again. */
export async function createSyncKey(name = "MT5 EA") {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  const k = newKey();
  await db.insert(syncKey).values({ userId: u.id, name: name.slice(0, 60), prefix: k.prefix, keyHash: k.hash });
  revalidatePath("/accounts");
  return k.key;
}

export async function revokeSyncKey(id: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  await db.update(syncKey).set({ revokedAt: new Date() }).where(and(eq(syncKey.id, id), eq(syncKey.userId, u.id)));
  revalidatePath("/accounts");
}
