"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { adminAudit, session, syncKey, user } from "@/db/schema";
import { isSuperAdmin } from "@/lib/admin";
import { requireSuperAdmin } from "@/server/admin/guard";

type Result = { ok: true; message: string } | { ok: false; error: string };

async function target(id: string) {
  const [u] = await db.select({ id: user.id, email: user.email, status: user.status }).from(user).where(eq(user.id, z.string().min(1).max(64).parse(id))).limit(1);
  return u ?? null;
}

async function audit(adminEmail: string, action: string, t: { id: string; email: string }, details?: Record<string, unknown>) {
  await db.insert(adminAudit).values({ adminEmail, action, targetUserId: t.id, targetEmail: t.email, details: details ?? null });
}

const statusInput = z.discriminatedUnion("status", [
  z.object({ status: z.literal("active") }),
  z.object({ status: z.literal("paused"), reason: z.string().trim().max(300).optional(), days: z.number().int().min(0).max(365) }),
  z.object({ status: z.literal("banned"), reason: z.string().trim().min(2, "Write a reason").max(300) }),
]);

/** Pause (optionally for N days), ban, or reopen an account. Pausing or banning signs the user out everywhere. */
export async function setUserStatus(userId: string, input: z.input<typeof statusInput>): Promise<Result> {
  const admin = await requireSuperAdmin();
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const t = await target(userId);
  if (!t) return { ok: false, error: "User not found." };
  const v = parsed.data;
  if (v.status !== "active" && (t.id === admin.id || isSuperAdmin(t.email))) return { ok: false, error: "Super admins can't be paused or banned here." };
  const until = v.status === "paused" && v.days > 0 ? new Date(Date.now() + v.days * 86_400_000) : null;
  await db
    .update(user)
    .set({
      status: v.status,
      statusReason: v.status === "active" ? null : (v.reason ?? null) || null,
      statusUntil: until,
      statusChangedAt: new Date(),
    })
    .where(eq(user.id, t.id));
  let sessions = 0;
  if (v.status !== "active") sessions = (await db.delete(session).where(eq(session.userId, t.id)).returning({ id: session.id })).length;
  await audit(admin.email, v.status === "active" ? "reopen" : v.status === "paused" ? "pause" : "ban", t, {
    from: t.status,
    reason: v.status === "active" ? undefined : v.reason,
    until: until?.toISOString(),
    sessionsEnded: sessions,
  });
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message:
      v.status === "active"
        ? `${t.email} can use Journal again.`
        : v.status === "paused"
          ? `${t.email} is paused${until ? ` until ${until.toISOString().slice(0, 10)}` : ""}.`
          : `${t.email} is banned.`,
  };
}

export async function signOutEverywhere(userId: string): Promise<Result> {
  const admin = await requireSuperAdmin();
  const t = await target(userId);
  if (!t) return { ok: false, error: "User not found." };
  const n = (await db.delete(session).where(eq(session.userId, t.id)).returning({ id: session.id })).length;
  await audit(admin.email, "sign_out_everywhere", t, { sessions: n });
  revalidatePath(`/admin/users/${t.id}`);
  return { ok: true, message: `Signed out of ${n} session${n === 1 ? "" : "s"}.` };
}

export async function revokeUserSyncKey(userId: string, keyId: string): Promise<Result> {
  const admin = await requireSuperAdmin();
  const t = await target(userId);
  if (!t) return { ok: false, error: "User not found." };
  const done = await db
    .update(syncKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(syncKey.id, z.string().max(64).parse(keyId)), eq(syncKey.userId, t.id), isNull(syncKey.revokedAt)))
    .returning({ prefix: syncKey.prefix });
  if (!done.length) return { ok: false, error: "Key not found or already revoked." };
  await audit(admin.email, "revoke_sync_key", t, { prefix: done[0].prefix });
  revalidatePath(`/admin/users/${t.id}`);
  return { ok: true, message: "Sync key revoked. The EA stops syncing until the user makes a new key." };
}
