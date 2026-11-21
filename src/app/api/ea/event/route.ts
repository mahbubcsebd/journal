import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { userForKey } from "@/lib/sync/keys";
import { sendAlert } from "@/server/services/alerts";

const body = z.object({
  login: z.string().max(32).default(""),
  symbol: z.string().max(32).default(""),
  kind: z.string().max(20).default("rule"),
  message: z.string().min(1).max(500),
});

/** The EA's guard saw a rule break: forward it to the trader's phone / Telegram. */
export async function POST(request: Request) {
  const key = await userForKey(request.headers.get("authorization"));
  if (!key) return Response.json({ error: "Invalid or revoked sync key, or the Journal account is paused" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad event" }, { status: 400 });
  const [u] = await db.select().from(user).where(eq(user.id, key.userId)).limit(1);
  if (!u) return Response.json({ error: "No user" }, { status: 401 });
  const e = parsed.data;
  const minute = Math.floor(Date.now() / 60_000);
  const r = await sendAlert(u, {
    kind: "GUARD",
    key: `${e.login}-${e.symbol}-${e.kind}-${minute}`,
    title: e.kind === "no_sl" ? `🛑 No stop loss on ${e.symbol}` : `🛑 Rule break on ${e.symbol}`,
    body: e.message,
    url: "/psychology#rules",
  });
  return Response.json({ ok: true, ...r });
}
