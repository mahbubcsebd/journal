"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./format";
import type { AlertCondition, PriceAlert, TF } from "./types";

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  const reload = useCallback(() => {
    api<{ alerts: PriceAlert[] }>("/api/alerts")
      .then((res) => setAlerts(res.alerts))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (input: { symbol: string; tf: TF; condition: AlertCondition; targetPrice: number | null; note: string }) => {
      const res = await api<{ alert: PriceAlert }>("/api/alerts", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setAlerts((cur) => [res.alert, ...cur]);
      return res.alert;
    },
    [],
  );

  const rearm = useCallback(async (id: string) => {
    const res = await api<{ alert: PriceAlert }>(`/api/alerts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    setAlerts((cur) => cur.map((a) => (a.id === id ? res.alert : a)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await api(`/api/alerts/${id}`, { method: "DELETE" });
    setAlerts((cur) => cur.filter((a) => a.id !== id));
  }, []);

  return { alerts, reload, create, rearm, remove };
}

