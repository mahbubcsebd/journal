"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { captureChartBlob, captureChartDataUrl } from "@/lib/desk/chartImage";
import type { DrawingTool } from "@/lib/desk/drawings";
import { api, downloadFile, fmtTime } from "@/lib/desk/format";
import { PRO_LAYERS, SIMPLE_LAYERS, useSettings, useT, type Layers } from "@/lib/desk/settings";
import { TIMEFRAMES, type Analysis, type Candle, type OpenPosition, type PriceAlert, type RiskGuardStatus, type TF } from "@/lib/desk/types";
import { useSymbolDrawings } from "@/lib/desk/useDrawings";
import type { FeedHandlers, FeedState } from "@/lib/desk/useFeed";
import Brief from "./Brief";
import Chart, { type ChartHandle } from "./Chart";
import DrawingToolbar from "./DrawingToolbar";
import HtfPane, { higherTimeframes, htfFor } from "./HtfPane";
import SaveTradeDialog from "./SaveTradeDialog";
import { buttonClass, Segmented } from "./ui";

const SIMPLE_KEYS: (keyof Layers)[] = ["blocks", "structure", "liquidity"];
const PRO_KEYS: (keyof Layers)[] = ["blocks", "structure", "liquidity", "fvg", "range", "sessions", "levels", "ote", "breakers", "swings"];
const REPLAY_MIN = 120;

interface Props {
  active: boolean;
  feed: FeedState;
  positions: OpenPosition[];
  alerts?: PriceAlert[];
  riskGuard?: RiskGuardStatus | null;
  onHandlers(h: FeedHandlers | null): void;
  toast(text: string): void;
}

interface Replay {
  candles: Candle[];
  index: number;
  analysis: Analysis | null;
  playing: boolean;
}

