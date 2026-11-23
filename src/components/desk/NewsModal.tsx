"use client";

import { useMemo, useState } from "react";
import { fmtDuration, fmtTime } from "@/lib/desk/format";
import { useSettings, useT } from "@/lib/desk/settings";
import type { EconomicEvent } from "@/lib/desk/types";
import { useNowSec } from "@/lib/desk/useNews";
import { Modal } from "./ui";

interface Props {
  events: EconomicEvent[];
  onClose(): void;
}

export default function NewsModal({ events, onClose }: Props) {
  const t = useT();
  const { s } = useSettings();
  const [filter, setFilter] = useState<"All" | "High" | "Medium">("High");

  const nowSec = useNowSec();

  const filtered = useMemo(() => {
    return events
      .filter((e) => {
        if (filter === "High") return e.impact === "High";
        if (filter === "Medium") return e.impact === "High" || e.impact === "Medium";
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [events, filter]);

  const formatCountdown = (timestamp: number) => {
    const mins = Math.round((timestamp - nowSec) / 60);
    if (mins === 0) return t("news.now");
    const n = fmtDuration(Math.abs(mins), t);
    return mins < 0 ? t("news.minsAgo", { n }) : t("news.inMinutes", { n });
  };

  return (
    <Modal title={t("news.title")} onClose={onClose}>
      <div className="space-y-4">
        {/* Filter buttons */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex gap-1.5">
            {(["High", "Medium", "All"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFilter(level)}
                className={`rounded px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  filter === level
                    ? "bg-deck text-ink border border-line"
                    : "text-mute hover:text-ink"
                }`}
              >
                {level === "High" ? `🔴 ${t("news.high")}` : level === "Medium" ? `🟡 ${t("news.medium")}` : t("news.upcoming")}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-mute">{t("news.events", { n: filtered.length })}</span>
        </div>

        {/* Event List */}
        <div className="brief-scroll max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-mute">
              {t("news.noUpcoming")}
            </div>
          ) : (
            filtered.map((item) => {
              const isPast = item.timestamp < nowSec;
              const isImminent = !isPast && item.timestamp - nowSec < 3600;

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isImminent
                      ? "border-coral/50 bg-coral/10"
                      : isPast
                      ? "border-line/40 bg-water/40 opacity-70"
                      : "border-line bg-deck/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            item.impact === "High"
                              ? "bg-coral/20 text-coral border border-coral/40"
                              : item.impact === "Medium"
                              ? "bg-gold/20 text-gold border border-gold/40"
                              : "bg-line/40 text-mute"
                          }`}
                        >
                          {item.country} • {item.impact}
                        </span>
                        <span className="text-[12px] text-mute tabular-nums">
                          {fmtTime(item.timestamp, s.localTime)}
                        </span>
                      </div>
                      <h4 className="mt-1 text-[14px] font-medium text-ink leading-snug">
                        {item.title}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
                          isImminent
                            ? "bg-coral text-water pulse-dot"
                            : isPast
                            ? "text-mute"
                            : "text-gold bg-gold/10 border border-gold/30"
                        }`}
                      >
                        {formatCountdown(item.timestamp)}
                      </span>
                    </div>
                  </div>

                  {(item.forecast || item.previous) && (
                    <div className="mt-2.5 flex items-center gap-4 border-t border-line/50 pt-2 text-[12px] tabular-nums">
                      {item.forecast && (
                        <div>
                          <span className="text-mute">{t("news.forecast")}: </span>
                          <span className="font-medium text-ink">{item.forecast}</span>
                        </div>
                      )}
                      {item.previous && (
                        <div>
                          <span className="text-mute">{t("news.previous")}: </span>
                          <span className="font-medium text-ink">{item.previous}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

