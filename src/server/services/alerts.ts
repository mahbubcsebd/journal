import "server-only";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { notificationLog, pushSubscription, trade, user as userTable, type User } from "@/db/schema";
import { GOAL_METRICS, PERIOD_LABEL } from "@/lib/goals";
import { DEFAULT_COOLDOWN_MINUTES } from "@/lib/mindset";
import { CURRENCY_FLAG, goldBias } from "@/lib/news";
import { formatMoney } from "@/lib/utils";
import { getGoalsWithProgress } from "@/server/queries/goals";
import { getUpcomingRelevant } from "@/server/queries/news";
import { blockedStatus } from "@/lib/admin";

export type AlertKind = "NEWS" | "COOLDOWN" | "LIMIT" | "REVIEW" | "GUARD" | "TEST";
export type Alert = { kind: AlertKind; key: string; title: string; body: string; url?: string };

const PREF: Record<AlertKind, keyof User["settings"] | null> = {
  NEWS: "notifyNews",
  COOLDOWN: "notifyCooldown",
  LIMIT: "notifyLimits",
  REVIEW: "notifyReviews",
  GUARD: "notifyGuard",
  TEST: null,
};

export const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
const telegramApi = (method: string) => `${(process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "")}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

let vapidReady = false;
function vapid() {
  if (!vapidReady && pushConfigured()) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:alerts@${new URL(appUrl() || "https://example.com").hostname}`, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidReady = true;
  }
  return vapidReady;
}

export async function telegram(method: string, body: Record<string, unknown>) {
  const res = await fetch(telegramApi(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: unknown };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Send one alert to every phone/browser and Telegram the user connected —
 * once per (kind, key), and only if the user wants this kind.
 */
export async function sendAlert(u: User, a: Alert): Promise<{ sent: number; skipped?: string }> {
  const pref = PREF[a.kind];
  if (pref && u.settings[pref] === false) return { sent: 0, skipped: "off" };
  const subs = pushConfigured() ? await db.select().from(pushSubscription).where(eq(pushSubscription.userId, u.id)) : [];
  const chat = telegramConfigured() ? u.settings.telegramChatId : undefined;
  if (!subs.length && !chat) return { sent: 0, skipped: "no-channel" };
  if (a.kind !== "TEST") {
    const claimed = await db
      .insert(notificationLog)
      .values({ userId: u.id, kind: `ALERT_${a.kind}`, key: a.key.slice(0, 200) })
      .onConflictDoNothing()
      .returning({ id: notificationLog.id });
    if (!claimed.length) return { sent: 0, skipped: "duplicate" };
  }
  let sent = 0;
  if (subs.length && vapid()) {
    const payload = JSON.stringify({ title: a.title, body: a.body, url: a.url ?? "/dashboard", tag: `${a.kind}-${a.key}`.slice(0, 64) });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 900, urgency: "high" });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // Gone or invalid: the browser unsubscribed.
          if (code === 404 || code === 410) await db.delete(pushSubscription).where(eq(pushSubscription.id, s.id));
          else console.warn("[alerts] push failed", code, e instanceof Error ? e.message : e);
        }
      }),
    );
  }
  if (chat) {
    try {
      const link = a.url && appUrl() ? `\n<a href="${appUrl()}${a.url}">Open in Journal</a>` : "";
      await telegram("sendMessage", { chat_id: chat, text: `<b>${esc(a.title)}</b>\n${esc(a.body)}${link}`, parse_mode: "HTML", disable_web_page_preview: true });
      sent++;
    } catch (e) {
      console.warn("[alerts] telegram failed", e instanceof Error ? e.message : e);
    }
  }
  // Nothing got through: forget the claim so the next run tries again.
  if (!sent && a.kind !== "TEST") {
    await db
      .delete(notificationLog)
      .where(and(eq(notificationLog.userId, u.id), eq(notificationLog.kind, `ALERT_${a.kind}`), eq(notificationLog.key, a.key.slice(0, 200))));
  }
  return { sent };
}

const lastRun = new Map<string, number>();

