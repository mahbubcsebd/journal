import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/session";

/** The JournalSync EA with this deployment's URL already filled in. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const source = await readFile(path.join(process.cwd(), "mql5", "JournalSync.mq5"), "utf8");
  // Never bake a localhost URL into the EA downloaded from the live site
  // (happens when NEXT_PUBLIC_APP_URL was copied from .env.local).
  const requestOrigin = new URL(request.url).origin;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const isLocal = (u: string) => /\/\/(localhost|127\.0\.0\.1)(:|$|\/)/.test(u);
  const origin = configured && !(isLocal(configured) && !isLocal(requestOrigin)) ? configured : requestOrigin;
  return new Response(source.replace("__JOURNAL_URL__", origin), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="JournalSync.mq5"',
      "cache-control": "no-store",
    },
  });
}
