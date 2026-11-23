"use client";

import { useEffect, useState } from "react";
import { api } from "./format";
import type { SymbolInfo } from "./types";

const cache = new Map<string, SymbolInfo>();

export function useSymbolInfo(symbol: string): SymbolInfo | null {
  const [entry, setEntry] = useState<{ symbol: string; info: SymbolInfo } | null>(() => {
    const hit = cache.get(symbol);
    return hit ? { symbol, info: hit } : null;
  });

  useEffect(() => {
    const hit = cache.get(symbol);
    if (hit) return;
    let active = true;
    api<{ info: SymbolInfo }>(`/api/symbol-info?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => {
        cache.set(symbol, res.info);
        if (active) setEntry({ symbol, info: res.info });
      })
      .catch(() => {
        // Fallback contract estimation remains active if bridge info fails.
      });
    return () => {
      active = false;
    };
  }, [symbol]);

  return cache.get(symbol) ?? (entry?.symbol === symbol ? entry.info : null);
}

