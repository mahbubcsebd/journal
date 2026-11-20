import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { telegram } from "@/server/services/alerts";

type Update = { message?: { chat?: { id?: number }; text?: string } };

/** Telegram bot: "/start <code>" links the chat to a Journal user. */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return new Response("Unauthorized", { status: 401 });
  const update = (await request.json().catch(() => ({}))) as Update;
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() ?? "";
  if (!chatId) return Response.json({ ok: true });
  const code = /^\/start\s+([A-Za-z0-9_-]{8,64})$/.exec(text)?.[1];
  if (!code) {
    await telegram("sendMessage", { chat_id: chatId, text: "Open Journal → Settings → Alerts and tap “Connect Telegram” to link this chat." }).catch(() => {});
    return Response.json({ ok: true });
  }
  const linked = await db
    .update(user)
    .set({ settings: sql`(${user.settings} - 'telegramLink') || jsonb_build_object('telegramChatId', ${String(chatId)}::text)` })
    .where(sql`${user.settings}->'telegramLink'->>'code' = ${code} and (${user.settings}->'telegramLink'->>'expires')::bigint > ${Date.now()}`)
    .returning({ id: user.id });
  await telegram("sendMessage", {
    chat_id: chatId,
    text: linked.length ? "✅ Connected. Journal will send news reminders, cooldowns, limits and guard alerts here." : "This link has expired. Create a new one in Journal → Settings → Alerts.",
  }).catch(() => {});
  return Response.json({ ok: true });
}
