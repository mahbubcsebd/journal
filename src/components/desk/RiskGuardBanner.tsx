"use client";

import { fmtR } from "@/lib/desk/format";
import { useT } from "@/lib/desk/settings";
import type { RiskGuardStatus } from "@/lib/desk/types";

interface Props {
  status: RiskGuardStatus | null;
  onOpenSettings(): void;
}

export default function RiskGuardBanner({ status, onOpenSettings }: Props) {
  const t = useT();
  if (!status || !status.anyLimitHit) return null;

  const message =
    status.lossLimitHit && status.tradesLimitHit
      ? t("riskGuard.bothHit", {
          n: status.tradesToday,
          maxT: status.maxTrades,
          r: fmtR(-status.effectiveLostR),
          maxR: status.maxLossR,
        })
      : status.lossLimitHit
        ? t("riskGuard.lossHit", { r: fmtR(-status.effectiveLostR), max: status.maxLossR })
        : t("riskGuard.tradesHit", { n: status.tradesToday, max: status.maxTrades });

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-coral/50 bg-coral/15 px-4 py-2 text-[13px] text-ink"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-coral pulse-dot" aria-hidden />
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <span className="font-bold uppercase tracking-wider text-coral">{t("riskGuard.title")}</span>
          <span className="font-medium text-ink">{message}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {status.maxTrades > 0 && (
          <span
            className={`rounded border px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
              status.tradesLimitHit ? "border-coral/50 bg-water/60 text-coral" : "border-line bg-hull/60 text-mute"
            }`}
          >
            {t("riskGuard.tradesCount", { n: status.tradesToday, max: status.maxTrades })}
          </span>
        )}
        {status.maxLossR > 0 && (
          <span
            className={`rounded border px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
              status.lossLimitHit ? "border-coral/50 bg-water/60 text-coral" : "border-line bg-hull/60 text-mute"
            }`}
          >
            {fmtR(status.netR)} / -{status.maxLossR} R
          </span>
        )}
        {status.floatingUsd < 0 && (
          <span className="rounded border border-coral/40 bg-water/60 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-coral">
            {t("riskGuard.floating", { v: `-$${Math.abs(status.floatingUsd).toFixed(2)}` })}
          </span>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded border border-line bg-water/80 px-2.5 py-1 text-[12px] font-semibold text-ink transition-colors hover:bg-water"
        >
          {t("riskGuard.limits")}
        </button>
      </div>
    </div>
  );
}
