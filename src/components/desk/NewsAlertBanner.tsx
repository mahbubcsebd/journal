"use client";

import { useState } from "react";
import { fmtDuration, fmtTime } from "@/lib/desk/format";
import { useSettings, useT } from "@/lib/desk/settings";
import type { EconomicEvent, NewsAlert } from "@/lib/desk/types";
import { useNowSec } from "@/lib/desk/useNews";
import NewsModal from "./NewsModal";

interface Props {
  alert: NewsAlert | null;
  events: EconomicEvent[];
  onDismiss(id: string): void;
}

export default function NewsAlertBanner({ alert, events, onDismiss }: Props) {
  const t = useT();
  const { s } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const nowSec = useNowSec();

  // Counted from the release time on this device, so it moves between server polls.
  const mins = alert ? Math.round((alert.event.timestamp - nowSec) / 60) : 0;
  const isWarning = alert?.level === "warning";
  const accent = isWarning ? "text-coral" : "text-gold";

  const renderCountdown = () => {
    if (mins === 0) return t("news.now");
    const n = fmtDuration(Math.abs(mins), t);
    return mins < 0 ? t("news.minsAgo", { n }) : t("news.inMinutes", { n });
  };
  const label =
    mins < 0
      ? t(isWarning ? "news.alertReleased" : "news.alertReleasedMedium")
      : t(isWarning ? "news.alertWarning" : "news.alertCaution");

  return (
    <>
      {alert && alert.active && (
        <div
          role="alert"
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-[13px] transition-all border-b ${
            alert.level === "warning"
              ? "border-coral/50 bg-coral/15 text-ink"
              : "border-gold/50 bg-gold/15 text-ink"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                alert.level === "warning" ? "bg-coral pulse-dot" : "bg-gold"
              }`}
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={`font-bold uppercase tracking-wider ${accent}`}>{label}</span>
              <span className="font-semibold text-ink">
                {alert.event.country} {alert.event.title}
              </span>
              <span
                className={`rounded bg-water/60 px-2 py-0.5 font-bold tabular-nums border ${accent} ${
                  isWarning ? "border-coral/40" : "border-gold/40"
                }`}
              >
                {renderCountdown()}
              </span>
              <span className="hidden md:inline text-mute text-[12px]">
                ({fmtTime(alert.event.timestamp, s.localTime)}) — {t("news.volatilityNotice")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded bg-water/80 px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-water border border-line transition-colors"
            >
              {t("news.title")}
            </button>
            <button
              type="button"
              onClick={() => onDismiss(alert.event.id)}
              aria-label={t("news.dismiss")}
              className="rounded px-2 py-1 text-mute hover:text-ink transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {modalOpen && <NewsModal events={events} onClose={() => setModalOpen(false)} />}
    </>
  );
}

export function NewsPill({
  events,
  nextEvent,
}: {
  events: EconomicEvent[];
  nextEvent?: EconomicEvent | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  if (!events || events.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-line bg-deck px-2.5 py-1 text-[12px] font-semibold text-mute hover:border-gold hover:text-ink transition-colors"
        title={t("news.title")}
      >
        <span>📅</span>
        <span className="hidden sm:inline">{t("news.title")}</span>
        {nextEvent && (
          <span className="inline-flex items-center gap-1 text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            <span className="max-w-[120px] truncate">{nextEvent.title}</span>
          </span>
        )}
      </button>

      {open && <NewsModal events={events} onClose={() => setOpen(false)} />}
    </>
  );
}