/** Alerts that are due for one user now: news soon, cooldown started, limit reached. */
export async function runUserAlerts(u: User, opts: { force?: boolean } = {}) {
  // Called from page loads and EA syncs: at most once a minute per user per server.
  const now = Date.now();
  if (!opts.force && now - (lastRun.get(u.id) ?? 0) < 60_000) return 0;
  lastRun.set(u.id, now);
  if (!pushConfigured() && !(telegramConfigured() && u.settings.telegramChatId)) return 0;
  if (pushConfigured() && !u.settings.telegramChatId) {
    const [has] = await db.select({ id: pushSubscription.id }).from(pushSubscription).where(eq(pushSubscription.userId, u.id)).limit(1);
    if (!has) return 0;
  }
  let sent = 0;
  const lead = u.settings.notifyNewsMinutes ?? 15;
  const tz = u.timezone;
  const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);

  // 1. High-impact news within the reminder lead time.
  const { events, prefs } = await getUpcomingRelevant(u, 20).catch(() => ({ events: [], prefs: null }));
  for (const e of events) {
    const ms = e.time.getTime() - now;
    if (e.impact !== "High" || ms <= 0 || ms > lead * 60_000) continue;
    const g = goldBias(e);
    const r = await sendAlert(u, {
      kind: "NEWS",
      key: e.id,
      title: `⚠️ ${CURRENCY_FLAG[e.currency] ?? ""} ${e.currency} ${e.title} in ${Math.max(1, Math.round(ms / 60_000))} min`,
      body: `${time(e.time)} · Forecast ${e.forecast ?? "—"} · Previous ${e.previous ?? "—"}${g ? ` · Gold ${g.dir === "volatile" ? "⇅ volatile" : g.dir === "up" ? "▲ usually up" : "▼ usually down"}` : ""}. No new trades from ${prefs?.window.before ?? 15} min before to ${prefs?.window.after ?? 15} min after.`,
      url: `/news/${e.id}`,
    });
    sent += r.sent;
  }

  // 2. A loss just closed: cooldown starts.
  const cooldown = u.settings.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  if (cooldown) {
    const [loss] = await db
      .select({ id: trade.id, symbol: trade.symbol, net: trade.netPnl, closeTime: trade.closeTime })
      .from(trade)
      .where(and(eq(trade.userId, u.id), eq(trade.status, "CLOSED"), eq(trade.isBacktest, false), lt(trade.netPnl, 0), gte(trade.closeTime, new Date(now - 10 * 60_000))))
      .orderBy(desc(trade.closeTime))
      .limit(1);
    if (loss?.closeTime) {
      const until = new Date(loss.closeTime.getTime() + cooldown * 60_000);
      const r = await sendAlert(u, {
        kind: "COOLDOWN",
        key: loss.id,
        title: `🧊 Cooldown: ${cooldown} min`,
        body: `${loss.symbol} closed at ${formatMoney(loss.net, u.baseCurrency, { sign: true })}. Step away until ${time(until)} — no revenge trades.`,
        url: `/trades/${loss.id}`,
      });
      sent += r.sent;
    }
  }

  // 3. Limit goals reached.
  const goals = await getGoalsWithProgress(u, true).catch(() => []);
  for (const g of goals) {
    if (GOAL_METRICS[g.metric].kind !== "limit" || g.current.status !== "breached") continue;
    const r = await sendAlert(u, {
      kind: "LIMIT",
      key: `${g.id}-${g.current.label}`,
      title: `⛔ ${PERIOD_LABEL[g.period]} ${GOAL_METRICS[g.metric].label.toLowerCase()} reached`,
      body: `${g.accountName} · ${g.current.label}. Your rule says stop trading for this ${g.period.toLowerCase()}.`,
      url: "/goals",
    });
    sent += r.sent;
  }
  return sent;
}

/** Cron: alerts for everyone who connected a phone or Telegram. */
export async function runAllAlerts() {
  const withPush = db.select({ id: pushSubscription.userId }).from(pushSubscription);
  const users = await db
    .select()
    .from(userTable)
    .where(and(eq(userTable.onboarded, true), or(inArray(userTable.id, withPush), sql`${userTable.settings}->>'telegramChatId' is not null`)));
  let sent = 0;
  for (const u of users.filter((x) => !blockedStatus(x))) sent += await runUserAlerts(u, { force: true }).catch((e) => (console.error("[alerts] user failed", u.id, e), 0));
  return { users: users.length, sent };
}
