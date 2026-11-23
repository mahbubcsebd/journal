"use client";

import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/desk/format";
import { useSettings, useT } from "@/lib/desk/settings";
import { TIMEFRAMES, type OpenPosition, type TF } from "@/lib/desk/types";
import { useSymbolDrawings } from "@/lib/desk/useDrawings";
import { useFeed, type FeedHandlers } from "@/lib/desk/useFeed";
import { buildWatchlistPanes, GRID_TFS, type GridPaneSpec } from "@/lib/desk/watchlistGrid";
import { TREND_COLOR } from "./Brief";
import Chart, { type ChartHandle } from "./Chart";
import { buttonClass, Segmented } from "./ui";

/** Reuses the HtfPane pattern: each watchlist tile owns a lightweight live WS chart. */
function WatchlistPane({
  spec,
  paneTf,
  positions,
  onTfChange,
  onOpen,
}: {
  spec: GridPaneSpec;
  paneTf: TF;
  positions: readonly OpenPosition[];
  onTfChange(tf: TF): void;
  onOpen(symbol: string, tf: TF): void;
}) {
  const { s } = useSettings();
  const t = useT();
  const chart = useRef<ChartHandle>(null);
  const handlers = useRef<FeedHandlers | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { drawings } = useSymbolDrawings(spec.symbol);

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

  const feed = useFeed(spec.symbol, paneTf, handlers);
  const trend = feed.analysis?.trend ?? "neutral";
  const setup = feed.analysis?.setup;

  return (
    <article className="relative h-[340px] overflow-hidden rounded-lg border border-line bg-water">
      <Chart
        ref={chart}
        symbol={spec.symbol}
        analysis={feed.analysis}
        reaction={feed.reaction}
        layers={s.layers}
        minScore={s.minScore}
        selectedId={selectedId}
        localTime={s.localTime}
        positions={positions as OpenPosition[]}
        drawings={drawings}
        onSelect={setSelectedId}
      />

      <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1.5 rounded-md border border-line bg-hull/90 px-2 py-1 text-[12px] shadow-md shadow-black/30">
          <span className="font-semibold text-ink">{spec.symbol}</span>
          <label>
            <span className="sr-only">{t("grid.paneTf")}</span>
            <select
              value={paneTf}
              onChange={(e) => onTfChange(e.target.value as TF)}
              className="rounded bg-transparent px-1 py-0.5 font-semibold text-ink hover:bg-deck"
            >
              {TIMEFRAMES.map((x) => (
                <option key={x} value={x} className="bg-hull">
                  {x}
                </option>
              ))}
            </select>
          </label>
          <span className={`font-semibold ${TREND_COLOR[trend]}`}>{t(`trend.${trend}`)}</span>
          {feed.price !== null && <span className="tabular-nums text-mute">{fmt(feed.price, feed.digits)}</span>}
          {setup && (
            <span className={`font-semibold ${setup.dir === "bull" ? "text-jade" : "text-coral"}`}>
              {t(setup.dir === "bull" ? "scan.buy" : "scan.sell")} {setup.grade}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpen(spec.symbol, paneTf)}
          className={`${buttonClass} ml-auto bg-hull/90 py-1 text-[12px] shadow-md shadow-black/30`}
        >
          {t("grid.open")}
        </button>
      </div>

      {feed.status !== "live" && (
        <div className="absolute inset-0 grid place-items-center bg-water/80 p-6 text-center">
          <p className="max-w-[34ch] text-[13px] text-mute">
            {feed.status === "error" ? feed.error : t(feed.status === "offline" ? "state.offline" : feed.status === "stale" ? "state.stale" : "state.loading")}
          </p>
        </div>
      )}
    </article>
  );
}

export default function WatchlistGrid({
  symbols,
  positions,
  onOpen,
}: {
  symbols: readonly string[];
  positions: readonly OpenPosition[];
  onOpen(symbol: string, tf: TF): void;
}) {
  const t = useT();
  const [baseTf, setBaseTf] = useState<TF>("H1");
  const [overrides, setOverrides] = useState<Record<string, TF>>({});
  const panes = buildWatchlistPanes(symbols, baseTf);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-mute">{t("grid.hint")}</p>
        <Segmented
          label={t("grid.tf")}
          value={baseTf}
          onChange={(next) => {
            setBaseTf(next);
            setOverrides({});
          }}
          options={GRID_TFS.map((tf) => ({ value: tf, label: tf }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {panes.map((pane) => {
          const activeTf = overrides[pane.id] ?? pane.defaultTf;
          return (
            <WatchlistPane
              key={pane.id}
              spec={pane}
              paneTf={activeTf}
              positions={positions}
              onTfChange={(tf) => setOverrides((cur) => ({ ...cur, [pane.id]: tf }))}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}

