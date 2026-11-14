import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ONLY = ["/login"];

/**
 * Optimistic auth gate: only checks that a session cookie exists.
 * Real validation happens on the server in `requireUser()`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (PUBLIC_ONLY.includes(pathname)) {
    if (hasSession) return NextResponse.redirect(new URL("/dashboard", request.url));
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
    "/login",
    "/onboarding",
    "/dashboard/:path*",
    "/calendar/:path*",
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
