"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { DICT, type Lang } from "./i18n";
import type { TF } from "./types";

export interface Layers {
  blocks: boolean;
  structure: boolean;
  liquidity: boolean;
  fvg: boolean;
  range: boolean;
  sessions: boolean;
  levels: boolean;
  ote: boolean;
  breakers: boolean;
  swings: boolean;
}

export const SIMPLE_LAYERS: Layers = {
  blocks: true,
  structure: true,
  liquidity: true,
  fvg: false,
  range: false,
  sessions: false,
  levels: false,
  ote: false,
  breakers: false,
  swings: false,
};

export const PRO_LAYERS: Layers = {
  blocks: true,
  structure: true,
  liquidity: true,
  fvg: true,
  range: true,
  sessions: true,
  levels: true,
  ote: false,
  breakers: false,
  swings: false,
};

export interface Settings {
  lang: Lang;
  mode: "simple" | "pro";
  layers: Layers;
  minScore: number;
  symbol: string;
  tf: TF;
  /** show a higher-timeframe chart next to the main one */
  split: boolean;
  /** chosen higher timeframe; null = the default for the main timeframe */
  splitTf: TF | null;
  localTime: boolean;
  alertToast: boolean;
  alertNotify: boolean;
  alertSound: boolean;
  balance: number;
  riskPct: number;
  maxTrades: number;
  maxLossR: number;
}

const DEFAULTS: Settings = {
  lang: "en",
  mode: "simple",
  layers: SIMPLE_LAYERS,
  minScore: 3,
  symbol: "XAUUSD",
  tf: "M15",
  split: false,
  splitTf: null,
  localTime: true,
  alertToast: true,
  alertNotify: false,
  alertSound: false,
  balance: 1000,
  riskPct: 1,
  maxTrades: 3,
  maxLossR: 2,
};

const KEY = "smc-desk-settings-v1";

interface Ctx {
  s: Settings;
  set(patch: Partial<Settings>): void;
}

const SettingsContext = createContext<Ctx>({ s: DEFAULTS, set: () => {} });

let cachedRaw: string | null | undefined;
let cachedSettings: Settings = DEFAULTS;
const listeners = new Set<() => void>();

function readSnapshot(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedSettings;
    cachedRaw = raw;
    const saved = raw ? (JSON.parse(raw) as Partial<Settings>) : null;
    cachedSettings = saved ? { ...DEFAULTS, ...saved, layers: { ...DEFAULTS.layers, ...saved.layers } } : DEFAULTS;
  } catch {
    cachedSettings = DEFAULTS;
  }
  return cachedSettings;
}

const getServerSnapshot = () => DEFAULTS;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const s = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);

  const set = useCallback((patch: Partial<Settings>) => {
    const next = { ...readSnapshot(), ...patch };
    const raw = JSON.stringify(next);
    cachedRaw = raw;
    cachedSettings = next;
    try {
      localStorage.setItem(KEY, raw);
    } catch {
      // Not persisted; still keeps the in-memory snapshot for this visit.
    }
    for (const listener of listeners) listener();
  }, []);

  useEffect(() => {
    document.documentElement.lang = s.lang;
  }, [s.lang]);

  const value = useMemo(() => ({ s, set }), [s, set]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

export type T = (key: string, params?: Record<string, string | number>) => string;

/** Translate a key; `{name}` placeholders are filled from params. */
export function useT(): T {
  const { s } = useSettings();
  return useCallback(
    (key, params) => {
      let text = DICT[s.lang][key] ?? DICT.en[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
      return text;
    },
    [s.lang],
  );
}
