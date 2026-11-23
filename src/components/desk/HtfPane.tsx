"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings, useT } from "@/lib/desk/settings";
import { TF_SECONDS, TIMEFRAMES, type OpenPosition, type TF } from "@/lib/desk/types";
import { useFeed, type FeedHandlers } from "@/lib/desk/useFeed";
import { TREND_COLOR } from "./Brief";
import Chart, { type ChartHandle } from "./Chart";

const DEFAULT_HTF: Record<TF, TF> = { M1: "M15", M5: "H1", M15: "H1", H1: "H4", H4: "D1", D1: "D1" };

/** Timeframes that can sit next to `tf` as the bigger picture. */
export const higherTimeframes = (tf: TF) => TIMEFRAMES.filter((x) => TF_SECONDS[x] > TF_SECONDS[tf]);

/** The saved choice when it is still above the main timeframe, otherwise the default. */
export function htfFor(tf: TF, saved: TF | null): TF {
  return saved && TF_SECONDS[saved] > TF_SECONDS[tf] ? saved : DEFAULT_HTF[tf];
}

/** Higher-timeframe chart for split view. It has its own live feed and follows the main chart's layers. */
export default function HtfPane({ tf, mainTf, positions }: { tf: TF; mainTf: TF; positions?: OpenPosition[] }) {
  const { s, set } = useSettings();
  const t = useT();
  const chart = useRef<ChartHandle>(null);
  const handlers = useRef<FeedHandlers | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    handlers.current = {
      onSnapshot(list, digits) {
        setSelectedId(null);
        chart.current?.setData(list, digits);
      },
      onTick(k) {
        chart.current?.update(k);
      },
    };
  }, []);

  const feed = useFeed(s.symbol, tf, handlers);
  const trend = feed.analysis?.trend ?? "neutral";

  return (
    <div className="relative min-h-0 border-b border-line lg:border-b-0 lg:border-r">
      <Chart
        ref={chart}
        symbol={s.symbol}
        analysis={feed.analysis}
        layers={s.layers}
        minScore={s.minScore}
        selectedId={selectedId}
        localTime={s.localTime}
        positions={positions}
        onSelect={setSelectedId}
      />
      <div className="absolute left-3 top-2 z-10 flex items-center gap-2 rounded-md border border-line bg-hull/90 py-0.5 pl-1 pr-2.5 text-[13px] shadow-md shadow-black/30">
        <label>
          <span className="sr-only">{t("split.htf")}</span>
          <select
            value={tf}
            onChange={(e) => set({ splitTf: e.target.value as TF })}
            className="rounded bg-transparent px-1 py-0.5 font-semibold hover:bg-deck"
          >
            {higherTimeframes(mainTf).map((x) => (
              <option key={x} value={x} className="bg-hull">
                {x}
              </option>
            ))}
          </select>
        </label>
        <span className={`font-semibold ${TREND_COLOR[trend]}`}>{t(`trend.${trend}`)}</span>
      </div>
      {feed.status !== "live" && (
        <div className="absolute inset-0 grid place-items-center bg-water/80 p-6 text-center">
          <p className="max-w-[40ch] text-[13px] text-mute">
            {feed.status === "error" ? feed.error : t(feed.status === "offline" ? "state.offline" : feed.status === "stale" ? "state.stale" : "state.loading")}
          </p>
        </div>
      )}
    </div>
  );
}
