"use client";

import { useEffect, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Registers the service worker and remembers the browser's install prompt. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallEvent;
      emit();
    };
    const onInstalled = () => {
      deferred = null;
      emit();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

/** "android-prompt" when the browser offers install, "ios" for Safari (Share → Add to Home Screen), "installed" when running as the app. */
export function useInstall() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) return "installed";
      if (deferred) return "prompt";
      if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
      return "unavailable";
    },
    () => "unavailable",
  );
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === "accepted";
  };
  return { state, install } as const;
}

export function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
