import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { runAllAlerts } from "@/server/services/alerts";

export const maxDuration = 60;

/**
 * News reminders, cooldowns and limits for everyone. Vercel's free cron runs
 * once a day, so call this every 5 minutes from a free scheduler (e.g.
 * cron-job.org) with `Authorization: Bearer $CRON_SECRET`. Alerts also go out
 * whenever the EA syncs or the app is opened.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await runAllAlerts());
}
