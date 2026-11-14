import { timingSafeEqual } from "node:crypto";
import { runDailyNotifications } from "@/server/services/notifications";

export const maxDuration = 300;

/** Vercel Cron calls this daily with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runDailyNotifications();
  return Response.json(result);
}
