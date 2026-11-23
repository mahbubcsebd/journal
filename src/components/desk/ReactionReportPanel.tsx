"use client";

import { useState } from "react";
import { api, fmtTime } from "@/lib/desk/format";
import { useT, type T } from "@/lib/desk/settings";
import type { RateCell, ReactionReport, TF } from "@/lib/desk/types";
import { KIND_LABEL } from "./ReactionZones";
import { buttonClass } from "./ui";

/** Rows with fewer touches than this are shown muted. */
const MIN_SAMPLE = 30;
const MAX_LIFTS_SHOWN = 10;

const pct = (p: number) => `${Math.round(p * 100)}%`;

const FEATURE_LABEL: Record<string, string> = {
  htf: "Higher timeframe",
  location: "Location",
  session: "Session",
  touchNo: "Touch",
  obScore: "OB score",
  adr: "Daily range used",
  confluence: "Stacking",
};

const BUCKET_LABEL: Record<string, string> = {
  with: "with trend",
  against: "against trend",
  discount: "discount",
  premium: "premium",
  asia: "Asia",
  london: "London",
  newyork: "New York",
  off: "off hours",
  first: "first",
  repeat: "repeat",
  low: "0–2",
  mid: "3",
  high: "4–5",
  lt50: "under 50%",
  r50_80: "50–80%",
  r80_100: "80–100%",
  gt100: "over 100%",
  c0: "alone",
  c1: "1 neighbour",
  c2plus: "2+ neighbours",
};

function liftLabel(key: string): string {
  const [feature, bucket] = key.split(":");
  return `${FEATURE_LABEL[feature] ?? feature}: ${BUCKET_LABEL[bucket] ?? bucket}`;
}

function cellKind(key: string, t: T): { label: string; side: string } {
  const [kind, side] = key.split(":");
  return { label: KIND_LABEL[kind] ?? kind, side: t(side === "support" ? "rzr.support" : "rzr.resistance") };
}

