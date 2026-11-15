import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { syncKey, tradingAccount, user } from "@/db/schema";
import { userForKey } from "@/lib/sync/keys";
import { fromEaDeal, fromEaPosition, parseEaPayload } from "@/lib/sync/map";
import { ingestDeals } from "@/server/services/ingest";
import { sendGoalAlerts } from "@/server/services/notifications";

export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;

const json = (status: number, body: unknown) => Response.json(body, { status });

/**
 * Receives deals, balance and open positions from the JournalSync MT5 EA.
 * Auth: `Authorization: Bearer <sync key>`. Unknown logins are added as new
 * sub-accounts automatically.
 */
export async function POST(request: Request) {
  const key = await userForKey(request.headers.get("authorization"));
  if (!key) return json(401, { error: "Invalid or revoked sync key" });
  if (key.lastUsedAt && Date.now() - key.lastUsedAt.getTime() < 1500) return json(429, { error: "Too many requests" });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return json(413, { error: "Payload too large" });
  const text = await request.text();
  if (text.length > MAX_BYTES) return json(413, { error: "Payload too large" });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json(400, { error: "Body is not JSON" });
  }
  const parsed = parseEaPayload(raw);
  if (!parsed.ok) {
    console.warn("[sync/mt5] rejected payload:", parsed.error);
    return json(400, { error: `Unexpected payload: ${parsed.error}` });
  }
  if (parsed.skipped.length) console.warn(`[sync/mt5] skipped ${parsed.skipped.length} item(s):`, parsed.skipped.slice(0, 5));
  const p = parsed.data;

  await db.update(syncKey).set({ lastUsedAt: new Date() }).where(eq(syncKey.id, key.id));

  let [account] = await db
    .select()
    .from(tradingAccount)
    .where(and(eq(tradingAccount.userId, key.userId), eq(tradingAccount.login, p.login), eq(tradingAccount.server, p.server)))
    .limit(1);
  if (!account) {
    // The user may have typed the server slightly differently when adding the
    // account by hand (e.g. "Exness-MT5Real8" vs "Exness-MT5Real"). A login is
    // unique at the broker, so if exactly one account has it, adopt the EA's
    // server name instead of creating a duplicate sub-account.
    const sameLogin = await db
      .select()
      .from(tradingAccount)
      .where(and(eq(tradingAccount.userId, key.userId), eq(tradingAccount.login, p.login)));
    if (sameLogin.length === 1) {
      [account] = await db
        .update(tradingAccount)
        .set({ server: p.server })
        .where(eq(tradingAccount.id, sameLogin[0].id))
        .returning();
    }
  }
  if (!account) {
    const cent = p.currency === "USC";
    [account] = await db
      .insert(tradingAccount)
      .values({
        userId: key.userId,
        login: p.login,
        server: p.server,
        nickname: `${cent ? "Cent" : "MT5"} #${p.login}`,
        currency: p.currency || "USD",
        accountType: cent ? "Standard Cent" : "Standard",
        environment: p.trade_mode === 0 ? "DEMO" : "REAL",
        syncMethod: "EA",
        status: "CONNECTED",
      })
      .onConflictDoNothing()
      .returning();
    account ??= (
      await db
        .select()
        .from(tradingAccount)
        .where(and(eq(tradingAccount.userId, key.userId), eq(tradingAccount.login, p.login), eq(tradingAccount.server, p.server)))
        .limit(1)
    )[0];
  } else {
    // MT5 knows whether the login is real or demo; trust it over what was typed.
    const environment = p.trade_mode === undefined ? account.environment : p.trade_mode === 0 ? "DEMO" : "REAL";
    const syncMethod = account.syncMethod === "MANUAL" || account.syncMethod === "IMPORT" ? "EA" : account.syncMethod;
    if (environment !== account.environment || syncMethod !== account.syncMethod) {
      await db.update(tradingAccount).set({ environment, syncMethod }).where(eq(tradingAccount.id, account.id));
    }
  }
  if (account.archived) return json(409, { error: "This account is archived in Journal" });

  const result = await ingestDeals({
    userId: key.userId,
    accountId: account.id,
    source: "EA",
    deals: p.deals.map(fromEaDeal),
    snapshot: {
      balance: p.balance,
      equity: p.equity,
      leverage: p.leverage,
      // Empty when MT5 hasn't loaded it yet: keep what the account already has.
      currency: p.currency || null,
      openPositions: p.positions.map(fromEaPosition),
    },
  });

  if (result.newDeals > 0) {
    after(async () => {
      const [u] = await db.select().from(user).where(eq(user.id, key.userId)).limit(1);
      if (u) await sendGoalAlerts(u).catch((e) => console.error("goal alerts after EA sync failed", e));
    });
  }
  return json(200, { ok: true, accountId: account.id, ...result, skipped: parsed.skipped.length });
}
