import { signWsToken, wsUrlFor } from "@/lib/desk/ws-token";
import { smcConfig } from "@/lib/env";
import { getSession } from "@/lib/session";

/** Issues a short-lived WebSocket URL for the SMC live feed to a signed-in user. */
export async function GET(): Promise<Response> {
  const cfg = smcConfig();
  if (!cfg || !cfg.wsSecret) return Response.json({ error: "Live feed is not configured." }, { status: 503 });
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to use the desk." }, { status: 401 });

  const url = wsUrlFor(cfg.apiUrl, signWsToken(session.user.id, cfg.wsSecret));
  return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