function KindTable({ cells, t }: { cells: Record<string, RateCell>; t: T }) {
  const rows = Object.entries(cells).sort((a, b) => b[1].n - a[1].n);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px] tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-mute">
            <th className="py-1.5 pr-3 font-semibold">{t("rzr.kind")}</th>
            <th className="py-1.5 pr-3 font-semibold">{t("rzr.side")}</th>
            <th className="py-1.5 pr-3 text-right font-semibold">{t("rzr.touches")}</th>
            <th className="py-1.5 pr-3 text-right font-semibold">{t("rzr.reacted")}</th>
            <th className="py-1.5 pr-3 text-right font-semibold">{t("rzr.twoAtr")}</th>
            <th className="py-1.5 pr-3 text-right font-semibold">{t("rzr.depth")}</th>
            <th className="py-1.5 pr-3 text-right font-semibold">{t("rzr.run2")}</th>
            <th className="py-1.5 text-right font-semibold">{t("rzr.sweep")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, c]) => {
            const { label, side } = cellKind(key, t);
            const small = c.n < MIN_SAMPLE;
            return (
              <tr key={key} className={`border-t border-line ${small ? "text-mute" : ""}`} title={small ? t("rzr.small", { n: MIN_SAMPLE }) : undefined}>
                <td className="py-1.5 pr-3 font-semibold">{label}</td>
                <td className={`py-1.5 pr-3 ${key.endsWith("support") ? "text-jade" : "text-coral"}`}>{side}</td>
                <td className="py-1.5 pr-3 text-right">{c.n}</td>
                <td className="py-1.5 pr-3 text-right">
                  <span className="font-semibold">{pct(c.reactions / Math.max(1, c.n))}</span>{" "}
                  <span className="text-[12px] text-mute">
                    {pct(c.low)}–{pct(c.high)}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right">{pct(c.reactedTwo / Math.max(1, c.n))}</td>
                <td className="py-1.5 pr-3 text-right">{pct(c.depthMedian)}</td>
                <td className="py-1.5 pr-3 text-right">{c.runMedian.toFixed(1)}</td>
                <td className="py-1.5 text-right">{c.reactions ? pct(c.sweepReverse / c.reactions) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Lifts({ lifts, applied, t }: { lifts: Record<string, number>; applied: boolean; t: T }) {
  const rows = Object.entries(lifts)
    .map(([key, v]) => ({ key, odds: Math.exp(v) }))
    .sort((a, b) => Math.abs(Math.log(b.odds)) - Math.abs(Math.log(a.odds)))
    .slice(0, MAX_LIFTS_SHOWN);
  return (
    <ul className={`grid gap-x-6 gap-y-1 text-[13px] tabular-nums sm:grid-cols-2 ${applied ? "" : "opacity-60"}`}>
      {rows.map((r) => (
        <li key={r.key} className="flex items-baseline justify-between gap-3 border-t border-line py-1.5">
          <span>{liftLabel(r.key)}</span>
          <span className={`font-semibold ${r.odds >= 1 ? "text-jade" : "text-coral"}`}>×{r.odds.toFixed(2)}</span>
        </li>
      ))}
      <li className="col-span-full text-[12px] text-mute">{t("rzr.liftsHint")}</li>
    </ul>
  );
}

function Calibration({ report, t }: { report: ReactionReport; t: T }) {
  const { bins } = report.validation;
  if (bins.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-[13px] tabular-nums">
      {bins.map((b) => (
        <li key={b.lo} className="grid grid-cols-[72px_1fr_92px] items-center gap-3">
          <span className="text-mute">{pct(b.lo)}–{pct(b.hi)}</span>
          <div className="relative h-1.5 rounded-full bg-line" aria-hidden>
            <div className="absolute inset-y-0 left-0 rounded-full bg-gold" style={{ width: pct(b.realised) }} />
            <div className="absolute -top-0.5 h-2.5 w-0.5 bg-ink" style={{ left: pct(b.predicted) }} />
          </div>
          <span className="text-right text-[12px] text-mute">
            {t("rzr.predicted")} {pct(b.predicted)} · {t("rzr.realised")} {pct(b.realised)}
          </span>
        </li>
      ))}
      <li className="text-[12px] text-mute">{t("rzr.calHint")}</li>
    </ul>
  );
}

function Verdict({ report, t }: { report: ReactionReport; t: T }) {
  const v = report.validation;
  if (v.brierBase === null || v.brierModel === null) return <p className="text-[13px] text-mute">{t("rzr.tooFew")}</p>;
  const args = { model: v.brierModel.toFixed(4), base: v.brierBase.toFixed(4) };
  return (
    <p className={`border-l-2 pl-3 text-[13px] ${v.validated ? "border-jade" : "border-line text-mute"}`}>
      {t(v.validated ? "rzr.validated" : "rzr.notValidated", args)}
    </p>
  );
}

export default function ReactionReportPanel({ symbol, tf, localTime }: { symbol: string; tf: TF; localTime: boolean }) {
  const t = useT();
  const [report, setReport] = useState<ReactionReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await api<ReactionReport>(`/api/reaction-report?${new URLSearchParams({ symbol, tf })}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-[20px] font-semibold tracking-tight">{t("rzr.title")}</h2>
      <p className="mt-1 max-w-[62ch] text-mute">{t("rzr.lede")}</p>
      <div className="mt-4">
        <button type="button" className={buttonClass} onClick={run} disabled={busy}>
          {busy ? t("rzr.running") : t("rzr.run")}
        </button>
      </div>
      {error && <p className="mt-4 text-coral">{error}</p>}
      {report && report.symbol === symbol && (
        <div className="mt-5 space-y-6">
          <p className="text-[13px] text-mute">
            {t("rzr.period", { n: report.touches, from: fmtTime(report.from, localTime), to: fmtTime(report.to, localTime) })}
          </p>
          <Verdict report={report} t={t} />
          <KindTable cells={report.kinds} t={t} />
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-mute">{t("rzr.liftsTitle")}</h3>
            <Lifts lifts={report.lifts} applied={report.validation.validated} t={t} />
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-mute">{t("rzr.calTitle")}</h3>
            <Calibration report={report} t={t} />
          </div>
          <p className="max-w-[66ch] text-[13px] text-mute">{t("rzr.how")}</p>
        </div>
      )}
    </section>
  );
}
