"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { autoSync } from "@/server/actions/sync";

const EVERY_MS = 5 * 60_000;

/**
 * While the app is open and visible, ask the server to refresh MetaApi
 * accounts that haven't synced in 5 minutes (the EA pushes on its own).
 */
export function AutoSync() {
  const router = useRouter();
  const tick = useEffectEvent(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const r = await autoSync();
      if (r.synced > 0) router.refresh();
    } catch {
      // network hiccup — try again next tick
    }
  });
  useEffect(() => {
    const first = setTimeout(() => tick(), 4000);
    const id = setInterval(() => tick(), EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return null;
}
