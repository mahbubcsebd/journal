import { timingSafeEqual } from "node:crypto";
import { runDailyNotifications } from "@/server/services/notifications";
import { refreshCalendar } from "@/server/services/news";
import { runCoachReports } from "@/server/services/coach-reports";

export const maxDuration = 300;

/** Vercel Cron calls this daily with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const [calendar, result] = await Promise.all([refreshCalendar().catch((e) => ({ ok: false, error: String(e) })), runDailyNotifications()]);
  // AI reviews last: they use the fresh calendar and synced trades.
  const coach = await runCoachReports(180_000).catch((e) => ({ error: String(e) }));
  return Response.json({ ...result, calendar, coach });
}
