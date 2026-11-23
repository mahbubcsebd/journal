"use client";

import { useState } from "react";
import { COLORS, fmt, fmtR, rgba } from "@/lib/desk/format";
import { useT } from "@/lib/desk/settings";
import type { CalendarDayCell, JournalAnalytics as AnalyticsData, JournalBucketStats } from "@/lib/desk/types";
import EquityChart from "./EquityChart";
import { Segmented } from "./ui";

const WEEK_LABELS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function fmtUsd(v: number): string {
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}$${fmt(Math.abs(v), 2)}`;
}

function bucketSummary(b: JournalBucketStats): { text: string; tone: string } {
  const parts: string[] = [];
  if (b.rTrades > 0) parts.push(fmtR(b.totalR));
  if (b.usdTrades > 0) parts.push(fmtUsd(b.totalUsd));
  const net = b.rTrades > 0 ? b.totalR : b.totalUsd;
  return {
    text: parts.join(" / ") || "0",
    tone: net > 0 ? "text-jade" : net < 0 ? "text-coral" : "text-mute",
  };
}

function BucketCard({ title, rows }: { title: string; rows: { label: string; stats: JournalBucketStats }[] }) {
  const visible = rows.filter((r) => r.stats.trades > 0);
  if (visible.length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-hull p-3.5">
      <h3 className="mb-2 text-[13px] font-semibold text-mute">{title}</h3>
      <ul className="divide-y divide-line text-[13px] tabular-nums">
        {visible.map(({ label, stats }) => {
          const sum = bucketSummary(stats);
          return (
            <li key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-1.5">
              <span className="truncate">{label}</span>
              <span className="text-mute">
                {stats.trades} · {(stats.winRate * 100).toFixed(0)}%
              </span>
              <span className={`text-right font-semibold ${sum.tone}`}>{sum.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function cellBackground(cell: CalendarDayCell, maxMagnitude: number, useUsd: boolean): string {
  if (cell.trades === 0) return "#1b313b";
  const metric = useUsd ? cell.totalUsd : cell.totalR;
  if (metric === 0) return COLORS.line;
  const intensity = Math.min(1, Math.max(0.28, Math.abs(metric) / Math.max(0.01, maxMagnitude)));
  return rgba(metric > 0 ? COLORS.jade : COLORS.coral, intensity);
}

export default function JournalAnalytics({ analytics, localTime }: { analytics: AnalyticsData; localTime: boolean }) {
  const t = useT();
  const hasR = analytics.overall.rTrades > 0;
  const hasUsd = analytics.overall.usdTrades > 0;
  const [unitPref, setUnitPref] = useState<"R" | "USD">("R");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (analytics.overall.trades === 0) return null;

  const activeUnit: "R" | "USD" = hasR && hasUsd ? unitPref : hasUsd ? "USD" : "R";
  const curvePoints = analytics.equityCurve.map((p) => ({
    time: p.time,
    value: activeUnit === "USD" ? p.cumulativeUsd : p.cumulativeR,
  }));

  const useUsdHeat = activeUnit === "USD";
  const maxMagnitude = analytics.calendarDays.reduce(
    (m, c) => Math.max(m, Math.abs(useUsdHeat ? c.totalUsd : c.totalR)),
    useUsdHeat ? 25 : 1,
  );
  const activeDay =
    analytics.calendarDays.find((d) => d.date === selectedDate) ??
    [...analytics.calendarDays].reverse().find((d) => d.trades > 0) ??
    null;

  const gradeRows = (["A", "B", "C", "none"] as const).map((g) => ({
    label: g === "none" ? t("journal.gradeNone") : `${t("bt.grade")} ${g}`,
    stats: analytics.byGrade[g],
  }));
  const sessionRows = (["asia", "london", "newyork", "off"] as const).map((s) => ({
    label: t(`bt.session.${s}`),
    stats: analytics.bySession[s],
  }));
  const dayRows = WEEK_LABELS.map((d) => ({
    label: t(`bt.day.${d}`),
    stats: analytics.byWeekday[d],
  }));

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-lg border border-line bg-hull p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-mute">{t("journal.equityCurve")}</h2>
          {hasR && hasUsd && (
            <Segmented<"R" | "USD">
              label={t("journal.equityCurve")}
              value={activeUnit}
              onChange={setUnitPref}
              options={[
                { value: "R", label: t("journal.unitR") },
                { value: "USD", label: t("journal.unitUsd") },
              ]}
            />
          )}
        </div>
        <EquityChart points={curvePoints} unit={activeUnit} localTime={localTime} label={t("journal.equityCurve")} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BucketCard title={t("journal.byGrade")} rows={gradeRows} />
        <BucketCard title={t("bt.bySession")} rows={sessionRows} />
        <BucketCard title={t("bt.byWeekday")} rows={dayRows} />
      </div>

      <div className="rounded-lg border border-line bg-hull p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-mute">{t("journal.calendar")}</h2>
          {activeDay && activeDay.trades > 0 && (
            <span className="text-[13px] tabular-nums text-mute">
              {t("journal.daySummary", { date: activeDay.date, n: activeDay.trades, wins: activeDay.wins })}{" "}
              {activeDay.totalR !== 0 && <span className={activeDay.totalR > 0 ? "text-jade" : "text-coral"}>{fmtR(activeDay.totalR)} </span>}
              {activeDay.totalUsd !== 0 && <span className={activeDay.totalUsd > 0 ? "text-jade" : "text-coral"}>{fmtUsd(activeDay.totalUsd)}</span>}
            </span>
          )}
        </div>

        <div className="flex items-start gap-2.5 overflow-x-auto pb-1">
          <div className="grid grid-rows-7 gap-1.5 text-[11px] leading-4 text-mute">
            {WEEK_LABELS.map((d, idx) => (
              <span key={d} className={idx % 2 === 0 ? "h-4" : "h-4 opacity-0"}>
                {t(`bt.day.${d}`)}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-1.5">
            {analytics.calendarDays.map((cell) => {
              const titleParts = [cell.date, `${cell.trades} trades`, `${cell.wins} won`];
              if (cell.totalR !== 0) titleParts.push(fmtR(cell.totalR));
              if (cell.totalUsd !== 0) titleParts.push(fmtUsd(cell.totalUsd));
              const isSelected = activeDay?.date === cell.date && cell.trades > 0;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => cell.trades > 0 && setSelectedDate(cell.date)}
                  title={titleParts.join(" · ")}
                  aria-label={titleParts.join(" · ")}
                  style={{ backgroundColor: cellBackground(cell, maxMagnitude, useUsdHeat) }}
                  className={`h-4 w-4 rounded-xs transition-transform ${
                    cell.trades > 0 ? "cursor-pointer hover:scale-110" : "cursor-default"
                  } ${isSelected ? "ring-1 ring-gold" : ""}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
