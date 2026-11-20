"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isLocale, LOCALE_COOKIE, translate, type Locale } from "@/lib/i18n";

const listeners = new Set<() => void>();
const read = (): Locale => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  return m && isLocale(m[1]) ? m[1] : "en";
};

/** The interface language (from a cookie, so static pages can follow it too). */
export function useLocale(): Locale {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "en",
  );
}

export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = locale;
  listeners.forEach((l) => l());
}

export function useT() {
  const locale = useLocale();
  return (text: string, params?: Record<string, string | number>) => translate(locale, text, params);
}

/** Translated text inside server components that render in the static shell. */
export function T({ children, params }: { children: string; params?: Record<string, string | number> }) {
  return <>{useT()(children, params)}</>;
}

/** Keeps this device's cookie in step with the account's language setting. */
export function LocaleSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    if (read() !== locale) setLocaleCookie(locale);
    else document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
