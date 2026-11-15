import { connection } from "next/server";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const maxDuration = 30;

const PROBE_TIMEOUT_MS = 8000;

type Probe = { ok: boolean; ms: number; error?: string };

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS)),
  ]);
}

async function probe(label: string, run: () => Promise<unknown>): Promise<Probe> {
  const start = Date.now();
  try {
    await withTimeout(run(), label);
    return { ok: true, ms: Date.now() - start };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error(`[health/db] ${label} failed`, e);
    // Code + message only: postgres errors never include the connection string.
    return { ok: false, ms: Date.now() - start, error: [err.code, err.message].filter(Boolean).join(": ") };
  }
}

/**
 * Diagnoses DB stalls on Vercel: a brand-new connection vs the shared app pool.
 * Returns timings only — no data — so it is safe to leave public.
 */
export async function GET() {
  await connection(); // always run at request time, never prerendered
  const fresh = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, connect_timeout: 8, idle_timeout: 1 });
  const freshConnection = await probe("fresh connection", () => fresh`select 1`);
  await fresh.end({ timeout: 1 }).catch(() => undefined);

  const sharedPool = await probe("shared pool", () => db.execute(sql`select 1`));
  const userTable = await probe("user table", () => db.execute(sql`select count(*) from "user"`));

  const ok = freshConnection.ok && sharedPool.ok && userTable.ok;
  return Response.json(
    { ok, region: process.env.VERCEL_REGION ?? null, freshConnection, sharedPool, userTable },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
