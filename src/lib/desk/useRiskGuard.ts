"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./format";
import type { RiskGuardStatus } from "./types";

const JOURNAL_CHANGED_EVENT = "smc-journal-changed";

/** Broadcasts a journal mutation so daily risk guard refreshes without extra prop wiring. */
export function notifyJournalChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(JOURNAL_CHANGED_EVENT));
  }
}

/** Local midnight unix seconds matching the trader's browser calendar day. */
export function localDayStartSec(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.floor(start.getTime() / 1000);
}

export interface RiskGuardSettings {
  maxTrades: number;
  maxLossR: number;
  balance: number;
  riskPct: number;
  /** Pass live MT5 deal/position count or similar trigger to refresh on broker updates */
  syncKey?: number;
}

export function useRiskGuard({ maxTrades, maxLossR, balance, riskPct, syncKey = 0 }: RiskGuardSettings) {
  const [status, setStatus] = useState<RiskGuardStatus | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams({
      dayStartSec: String(localDayStartSec()),
      maxTrades: String(maxTrades),
      maxLossR: String(maxLossR),
      balance: String(balance),
      riskPct: String(riskPct),
    });
    const res = await api<RiskGuardStatus>(`/api/risk-guard?${q}`);
    return res;
  }, [maxTrades, maxLossR, balance, riskPct]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      load()
        .then((res) => {
          if (active) setStatus(res);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    window.addEventListener(JOURNAL_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener(JOURNAL_CHANGED_EVENT, refresh);
    };
  }, [load, syncKey]);

  return status;
}

