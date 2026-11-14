import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { syncKey } from "@/db/schema";

/** Keys look like `jrn_<43 url-safe chars>`; only a SHA-256 hash is stored. */
export function newKey() {
  const key = `jrn_${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, 10) };
}

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export async function userForKey(authHeader: string | null) {
  const m = authHeader?.match(/^Bearer\s+(jrn_[A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  const [row] = await db
    .select({ id: syncKey.id, userId: syncKey.userId, lastUsedAt: syncKey.lastUsedAt })
    .from(syncKey)
    .where(and(eq(syncKey.keyHash, hashKey(m[1])), isNull(syncKey.revokedAt)))
    .limit(1);
  return row ?? null;
}
