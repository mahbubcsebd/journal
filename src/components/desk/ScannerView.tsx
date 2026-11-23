"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/components/desk/ui";
import { api, fmt } from "@/lib/desk/format";
import { useT } from "@/lib/desk/settings";
import type { CurrencyStrengthRow, OpenPosition, ScanRow, StrengthResponse, TF } from "@/lib/desk/types";
import WatchlistGrid from "./WatchlistGrid";

const TREND_COLOR = { bull: "text-jade", bear: "text-coral", neutral: "text-mute" } as const;
const STRENGTH_TFS: { value: TF; label: string }[] = [
  { value: "M15", label: "M15" },
  { value: "H1", label: "H1" },
  { value: "H4", label: "H4" },
  { value: "D1", label: "D1" },
];

export default function ScannerView({
  symbols = ["XAUUSD", "EURUSD", "GBPUSD"],
  positions = [],
  onOpen,
}: {
  symbols?: readonly string[];
  positions?: readonly OpenPosition[];
  onOpen(symbol: string, tf: TF): void;
}) {
  const t = useT();
  const [view, setView] = useState<"list" | "grid">("list");
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strengthTf, setStrengthTf] = useState<TF>("H1");
  const [strength, setStrength] = useState<StrengthResponse | null>(null);
  const [strengthError, setStrengthError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      api<{ rows: ScanRow[] }>("/api/scan")
        .then((r) => {
          if (!stop) {
            setRows(r.rows);
            setError(null);
          }
        })
        .catch((err) => !stop && setError((err as Error).message));
    load();
    const timer = setInterval(load, 30000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const load = () =>
      api<StrengthResponse>(`/api/strength?tf=${strengthTf}&lookback=24`)
        .then((r) => {
          if (!stop) {
            setStrength(r);
            setStrengthError(null);
          }
        })
        .catch((err) => !stop && setStrengthError((err as Error).message));
    load();
    const timer = setInterval(load, 30000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [strengthTf]);

  // Best first: zone already reached, then by grade, then no setup.
  const sorted = rows && [...rows].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="brief-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
      <div className={`mx-auto ${view === "grid" ? "max-w-[1400px]" : "max-w-[860px]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">{t("scan.title")}</h1>
            <p className="mt-1 max-w-[60ch] text-mute">{t("scan.lede")}</p>
          </div>
          <Segmented
            solid
            label={t("scan.mode")}
            value={view}
            onChange={(v) => {
              if (v === "list" || v === "grid") setView(v);
            }}
            options={[
              { value: "list", label: t("scan.modeList") },
              { value: "grid", label: t("scan.modeGrid") },
            ]}
          />
        </div>

        <StrengthMeter
          tf={strengthTf}
          onTfChange={setStrengthTf}
          data={strength}
          error={strengthError}
        />

        {view === "grid" ? (
          <WatchlistGrid symbols={symbols} positions={positions} onOpen={onOpen} />
        ) : (
          <>
            {error && <p className="mt-6 text-coral">{error}</p>}
            {!rows && !error && <p className="mt-6 text-mute">{t("state.loading")}</p>}

            {sorted && (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {sorted.map((r) => (
                  <li key={`${r.symbol}-${r.tf}`}>
                    <button
                      type="button"
                      onClick={() => onOpen(r.symbol, r.tf)}
                      className="grid w-full grid-cols-[5.5rem_1fr_auto] items-center gap-x-4 px-1 py-3 text-left hover:bg-hull sm:grid-cols-[7rem_5rem_1fr_auto]"
                    >
                      <span>
                        <span className="font-semibold">{r.symbol}</span> <span className="text-mute">{r.tf}</span>
                      </span>
                      <span className={`hidden text-[13px] font-semibold sm:block ${TREND_COLOR[r.trend]}`}>{t(`trend.${r.trend}`)}</span>
                      {r.setup ? (
                        <span className="tabular-nums">
                          <span className={r.setup.dir === "bull" ? "text-jade" : "text-coral"}>{t(r.setup.dir === "bull" ? "scan.buy" : "scan.sell")}</span>{" "}
                          {fmt(r.setup.entry, r.digits)}
                          <span className="ml-2 text-[13px] text-mute">
                            {r.setup.tapped ? t("scan.reached") : t("blocks.away", { d: fmt(r.setup.distance, r.digits) })}
                          </span>
                        </span>
                      ) : (
                        <span className="text-mute">{t("scan.none")}</span>
                      )}
                      <span className="text-right text-[13px] tabular-nums text-mute">
                        {r.setup ? t("scan.grade", { grade: r.setup.grade, rr: r.setup.rr.toFixed(1) }) : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[13px] text-mute">{t("scan.hint")}</p>
          </>
        )}
      </div>
    </div>
  );
}

function StrengthMeter({
  tf,
  onTfChange,
  data,
  error,
}: {
  tf: TF;
  onTfChange(tf: TF): void;
  data: StrengthResponse | null;
  error: string | null;
}) {
  const t = useT();
  const currencies: CurrencyStrengthRow[] = data?.currencies ?? [];
  return (
    <section aria-labelledby="strength-heading" className="mt-6 rounded-lg border border-line bg-hull p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="strength-heading" className="text-[15px] font-semibold text-ink">
            {t("scan.strength")}
          </h2>
          <p className="text-[13px] text-mute">{t("scan.strengthNote", { n: data?.lookback ?? 24 })}</p>
        </div>
        <Segmented value={tf} options={STRENGTH_TFS} onChange={onTfChange} label={t("scan.strengthTf")} />
      </div>

      {error && <p className="mt-3 text-[13px] text-coral">{error}</p>}
      {!data && !error && <p className="mt-3 text-[13px] text-mute">{t("state.loading")}</p>}
      {data && currencies.length === 0 && !error && <p className="mt-3 text-[13px] text-mute">{t("scan.strengthEmpty")}</p>}

      {currencies.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {currencies.map((c) => {
            const textCls = c.score >= 55 ? "text-jade" : c.score <= 45 ? "text-coral" : "text-mute";
            const bgCls = c.score >= 55 ? "bg-jade" : c.score <= 45 ? "bg-coral" : "bg-mute";
            const signed = `${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(2)}%`;
            return (
              <div key={c.currency} className="rounded-md border border-line bg-deck/60 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">{c.currency}</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${textCls}`}>{Math.round(c.score)}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-water">
                  <div className={`h-full rounded-full transition-[width] ${bgCls}`} style={{ width: `${Math.max(4, Math.min(100, c.score))}%` }} />
                </div>
                <div className="mt-1 text-right text-[12px] tabular-nums text-mute">{signed}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function rank(r: ScanRow) {
  if (!r.setup) return 9;
  return (r.setup.tapped ? 0 : 3) + { A: 0, B: 1, C: 2 }[r.setup.grade];
}
