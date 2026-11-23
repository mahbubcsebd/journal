"use client";

import { useEffect, useState } from "react";
import { api } from "./format";
import type { AccountSnapshot } from "./types";

/** Match broker-suffixed MT5 symbols (e.g. XAUUSDm) against active desk symbol (XAUUSD). */
export function matchesSymbol(positionSymbol: string, activeSymbol: string): boolean {
  const pos = positionSymbol.toUpperCase();
  const act = activeSymbol.toUpperCase();
  return pos === act || pos.startsWith(act);
}

/** Poll read-only MT5 account balance, equity, and open positions while connected to MT5. */
export function useAccount(enabled: boolean, pollMs = 3000): AccountSnapshot | null {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const pull = () => {
      api<AccountSnapshot>("/api/account")
        .then((res) => {
          if (active) setSnapshot(res);
        })
        .catch(() => {
          // Keep last known snapshot when bridge briefly disconnects.
        });
    };
    pull();
    const timer = setInterval(pull, pollMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, pollMs]);

  return enabled ? snapshot : null;
}

