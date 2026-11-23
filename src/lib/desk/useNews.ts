"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./format";
import type { NewsResponse } from "./types";

/** Current unix time in seconds, re-rendered every `intervalMs` so countdowns stay live. */
export function useNowSec(intervalMs = 15_000) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = setInterval(onChange, intervalMs);
      return () => clearInterval(timer);
    },
    [intervalMs],
  );
  // Snapped to the interval so the snapshot is stable between ticks. The clock is not read
  // while prerendering (server snapshot 0); nothing time-based is drawn before news has loaded.
  const getNow = useCallback(() => (Math.floor(Date.now() / intervalMs) * intervalMs) / 1000, [intervalMs]);
  return useSyncExternalStore(subscribe, getNow, serverNow);
}

const serverNow = () => 0;

export function useNews(symbol: string) {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      return await api<NewsResponse>(`/api/news?symbol=${encodeURIComponent(symbol)}`);
    } catch (err) {
      console.warn("Failed to fetch news:", err);
      return null;
    }
  }, [symbol]);

  useEffect(() => {
    let stop = false;
    const poll = () => {
      void load().then((res) => {
        if (!stop && res) setData(res);
      });
    };
    poll();
    const interval = setInterval(poll, 60_000); // refresh every 60s
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [load]);

  const dismiss = (id: string) => {
    setDismissedId(id);
  };

  const activeAlert = data?.alert && data.alert.event.id !== dismissedId ? data.alert : null;

  return {
    news: data,
    loading: data === null,
    activeAlert,
    dismiss,
    refresh: async () => {
      const res = await load();
      if (res) setData(res);
    },
  };
}

