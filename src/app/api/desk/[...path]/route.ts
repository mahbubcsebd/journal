import type { NextRequest } from "next/server";
import { proxyPath } from "@/lib/desk/ws-token";
import { smcConfig } from "@/lib/env";
import { getSession } from "@/lib/session";

/** Chat answers stream for a while; everything else is quick. */
export const maxDuration = 60;

const UPSTREAM_TIMEOUT_MS = 55_000;
const FORWARD_REQUEST_HEADERS = ["content-type", "accept"] as const;
const FORWARD_RESPONSE_HEADERS = ["content-type", "cache-control"] as const;

type Ctx = { params: Promise<{ path: string[] }> };

const fail = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Authenticated proxy to the SMC Desk server: signed-in users only, and the
 * server's ACCESS_KEY is added here so it never reaches the browser.
 */
async function proxy(req: NextRequest, ctx: Ctx): Promise<Response> {
  const cfg = smcConfig();
  if (!cfg) return fail(503, "SMC Desk is not configured (SMC_API_URL).");
  if (!(await getSession())) return fail(401, "Sign in to use the desk.");

  const path = proxyPath((await ctx.params).path);
  if (!path) return fail(404, "Not found");

  const headers = new Headers();
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (cfg.accessKey) headers.set("x-access-key", cfg.accessKey);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.apiUrl}${path}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    console.error(`[desk] upstream ${req.method} ${path} failed`, e);
    return fail(502, "SMC server is unreachable. Is the PC/tunnel running?");
  }

  const out = new Headers();
  for (const h of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  // Streams (chat SSE) pass straight through.
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
