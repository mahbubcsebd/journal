import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, translate, type Locale } from "./i18n";
import { getCurrentUser } from "./session";

/** Server-side language: the cookie, else the account setting. Call inside Suspense. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const u = await getCurrentUser().catch(() => null);
  return u?.settings.locale === "bn" ? "bn" : "en";
});

export async function getT() {
  const l = await getLocale();
  return (text: string, params?: Record<string, string | number>) => translate(l, text, params);
}
