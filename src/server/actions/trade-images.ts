"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { trade, tradeImage } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { deleteObjects, putObject, sniffImage } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_TRADE = 12;

async function ownTrade(tradeId: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  const [t] = await db.select({ id: trade.id }).from(trade).where(and(eq(trade.id, tradeId), eq(trade.userId, u.id))).limit(1);
  if (!t) throw new Error("Trade not found");
  return u;
}

export async function uploadTradeImages(tradeId: string, formData: FormData) {
  const u = await ownTrade(tradeId);
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const [{ n }] = await db.select({ n: count() }).from(tradeImage).where(eq(tradeImage.tradeId, tradeId));
  if (n + files.length > MAX_PER_TRADE) return { error: `A trade can have up to ${MAX_PER_TRADE} screenshots.` };

  const added: { id: string; caption: string | null }[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) return { error: `${f.name} is larger than 5 MB.`, added };
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return { error: `${f.name} isn't a PNG, JPG, WebP or GIF image.`, added };
    const key = `${u.id}/${tradeId}/${crypto.randomUUID()}.${kind.ext}`;
    await putObject(key, bytes, kind.type);
    const [row] = await db.insert(tradeImage).values({ tradeId, url: key }).returning({ id: tradeImage.id, caption: tradeImage.caption });
    added.push(row);
  }
  revalidatePath(`/trades/${tradeId}`);
  return { added };
}

export async function updateImageCaption(tradeId: string, imageId: string, caption: string) {
  await ownTrade(tradeId);
  await db
    .update(tradeImage)
    .set({ caption: caption.trim().slice(0, 300) || null })
    .where(and(eq(tradeImage.id, imageId), eq(tradeImage.tradeId, tradeId)));
}

export async function deleteTradeImage(tradeId: string, imageId: string) {
  await ownTrade(tradeId);
  const [img] = await db
    .delete(tradeImage)
    .where(and(eq(tradeImage.id, imageId), eq(tradeImage.tradeId, tradeId)))
    .returning({ url: tradeImage.url });
  if (img) await deleteObjects([img.url]);
  revalidatePath(`/trades/${tradeId}`);
}
