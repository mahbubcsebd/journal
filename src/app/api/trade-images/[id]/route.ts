import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { trade, tradeImage } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { contentTypeFor, getObject } from "@/lib/storage";

/** Streams a screenshot only to the owner of its trade. */
export async function GET(_: Request, { params }: RouteContext<"/api/trade-images/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const [img] = await db
    .select({ url: tradeImage.url })
    .from(tradeImage)
    .innerJoin(trade, eq(trade.id, tradeImage.tradeId))
    .where(and(eq(tradeImage.id, id), eq(trade.userId, user.id)))
    .limit(1);
  if (!img) return new Response("Not found", { status: 404 });
  const data = await getObject(img.url);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(data), {
    headers: {
      "content-type": contentTypeFor(img.url),
      "cache-control": "private, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
