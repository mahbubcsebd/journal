import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { SIGNED_OUT_URL } from "@/lib/auth-routes";

/** Pages for signed-out visitors; signed-in users go straight to the app. */
const PUBLIC_ONLY = ["/", "/login"];
const EXPIRED_FLAG = new URL(SIGNED_OUT_URL, "http://x").searchParams.keys().next().value!;

/**
 * Optimistic auth gate: only checks that a session cookie exists.
 * Real validation happens on the server in `requireUser()`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (PUBLIC_ONLY.includes(pathname)) {
    // A cookie whose session has expired: the app sent the user here, so stay.
    if (hasSession && !request.nextUrl.searchParams.has(EXPIRED_FLAG)) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/onboarding",
    "/dashboard/:path*",
    "/calendar/:path*",
    "/coach/:path*",
    "/news/:path*",
    "/trades/:path*",
    "/analytics/:path*",
    "/reports/:path*",
    "/journal/:path*",
    "/notebook/:path*",
    "/playbook/:path*",
    "/psychology/:path*",
    "/goals/:path*",
    "/risk/:path*",
    "/challenges/:path*",
    "/insights/:path*",
    "/accounts/:path*",
    "/import/:path*",
    "/tags/:path*",
    "/settings/:path*",
  ],
};
