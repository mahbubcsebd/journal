"use client";

import { fmt, fmtR, fmtTime } from "@/lib/desk/format";
import { useT } from "@/lib/desk/settings";
import {
  CHECK_KEYS,
  SESSION_KEYS,
  WEEKDAY_KEYS,
  type BacktestResult,
  type BacktestStats,
  type Grade,
  type WalkForwardSlice,
} from "@/lib/desk/types";
import EquityChart from "./EquityChart";
import { Stat } from "./ui";

function WalkForwardCard({ title, slice, localTime }: { title: string; slice: WalkForwardSlice; localTime: boolean }) {
  const t = useT();
  const x = slice.stats;
  return (
    <div className="rounded-lg border border-line bg-hull p-3.5">
      <div className="text-[13px] font-semibold text-ink">{title}</div>
      <div className="mt-0.5 text-[12px] text-mute">
        {t("bt.splitRange", { n: slice.candles, from: fmtTime(slice.from, localTime), to: fmtTime(slice.to, localTime) })}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-[13px] tabular-nums">
        <div>
          <dt className="text-mute">{t("bt.trades")}</dt>
          <dd className="font-semibold">{x.trades}</dd>
        </div>
        <div>
          <dt className="text-mute">{t("bt.winRate")}</dt>
          <dd className="font-semibold">{x.trades ? `${(x.winRate * 100).toFixed(0)}%` : "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">{t("bt.expectancy")}</dt>
          <dd className={`font-semibold ${x.expectancy >= 0 ? "text-jade" : "text-coral"}`}>{fmtR(x.expectancy)}</dd>
        </div>
        <div>
          <dt className="text-mute">{t("bt.totalR")}</dt>
          <dd className={`font-semibold ${x.totalR >= 0 ? "text-jade" : "text-coral"}`}>{fmtR(x.totalR)}</dd>
        </div>
        <div>
          <dt className="text-mute">{t("bt.pf")}</dt>
          <dd className="font-semibold">{x.profitFactor === null ? "—" : x.profitFactor.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-mute">{t("bt.maxDd")}</dt>
          <dd className="font-semibold">{x.maxDrawdownR.toFixed(1)} R</dd>
        </div>
      </dl>
    </div>
  );
}

function BreakdownTable({
  title,
  colLabel,
  rows,
}: {
  title: string;
  colLabel: string;
  rows: { key: string; label: string; stats: BacktestStats }[];
}) {
  const t = useT();
  return (
    <div className="min-w-0">
      <h2 className="mb-2 text-[13px] font-semibold text-mute">{title}</h2>
      <table className="w-full text-left text-[14px] tabular-nums">
        <thead className="text-[13px] text-mute">
          <tr>
            <th className="py-1 font-normal">{colLabel}</th>
            <th className="py-1 font-normal">{t("bt.trades")}</th>
            <th className="py-1 font-normal">{t("bt.winRate")}</th>
            <th className="py-1 font-normal">{t("bt.avgR")}</th>
            <th className="py-1 text-right font-normal">{t("bt.totalR")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, stats: x }) => (
            <tr key={key} className="border-t border-line">
              <td className="py-1.5 font-semibold">{label}</td>
              <td>{x.trades}</td>
              <td>{x.trades ? `${(x.winRate * 100).toFixed(0)}%` : "—"}</td>
              <td className={x.trades ? (x.avgR >= 0 ? "text-jade" : "text-coral") : "text-mute"}>
                {x.trades ? fmtR(x.avgR) : "—"}
              </td>
              <td className={`text-right ${x.trades ? (x.totalR >= 0 ? "text-jade" : "text-coral") : "text-mute"}`}>
                {x.trades ? fmtR(x.totalR) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BacktestReport({ result, localTime }: { result: BacktestResult; localTime: boolean }) {
  const t = useT();
  const st = result.stats;
  const digits = result.digits;
  const grades: Grade[] = ["A", "B", "C"];
  const activeWeekdays = WEEKDAY_KEYS.filter((d) => result.byWeekday[d].trades > 0 || (d !== "sat" && d !== "sun"));

  if (st.trades === 0) return <p className="mt-4">{t("bt.noTrades")}</p>;

  return (
    <>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-5">
        <Stat label={t("bt.trades")} value={String(st.trades)} />
        <Stat label={t("bt.winRate")} value={`${(st.winRate * 100).toFixed(0)}%`} />
        <Stat label={t("bt.totalR")} value={fmtR(st.totalR)} tone={st.totalR >= 0 ? "good" : "bad"} />
        <Stat label={t("bt.expectancy")} value={fmtR(st.expectancy)} tone={st.expectancy >= 0 ? "good" : "bad"} />
        <Stat label={t("bt.pf")} value={st.profitFactor === null ? "—" : st.profitFactor.toFixed(2)} />
        <Stat label={t("bt.maxDd")} value={`${st.maxDrawdownR.toFixed(1)} R`} />
        <Stat label={t("bt.wl")} value={`${st.wins} / ${st.losses}`} />
        <Stat label={t("bt.avgWinLoss")} value={`+${st.avgWinR.toFixed(2)} / -${st.avgLossR.toFixed(2)} R`} />
        <Stat label={t("bt.cancelled")} value={String(st.cancelled)} />
      </dl>

      <h2 className="mb-2 mt-8 text-[13px] font-semibold text-mute">{t("bt.equity")}</h2>
      <div className="rounded-lg border border-line bg-hull p-3">
        <EquityChart trades={result.trades} from={result.from} localTime={localTime} label={t("bt.equity")} />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <BreakdownTable
          title={t("bt.byGrade")}
          colLabel={t("bt.grade")}
          rows={grades.map((g) => ({ key: g, label: g, stats: result.byGrade[g] }))}
        />
        <BreakdownTable
          title={t("bt.calibratedGrades")}
          colLabel={t("bt.grade")}
          rows={grades.map((g) => ({ key: g, label: g, stats: result.byCalibratedGrade[g] }))}
        />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <BreakdownTable
          title={t("bt.bySession")}
          colLabel={t("bt.session")}
          rows={SESSION_KEYS.map((k) => ({ key: k, label: t(`bt.session.${k}`), stats: result.bySession[k] }))}
        />
        <BreakdownTable
          title={t("bt.byWeekday")}
          colLabel={t("bt.weekday")}
          rows={activeWeekdays.map((d) => ({ key: d, label: t(`bt.day.${d}`), stats: result.byWeekday[d] }))}
        />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-2 text-[13px] font-semibold text-mute">{t("bt.byCheck")}</h2>
          <table className="w-full text-left text-[13px] tabular-nums">
            <thead className="text-mute">
              <tr>
                <th className="py-1 font-normal">{t("bt.rule")}</th>
                <th className="py-1 font-normal">{t("bt.passed")}</th>
                <th className="py-1 text-right font-normal">{t("bt.failed")}</th>
              </tr>
            </thead>
            <tbody>
              {CHECK_KEYS.map((k) => {
                const p = result.byCheck[k].passed;
                const f = result.byCheck[k].failed;
                return (
                  <tr key={k} className="border-t border-line">
                    <td className="py-1.5 font-medium">{t(`bt.rule.${k}`)}</td>
                    <td className={p.trades ? (p.avgR >= 0 ? "text-jade" : "text-coral") : "text-mute"}>
                      {p.trades ? `${p.trades} (${(p.winRate * 100).toFixed(0)}%, ${fmtR(p.avgR)})` : "—"}
                    </td>
                    <td className={`text-right ${f.trades ? (f.avgR >= 0 ? "text-jade" : "text-coral") : "text-mute"}`}>
                      {f.trades ? `${f.trades} (${(f.winRate * 100).toFixed(0)}%, ${fmtR(f.avgR)})` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="min-w-0">
          <h2 className="mb-1 text-[13px] font-semibold text-mute">{t("bt.calibration")}</h2>
          <p className="mb-2 text-[12px] text-mute">{t("bt.calibrationNote")}</p>
          <table className="w-full text-left text-[13px] tabular-nums">
            <thead className="text-mute">
              <tr>
                <th className="py-1 font-normal">{t("bt.rule")}</th>
                <th className="py-1 font-normal">{t("bt.lift")}</th>
                <th className="py-1 text-right font-normal">{t("bt.weight")}</th>
              </tr>
            </thead>
            <tbody>
              {result.calibration.map((c) => (
                <tr key={c.key} className="border-t border-line">
                  <td className="py-1.5 font-medium">{t(`bt.rule.${c.key}`)}</td>
                  <td className={c.liftR > 0 ? "text-jade" : c.liftR < 0 ? "text-coral" : "text-mute"}>
                    {c.passedTrades > 0 && c.failedTrades > 0 ? fmtR(c.liftR) : "—"}
                  </td>
                  <td className={`text-right font-semibold ${c.weight > 1.05 ? "text-jade" : c.weight < 0.95 ? "text-coral" : "text-ink"}`}>
                    {c.weight.toFixed(2)}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {result.walkForward && (
        <>
          <h2 className="mb-2 mt-8 text-[13px] font-semibold text-mute">{t("bt.walkForward")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <WalkForwardCard title={t("bt.inSample")} slice={result.walkForward.inSample} localTime={localTime} />
            <WalkForwardCard title={t("bt.outOfSample")} slice={result.walkForward.outOfSample} localTime={localTime} />
          </div>
        </>
      )}

      <h2 className="mb-2 mt-8 text-[13px] font-semibold text-mute">{t("bt.lastTrades")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[14px] tabular-nums">
          <thead className="text-[13px] text-mute">
            <tr>
              <th className="py-1 font-normal">{t("bt.entryTime")}</th>
              <th className="py-1 font-normal">{t("bt.side")}</th>
              <th className="py-1 font-normal">{t("bt.grade")}</th>
              <th className="py-1 font-normal">{t("row.entry")}</th>
              <th className="py-1 font-normal">{t("row.stop")}</th>
              <th className="py-1 font-normal">{t("row.target")}</th>
              <th className="py-1 font-normal">{t("bt.exit")}</th>
              <th className="py-1 text-right font-normal">{t("bt.result")}</th>
            </tr>
          </thead>
          <tbody>
            {result.trades
              .slice(-25)
              .reverse()
              .map((tr) => (
                <tr key={`${tr.entryTime}-${tr.entry}`} className="border-t border-line">
                  <td className="py-1.5">{fmtTime(tr.entryTime, localTime)}</td>
                  <td className={tr.dir === "bull" ? "text-jade" : "text-coral"}>{t(tr.dir === "bull" ? "scan.buy" : "scan.sell")}</td>
                  <td>{tr.grade}</td>
                  <td>{fmt(tr.entry, digits)}</td>
                  <td>{fmt(tr.stop, digits)}</td>
                  <td>{fmt(tr.target, digits)}</td>
                  <td className="text-mute">{tr.exitReason ? t(`bt.exit.${tr.exitReason}`) : "—"}</td>
                  <td className={`text-right font-semibold ${tr.resultR > 0 ? "text-jade" : tr.resultR < 0 ? "text-coral" : "text-mute"}`}>
                    {fmtR(tr.resultR)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
