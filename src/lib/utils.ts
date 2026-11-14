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
