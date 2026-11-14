import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/session";

/** The JournalSync EA with this deployment's URL already filled in. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const source = await readFile(path.join(process.cwd(), "mql5", "JournalSync.mq5"), "utf8");
  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  return new Response(source.replace("__JOURNAL_URL__", origin), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="JournalSync.mq5"',
      "cache-control": "no-store",
    },
  });
}
