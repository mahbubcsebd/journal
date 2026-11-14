import "server-only";
import { and, eq, inArray, isNotNull, lt, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { tradingAccount, type TradingAccount } from "@/db/schema";
import { fromMetaApiDeal, fromMetaApiPosition, type MetaApiDeal, type MetaApiPosition } from "@/lib/sync/map";
import { ingestDeals, markSyncError } from "./ingest";

/*
 * MetaApi cloud integration through the official SDK (metaapi.cloud-sdk).
 * Only the small surface used here is typed. The investor (read-only) password
 * is sent to MetaApi once when the account is added and is never stored here.
 */

type RpcConnection = {
  connect(): Promise<void>;
  waitSynchronized(timeoutInSeconds?: number): Promise<unknown>;
  getAccountInformation(): Promise<{ balance: number; equity: number; currency: string; leverage: number }>;
  getPositions(): Promise<MetaApiPosition[]>;
  getDealsByTimeRange(start: Date, end: Date, offset?: number, limit?: number): Promise<{ deals: MetaApiDeal[]; synchronizing?: boolean }>;
  close(): Promise<void>;
};
type SdkAccount = {
  id: string;
  state: string;
  connectionStatus: string;
  reload(): Promise<void>;
  deploy(): Promise<void>;
  remove(): Promise<void>;
  getRPCConnection(): RpcConnection;
};
type SdkApi = {
  metatraderAccountApi: {
    getAccount(id: string): Promise<SdkAccount>;
    createAccount(dto: Record<string, unknown>): Promise<SdkAccount>;
  };
};

export const metaApiConfigured = () => Boolean(process.env.METAAPI_TOKEN);

let api: SdkApi | null = null;
async function sdk(): Promise<SdkApi> {
  const token = process.env.METAAPI_TOKEN;
  if (!token) throw new Error("MetaApi isn't set up (METAAPI_TOKEN missing).");
  if (!api) {
    const mod = (await import("metaapi.cloud-sdk/node")) as { default: unknown };
    const MetaApi = ((mod.default as { default?: unknown }).default ?? mod.default) as new (token: string, opts?: object) => SdkApi;
    api = new MetaApi(token, { application: "MetaApi" });
  }
  return api;
}

function explain(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/E_AUTH|authenticat|invalid account|password/i.test(m)) return "MetaApi couldn't log in — check the login, server and investor password.";
  if (/E_SRV_NOT_FOUND|server/i.test(m)) return "MetaApi couldn't find that MT5 server name. Copy it exactly from MT5 (e.g. Exness-MT5Real8).";
  if (/TooManyRequests|429/i.test(m)) return "MetaApi rate limit reached — try again in a minute.";
  if (/timeout|timed out/i.test(m)) return "MetaApi is still connecting to your broker. Try syncing again in a few minutes.";
  return `MetaApi error: ${m.slice(0, 200)}`;
}

/** Register an MT5 account with MetaApi using the investor (read-only) password. */
export async function connectMetaApi(account: TradingAccount, investorPassword: string) {
  const a = await (await sdk()).metatraderAccountApi.createAccount({
    name: `Journal ${account.nickname}`.slice(0, 60),
    type: "cloud-g2",
    login: account.login,
    password: investorPassword,
    server: account.server,
    platform: "mt5",
    magic: 0,
    reliability: "regular",
  });
  await db
    .update(tradingAccount)
    .set({ syncMethod: "METAAPI", metaapiAccountId: a.id, status: "SYNCING", statusMessage: "Deploying — the first sync can take a few minutes." })
    .where(eq(tradingAccount.id, account.id));
  return a.id;
}

const DEFAULT_HISTORY_DAYS = 90;

/** Pull account info, open positions and deals since the last sync (with a 1-day overlap). */
export async function syncMetaApiAccount(account: TradingAccount) {
  if (!account.metaapiAccountId) throw new Error("Account isn't connected to MetaApi");
  await db.update(tradingAccount).set({ status: "SYNCING" }).where(eq(tradingAccount.id, account.id));
  let connection: RpcConnection | null = null;
  try {
    const a = await (await sdk()).metatraderAccountApi.getAccount(account.metaapiAccountId);
    if (a.state === "UNDEPLOYED") await a.deploy();
    connection = a.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized(45);

    const [info, positions] = await Promise.all([connection.getAccountInformation(), connection.getPositions()]);
    const end = new Date(Date.now() + 60_000);
    const start = account.lastSyncAt ? new Date(account.lastSyncAt.getTime() - 86_400_000) : new Date(Date.now() - DEFAULT_HISTORY_DAYS * 86_400_000);
    const deals: MetaApiDeal[] = [];
    for (let offset = 0; offset < 20_000; offset += 1000) {
      const page = await connection.getDealsByTimeRange(start, end, offset, 1000);
      deals.push(...page.deals);
      if (page.deals.length < 1000) break;
    }

    return await ingestDeals({
      userId: account.userId,
      accountId: account.id,
      source: "METAAPI",
      deals: deals.map(fromMetaApiDeal).filter((d) => d !== null),
      snapshot: {
        balance: info.balance,
        equity: info.equity,
        leverage: info.leverage,
        currency: info.currency,
        openPositions: positions.map(fromMetaApiPosition),
      },
    });
  } catch (e) {
    const message = explain(e);
    await markSyncError(account.userId, account.id, "METAAPI", message);
    throw new Error(message);
  } finally {
    await connection?.close().catch(() => {});
  }
}

export async function disconnectMetaApi(account: TradingAccount) {
  if (account.metaapiAccountId) {
    try {
      const a = await (await sdk()).metatraderAccountApi.getAccount(account.metaapiAccountId);
      await a.remove();
    } catch (e) {
      console.error("MetaApi remove failed", e);
    }
  }
  await db
    .update(tradingAccount)
    .set({ syncMethod: "MANUAL", metaapiAccountId: null, status: "DISCONNECTED", statusMessage: null, openPositions: null })
    .where(eq(tradingAccount.id, account.id));
}

/** MetaApi accounts not synced for `staleMinutes` (and not mid-sync). */
export async function staleMetaApiAccounts(userId: string | null, staleMinutes: number) {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);
  return db
    .select()
    .from(tradingAccount)
    .where(
      and(
        userId ? eq(tradingAccount.userId, userId) : undefined,
        eq(tradingAccount.syncMethod, "METAAPI"),
        isNotNull(tradingAccount.metaapiAccountId),
        eq(tradingAccount.archived, false),
        or(isNull(tradingAccount.lastSyncAt), lt(tradingAccount.lastSyncAt, cutoff)),
        inArray(tradingAccount.status, ["CONNECTED", "ERROR", "PENDING", "SYNCING"]),
      ),
    );
}