export default function ChartScreen({ active, feed, positions, alerts, riskGuard, onHandlers, toast }: Props) {
  const { s, set } = useSettings();
  const t = useT();
  const chart = useRef<ChartHandle>(null);
  const candles = useRef<Candle[]>([]);
  const replayOn = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("select");
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [full, setFull] = useState(false);
  const [savingShot, setSavingShot] = useState<{ open: boolean; chartImage: string | null }>({ open: false, chartImage: null });
  const [replay, setReplay] = useState<Replay | null>(null);
  const { drawings, addDrawing, deleteDrawing, clearDrawings } = useSymbolDrawings(s.symbol);

  // Live candles go straight into the chart; replay freezes the chart but keeps collecting them.
  useEffect(() => {
    onHandlers({
      onSnapshot(list, digits) {
        candles.current = list.slice();
        replayOn.current = false;
        setReplay(null);
        setSelectedId(null);
        chart.current?.setData(list, digits);
      },
      onTick(k) {
        const a = candles.current;
        const last = a[a.length - 1];
        if (last && k.time === last.time) a[a.length - 1] = k;
        else if (!last || k.time > last.time) a.push(k);
        if (!replayOn.current) chart.current?.update(k);
      },
    });
    return () => onHandlers(null);
  }, [onHandlers]);

  // ---- Replay ----------------------------------------------------------------
  const replayIndex = replay?.index;
  const replayCandles = replay?.candles;
  useEffect(() => {
    if (replayIndex === undefined || !replayCandles) return;
    const list = replayCandles.slice(0, replayIndex + 1);
    const until = list[list.length - 1]?.time;
    if (!until) return;
    chart.current?.setData(list, feed.digits);
    let stale = false;
    api<{ analysis: Analysis }>(`/api/analysis?symbol=${s.symbol}&tf=${s.tf}&until=${until}`)
      .then((r) => {
        if (!stale) setReplay((cur) => (cur && cur.index === replayIndex ? { ...cur, analysis: r.analysis } : cur));
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [replayIndex, replayCandles, feed.digits, s.symbol, s.tf]);

  const playing = replay?.playing ?? false;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setReplay((cur) => {
        if (!cur) return cur;
        const end = cur.candles.length - 2;
        return cur.index >= end ? { ...cur, playing: false } : { ...cur, index: cur.index + 1 };
      });
    }, 700);
    return () => clearInterval(timer);
  }, [playing]);

  const startReplay = () => {
    const snap = candles.current.slice();
    if (snap.length < REPLAY_MIN + 20) return;
    replayOn.current = true;
    setSelectedId(null);
    setReplay({ candles: snap, index: Math.max(REPLAY_MIN, snap.length - 150), analysis: null, playing: false });
  };
  const exitReplay = useCallback(() => {
    replayOn.current = false;
    setReplay(null);
    setSelectedId(null);
    chart.current?.setData(candles.current, feed.digits);
  }, [feed.digits]);
  const step = (d: number) =>
    setReplay((cur) => cur && { ...cur, playing: false, index: Math.min(cur.candles.length - 2, Math.max(REPLAY_MIN, cur.index + d)) });

  // ---- Toolbar actions ---------------------------------------------------------
  const screenshot = () => {
    const shot = chart.current?.screenshot();
    if (!shot) return;
    void captureChartBlob(shot).then((blob) => blob && downloadFile(`${s.symbol}-${s.tf}.png`, blob));
  };

  const setTf = useCallback((tf: TF) => set({ tf }), [set]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= TIMEFRAMES.length) setTf(TIMEFRAMES[n - 1]);
      else if (e.key === "f") setFull((v) => !v);
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedDrawingId) {
        deleteDrawing(selectedDrawingId);
        setSelectedDrawingId(null);
      } else if (e.key === "Escape") {
        setFull(false);
        setDrawingTool("select");
        setHasDraft(false);
        setSelectedDrawingId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, setTf, selectedDrawingId, deleteDrawing]);

  const analysis = replay ? replay.analysis : feed.analysis;
  const price = replay ? (replay.candles[replay.index]?.close ?? null) : feed.price;
  const keys = s.mode === "simple" ? SIMPLE_KEYS : PRO_KEYS;
  // The higher timeframe is live, so it is hidden in replay where it would show the future.
  const canSplit = higherTimeframes(s.tf).length > 0;
  const showSplit = s.split && canSplit && !replay;

  return (
    <div className={active ? "grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden" : "hidden"}>
      <main className={full ? "fixed inset-0 z-40 flex flex-col bg-water" : "flex min-h-0 flex-col lg:overflow-hidden"}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-2.5 lg:px-5">
          <Segmented solid label={t("label.timeframe")} value={s.tf} onChange={setTf} options={TIMEFRAMES.map((x) => ({ value: x, label: x }))} />
          <Segmented
            label={t("label.mode")}
            value={s.mode}
            onChange={(mode) => set({ mode, layers: mode === "simple" ? SIMPLE_LAYERS : PRO_LAYERS })}
            options={[
              { value: "simple", label: t("mode.simple") },
              { value: "pro", label: t("mode.pro") },
            ]}
          />
          <div className="ml-auto flex gap-1.5">
            {!replay && (
              <button type="button" className={buttonClass} onClick={startReplay}>
                {t("action.replay")}
              </button>
            )}
            {canSplit && !replay && (
              <button
                type="button"
                className={`${buttonClass} aria-pressed:border-gold aria-pressed:text-gold`}
                onClick={() => set({ split: !s.split })}
                aria-pressed={s.split}
              >
                {t("action.split")}
              </button>
            )}
            <button type="button" className={buttonClass} onClick={screenshot}>
              {t("action.screenshot")}
            </button>
            <button type="button" className={buttonClass} onClick={() => setFull((v) => !v)} aria-pressed={full}>
              {t(full ? "action.exitFull" : "action.full")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-5">
          <div className="flex flex-wrap gap-1.5">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={s.layers[key]}
                onClick={() => set({ layers: { ...s.layers, [key]: !s.layers[key] } })}
                className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                  s.layers[key] ? "border-mute bg-deck text-ink" : "border-line text-mute hover:text-ink"
                }`}
              >
                {t(`layer.${key}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[13px] text-mute lg:ml-auto">
            {t("label.quality")}
            <Segmented
              label={t("label.quality")}
              value={s.minScore}
              onChange={(minScore) => set({ minScore })}
              options={[
                { value: 0, label: t("quality.all") },
                { value: 3, label: "3+" },
                { value: 4, label: "4+" },
              ]}
            />
          </div>
        </div>

        <DrawingToolbar
          tool={drawingTool}
          hasDraft={hasDraft}
          selectedId={selectedDrawingId}
          count={drawings.length}
          onTool={(next) => {
            setDrawingTool(next);
            setHasDraft(false);
            if (next !== "select") setSelectedDrawingId(null);
          }}
          onDelete={() => {
            if (!selectedDrawingId) return;
            deleteDrawing(selectedDrawingId);
            setSelectedDrawingId(null);
          }}
          onClear={() => {
            clearDrawings();
            setSelectedDrawingId(null);
            setHasDraft(false);
          }}
        />

        {replay && (
          <div className="flex flex-wrap items-center gap-2 border-y border-line bg-hull px-4 py-2 lg:px-5">
            <span className="text-[13px] font-semibold text-gold">{t("replay.on")}</span>
            <button type="button" className={buttonClass} onClick={() => step(-1)} aria-label={t("replay.back")}>
              ◀
            </button>
            <button type="button" className={buttonClass} onClick={() => setReplay((cur) => cur && { ...cur, playing: !cur.playing })}>
              {t(replay.playing ? "replay.pause" : "replay.play")}
            </button>
            <button type="button" className={buttonClass} onClick={() => step(1)} aria-label={t("replay.forward")}>
              ▶
            </button>
            <input
              type="range"
              aria-label={t("replay.position")}
              className="min-w-[120px] flex-1 accent-[#e5b84b]"
              min={REPLAY_MIN}
              max={Math.max(REPLAY_MIN, replay.candles.length - 2)}
              value={replay.index}
              onChange={(e) => setReplay((cur) => cur && { ...cur, playing: false, index: Number(e.target.value) })}
            />
            <span className="text-[13px] tabular-nums text-mute">{fmtTime(replay.candles[replay.index]?.time ?? 0, s.localTime)}</span>
            <button type="button" className={buttonClass} onClick={exitReplay}>
              {t("replay.exit")}
            </button>
          </div>
        )}

        <div
          className={`grid ${
            showSplit ? "grid-rows-2 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)]"
          } ${full ? "min-h-0 flex-1" : showSplit ? "h-[96svh] min-h-[600px] lg:h-auto lg:min-h-0 lg:flex-1" : "h-[58svh] min-h-[340px] lg:h-auto lg:min-h-0 lg:flex-1"}`}
        >
          {showSplit && <HtfPane tf={htfFor(s.tf, s.splitTf)} mainTf={s.tf} positions={replay ? [] : positions} />}
          <div className="relative min-h-0">
            <Chart
              ref={chart}
              symbol={s.symbol}
              analysis={analysis}
              reaction={replay ? null : feed.reaction}
              layers={s.layers}
              minScore={s.minScore}
              selectedId={selectedId}
              localTime={s.localTime}
              positions={replay ? [] : positions}
              alerts={replay ? [] : alerts}
              drawings={drawings}
              drawingTool={drawingTool}
              selectedDrawingId={selectedDrawingId}
              onSelect={setSelectedId}
              onSelectDrawing={setSelectedDrawingId}
              onAddDrawing={(d) => {
                addDrawing(d);
                setDrawingTool("select");
                setSelectedDrawingId(d.id);
              }}
              onDraftChange={setHasDraft}
            />
            {showSplit && (
              <span className="absolute left-3 top-2 z-10 rounded-md border border-line bg-hull/90 px-2.5 py-1 text-[13px] font-semibold shadow-md shadow-black/30">
                {s.tf}
              </span>
            )}
            {feed.status !== "live" && (
              <div className="absolute inset-0 grid place-items-center bg-water/80 p-6 text-center">
                <p className="max-w-[46ch] text-mute">
                  {feed.status === "error" ? feed.error : t(feed.status === "offline" ? "state.offline" : feed.status === "stale" ? "state.stale" : "state.loading")}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <aside className="brief-scroll relative min-h-0 border-t border-line bg-hull lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Brief
          analysis={analysis}
          bias={feed.bias}
          price={price}
          digits={feed.digits}
          tf={s.tf}
          minScore={s.minScore}
          selectedId={selectedId}
          replay={Boolean(replay)}
          positions={positions}
          riskGuard={riskGuard}
          reaction={replay ? null : feed.reaction}
          onSelect={setSelectedId}
          onTimeframe={setTf}
          onSave={() => {
            const shot = chart.current?.screenshot();
            setSavingShot({ open: true, chartImage: shot ? captureChartDataUrl(shot) : null });
          }}
        />
      </aside>

      {savingShot.open && feed.analysis?.setup && (
        <SaveTradeDialog
          symbol={s.symbol}
          tf={s.tf}
          setup={feed.analysis.setup}
          chartImage={savingShot.chartImage}
          onClose={() => setSavingShot({ open: false, chartImage: null })}
          onSaved={() => {
            setSavingShot({ open: false, chartImage: null });
            toast(t("save.done"));
          }}
        />
      )}
    </div>
  );
}
