"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscription, user as userTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { sendAlert, telegram, telegramConfigured } from "@/server/services/alerts";

const sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(input: unknown, userAgent?: string) {
  const u = await getCurrentUser();
  if (!u) return { ok: false as const, error: "Please sign in again." };
  const s = sub.safeParse(input);
  if (!s.success) return { ok: false as const, error: "This browser sent an invalid subscription." };
  await db
    .insert(pushSubscription)
    .values({ userId: u.id, endpoint: s.data.endpoint, p256dh: s.data.keys.p256dh, auth: s.data.keys.auth, userAgent: userAgent?.slice(0, 200) ?? null })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: { userId: u.id, p256dh: s.data.keys.p256dh, auth: s.data.keys.auth } });
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  const u = await getCurrentUser();
  if (!u) return { ok: false as const };
  await db.delete(pushSubscription).where(and(eq(pushSubscription.userId, u.id), eq(pushSubscription.endpoint, z.string().max(1000).parse(endpoint))));
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function sendTestAlert() {
  const u = await getCurrentUser();
  if (!u) return { ok: false as const, error: "Please sign in again." };
  const r = await sendAlert(u, { kind: "TEST", key: String(Date.now()), title: "✅ Journal alerts work", body: "You'll get news reminders, cooldowns, limits and MT5 guard alerts here.", url: "/settings#alerts" });
  if (!r.sent) return { ok: false as const, error: r.skipped === "no-channel" ? "Turn on notifications on this device or connect Telegram first." : "Nothing was delivered. Check the server keys." };
  return { ok: true as const, sent: r.sent };
}

const prefs = z.object({
  notifyNews: z.boolean().optional(),
  notifyCooldown: z.boolean().optional(),
  notifyLimits: z.boolean().optional(),
  notifyReviews: z.boolean().optional(),
  notifyGuard: z.boolean().optional(),
  notifyNewsMinutes: z.number().int().min(1).max(120).optional(),
  guardAlerts: z.boolean().optional(),
  guardAutoClose: z.boolean().optional(),
  locale: z.enum(["en", "bn"]).optional(),
});

export async function saveAlertPrefs(input: z.input<typeof prefs>) {
  const u = await getCurrentUser();
  if (!u) return { ok: false as const };
  const data = prefs.parse(input);
  await db.update(userTable).set({ settings: { ...u.settings, ...data } }).where(eq(userTable.id, u.id));
  if (data.locale) (await cookies()).set(LOCALE_COOKIE, data.locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** A one-time t.me deep link that connects this user's Telegram chat (valid 15 minutes). */
export async function telegramLink(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Please sign in again." };
  if (!telegramConfigured()) return { ok: false, error: "Telegram isn't set up on the server (TELEGRAM_BOT_TOKEN)." };
  let bot = process.env.TELEGRAM_BOT_USERNAME;
  if (!bot) {
    try {
      bot = ((await telegram("getMe", {})) as { username?: string }).username;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't reach Telegram." };
    }
  }
  const code = randomBytes(12).toString("base64url");
  await db
    .update(userTable)
    .set({ settings: { ...u.settings, telegramLink: { code, expires: Date.now() + 15 * 60_000 } } })
    .where(eq(userTable.id, u.id));
  return { ok: true, url: `https://t.me/${bot}?start=${code}` };
}

export async function disconnectTelegram() {
  const u = await getCurrentUser();
  if (!u) return { ok: false as const };
  const { telegramChatId: _drop, telegramLink: _link, ...rest } = u.settings;
  void _drop;
  void _link;
  await db.update(userTable).set({ settings: rest }).where(eq(userTable.id, u.id));
  revalidatePath("/settings");
  return { ok: true as const };
}

/** Point the bot's webhook at this app (needed once after setting the token). */
export async function activateTelegramBot(): Promise<{ ok: boolean; message: string }> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, message: "Please sign in again." };
  if (!telegramConfigured() || !process.env.TELEGRAM_WEBHOOK_SECRET) return { ok: false, message: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first." };
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!base.startsWith("https://")) return { ok: false, message: "NEXT_PUBLIC_APP_URL must be your https:// address." };
  try {
    await telegram("setWebhook", { url: `${base}/api/telegram/webhook`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message"] });
    return { ok: true, message: "Bot is active." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Telegram refused." };
  }
}
