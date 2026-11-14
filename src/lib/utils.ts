import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number, currency = "USD", opts: { sign?: boolean; compact?: boolean } = {}) {
  // Exness cent accounts report in USC (US cents): show "1,250.00 USC".
  if (currency === "USC") {
    const n = new Intl.NumberFormat("en-US", {
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: 2,
      minimumFractionDigits: opts.compact ? 0 : 2,
      signDisplay: opts.sign ? "exceptZero" : "auto",
    }).format(value);
    return `${n} USC`;
  }
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
    signDisplay: opts.sign ? "exceptZero" : "auto",
  });
  return fmt.format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function initials(nameOrEmail: string) {
  const base = nameOrEmail.split("@")[0];
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function formatDateTime(d: Date | string, timeZone: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...opts,
  }).format(new Date(d));
}

export function formatPrice(n: number | null | undefined) {
  if (n == null) return "—";
  const digits = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 10 ? 3 : 5;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

/** Very short signed amount for tight spaces: "+130", "-1.2K". Currency is implied by context. */
export function formatTiny(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const a = Math.abs(value);
  const body =
    a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : a >= 1000 ? `${(a / 1000).toFixed(a >= 10_000 ? 0 : 1)}K` : `${Math.round(a)}`;
  return sign + body;
}
