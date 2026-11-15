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
// Supabase's transaction pooler (Supavisor) hangs on pipelined queries: they
// are sent but the answers never arrive, so a page that runs several queries
// at once spins until the function times out. Send one query per connection
// at a time, and give up on a query after QUERY_TIMEOUT_SEC so a silent
// pooler fails fast (the pool reconnects) instead of hanging the page.
const IDLE_TIMEOUT_SEC = 20;
const QUERY_TIMEOUT_SEC = 20;
const MAX_LIFETIME_SEC = 60 * 5;
const CONNECT_TIMEOUT_SEC = 10;
const MAX_CONNECTIONS = process.env.NODE_ENV === "production" ? 3 : 10;

const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: MAX_CONNECTIONS,
    idle_timeout: IDLE_TIMEOUT_SEC,
    max_lifetime: MAX_LIFETIME_SEC,
    connect_timeout: CONNECT_TIMEOUT_SEC,
    query_timeout: QUERY_TIMEOUT_SEC,
    max_pipeline: 1,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
