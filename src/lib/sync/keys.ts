import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { syncKey, user } from "@/db/schema";
import { blockedStatus } from "@/lib/admin";

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
    .select({ id: syncKey.id, userId: syncKey.userId, lastUsedAt: syncKey.lastUsedAt, status: user.status, statusUntil: user.statusUntil })
    .from(syncKey)
    .innerJoin(user, eq(user.id, syncKey.userId))
    .where(and(eq(syncKey.keyHash, hashKey(m[1])), isNull(syncKey.revokedAt)))
    .limit(1);
  // Paused or banned accounts stop syncing until an admin reopens them.
  if (!row || blockedStatus(row)) return null;
  return { id: row.id, userId: row.userId, lastUsedAt: row.lastUsedAt };
}
