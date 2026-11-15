"use client";

import { useSyncExternalStore } from "react";

/** Live `matchMedia` result; false during SSR. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phones and small tablets: pickers open as bottom sheets there. */
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
