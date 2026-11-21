/**
 * Super admins and account status. Pure — no I/O.
 * Super admins are listed by email in SUPER_ADMIN_EMAILS (comma separated),
 * so nobody can make themselves an admin from inside the app.
 */
export type UserStatus = "active" | "paused" | "banned";

export function superAdminEmails(env = process.env.SUPER_ADMIN_EMAILS) {
  return new Set(
    (env ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const isSuperAdmin = (email: string | null | undefined, env?: string) => Boolean(email) && superAdminEmails(env).has(email!.toLowerCase());

/** Blocked right now? A pause with an end date lifts by itself. */
export function blockedStatus(u: { status?: string | null; statusUntil?: Date | null }, now = Date.now()): Exclude<UserStatus, "active"> | null {
  if (u.status === "banned") return "banned";
  if (u.status === "paused" && (!u.statusUntil || u.statusUntil.getTime() > now)) return "paused";
  return null;
}

export function blockedMessage(u: { status?: string | null; statusUntil?: Date | null; statusReason?: string | null }, now = Date.now()) {
  const s = blockedStatus(u, now);
  if (!s) return null;
  const why = u.statusReason ? ` Reason: ${u.statusReason}` : "";
  if (s === "banned") return `This account has been banned.${why}`;
  const until = u.statusUntil ? ` until ${u.statusUntil.toISOString().slice(0, 16).replace("T", " ")} UTC` : "";
  return `This account is paused${until}.${why}`;
}
