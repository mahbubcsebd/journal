import type { SymbolInfo } from "./types";

export function fmt(value: number, digits: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtR(r: number) {
  return `${r > 0 ? "+" : ""}${r.toFixed(2)} R`;
}

/** Clock times are shown in 12-hour form everywhere (e.g. "11 Nov, 2:30 pm"). */
export function fmtClock(t: number, local: boolean, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...opts, hour12: true, timeZone: local ? undefined : "UTC" }).format(new Date(t * 1000));
}

export function fmtTime(t: number, local: boolean) {
  return fmtClock(t, local, { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

/** 1124 minutes -> "18h 44m". `t` supplies the unit labels (dur.d / dur.h / dur.m). */
export function fmtDuration(totalMinutes: number, t: (key: string) => string) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const d = Math.floor(minutes / MINUTES_PER_DAY);
  const h = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  if (d > 0) return `${d}${t("dur.d")} ${h}${t("dur.h")}`;
  if (h > 0) return `${h}${t("dur.h")} ${m}${t("dur.m")}`;
  return `${m}${t("dur.m")}`;
}

export const COLORS = {
  ink: "#e7eeea",
  mute: "#8fa5a8",
  line: "#27434e",
  gold: "#e5b84b",
  jade: "#57bfa4",
  coral: "#e57b63",
};

export function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * All SMC server calls go through Journal's authenticated proxy, which adds the
 * server access key on the server side. The browser never holds that key.
 */
export function apiBase() {
  return "/api/desk";
}

/** Headers for every proxied request (the proxy adds the access key). */
export function apiHeaders(json = false): Record<string, string> {
  return json ? { "Content-Type": "application/json" } : {};
}

/** WebSocket URL with a short-lived signed token issued by Journal. */
export async function wsUrl(): Promise<string> {
  const res = await fetch("/api/desk/ws", { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? `Live feed unavailable (${res.status})`);
  return body.url;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiBase() + path, {
    ...init,
    headers: apiHeaders(Boolean(init?.body)),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

/**
 * Lot size so that hitting the stop loses `riskMoney` (account in USD).
 * Uses exact MT5 broker `SymbolInfo` tick value / tick size / step when
 * available, falling back to standard contract size estimation.
 */
export function lotSize(symbol: string, entry: number, stop: number, riskMoney: number, info?: SymbolInfo | null) {
  const slDist = Math.abs(entry - stop);
  const hasSpec = Boolean(info && info.tradeTickSize > 0 && info.tradeTickValue > 0);
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(riskMoney) || slDist <= 0 || riskMoney <= 0) {
    return { lots: 0, loss: 0, exact: hasSpec };
  }

  let lossPerLot: number;
  let exact: boolean;
  if (hasSpec && info) {
    lossPerLot = (slDist / info.tradeTickSize) * info.tradeTickValue;
    exact = true;
  } else {
    const s = symbol.toUpperCase();
    const contract = s.startsWith("XAU") ? 100 : s.startsWith("XAG") ? 5000 : s.startsWith("BTC") || s.startsWith("ETH") ? 1 : 100000;
    const quote = s.slice(3, 6);
    const base = s.slice(0, 3);
    lossPerLot = slDist * contract;
    exact = true;
    if (quote !== "USD") {
      if (base === "USD") lossPerLot /= entry;
      else exact = false;
    }
  }
  if (!(lossPerLot > 0)) return { lots: 0, loss: 0, exact };

  const step = info && info.volumeStep > 0 ? info.volumeStep : 0.01;
  const minVol = info && info.volumeMin > 0 ? info.volumeMin : 0.01;
  const maxVol = info && info.volumeMax > 0 ? info.volumeMax : 1000;
  const stepped = Math.floor((riskMoney / lossPerLot + 1e-12) / step) * step;
  const lots = Math.min(maxVol, Number(stepped.toFixed(6)));
  if (lots < minVol) return { lots: 0, loss: 0, exact };
  return { lots, loss: lots * lossPerLot, exact };
}

export function downloadFile(name: string, content: string | Blob, type = "text/plain") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
