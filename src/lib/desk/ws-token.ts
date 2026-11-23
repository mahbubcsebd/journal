import { createHmac } from "node:crypto";

/** Lifetime of a WebSocket token. Only the upgrade is checked, so a short life is enough. */
export const WS_TOKEN_TTL_SEC = 60;

/**
 * Signs `{ sub, exp }` for the SMC server's `/ws?token=`.
 * Format (must match smc-desk/server/src/access.ts verifyWsToken):
 * base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, secret)).
 */
export function signWsToken(sub: string, secret: string, nowSec = Math.floor(Date.now() / 1000), ttlSec = WS_TOKEN_TTL_SEC): string {
  if (!secret) throw new Error("SMC_WS_SECRET is not set");
  const payload = Buffer.from(JSON.stringify({ sub, exp: nowSec + ttlSec })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** https://host → wss://host/ws?token=… */
export function wsUrlFor(apiUrl: string, token: string): string {
  const base = apiUrl.replace(/\/$/, "").replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

const SEGMENT = /^[A-Za-z0-9_.-]+$/;

/**
 * Validates proxied path segments. Only `/api/...` on the SMC server is reachable,
 * and dot segments are refused so the path can't climb out of it.
 */
export function proxyPath(segments: string[]): string | null {
  if (segments[0] !== "api" || segments.length < 2) return null;
  if (segments.some((s) => !SEGMENT.test(s) || s === "." || s === "..")) return null;
  return `/${segments.join("/")}`;
}
