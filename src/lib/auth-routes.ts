/**
 * Where to send someone whose session cookie no longer works. The flag tells
 * the proxy to show the login page even though a (stale) cookie is present —
 * otherwise "/login → /dashboard → /login" would loop.
 */
export const SIGNED_OUT_URL = "/login?expired=1";
