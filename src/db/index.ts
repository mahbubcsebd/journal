import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

// Supabase: use the transaction pooler URL (port 6543) on Vercel. Prepared
// statements are not supported by the pooler, hence `prepare: false`.
// Serverless instances freeze between requests and the pooler drops idle
// sockets, so close idle connections early and recycle them regularly —
// otherwise a warm instance reuses a dead socket and the query fails.
const IDLE_TIMEOUT_SEC = 20;
const MAX_LIFETIME_SEC = 60 * 5;
const CONNECT_TIMEOUT_SEC = 10;

const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: IDLE_TIMEOUT_SEC,
    max_lifetime: MAX_LIFETIME_SEC,
    connect_timeout: CONNECT_TIMEOUT_SEC,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
