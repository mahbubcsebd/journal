"use client";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { hitTestDrawing, newDrawingId, type ChartDrawing, type DrawingAnchor, type DrawingTool } from "@/lib/desk/drawings";
import { COLORS, fmtClock, rgba } from "@/lib/desk/format";
import type { Layers } from "@/lib/desk/settings";
import type { Analysis, Candle, OpenPosition, PriceAlert, ReactionBrief } from "@/lib/desk/types";
import { buildChartMarkers, syncAlertLines, syncPositionLines, syncSetupLines } from "./chartLines";
import { DrawingOverlay } from "./DrawingOverlay";
import { SmcOverlay } from "./overlay";

export interface ChartHandle {
  /** `fit` moves the view to the latest candles; pass false to keep the current view. */
  setData(candles: Candle[], digits: number, fit?: boolean): void;
  update(candle: Candle): void;
  screenshot(): HTMLCanvasElement | null;
}

interface Props {
  ref: Ref<ChartHandle>;
  symbol: string;
  analysis: Analysis | null;
  reaction?: ReactionBrief | null;
  layers: Layers;
  minScore: number;
  selectedId: string | null;
  localTime: boolean;
  positions?: OpenPosition[];
  alerts?: PriceAlert[];
  drawings?: readonly ChartDrawing[];
  drawingTool?: DrawingTool;
  selectedDrawingId?: string | null;
  onSelect(id: string | null): void;
  onSelectDrawing?(id: string | null): void;
  onAddDrawing?(drawing: ChartDrawing): void;
  onDraftChange?(hasDraft: boolean): void;
}

const toBar = (c: Candle) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });

export default function Chart({
  ref,
  symbol,
  analysis,
  reaction,
  layers,
  minScore,
  selectedId,
  localTime,
  positions,
  alerts,
  drawings = [],
  drawingTool = "select",
  selectedDrawingId = null,
  onSelect,
  onSelectDrawing,
  onAddDrawing,
  onDraftChange,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlay = useRef<SmcOverlay | null>(null);
  const drawingOverlay = useRef<DrawingOverlay | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLines = useRef<IPriceLine[]>([]);
  const positionLines = useRef<IPriceLine[]>([]);
  const alertLines = useRef<IPriceLine[]>([]);
  const firstTime = useRef(0);
  const lastTime = useRef(0);
  const lastIndex = useRef(0);
  const barStep = useRef(60);
  const digitsRef = useRef(2);
  const draftStart = useRef<DrawingAnchor | null>(null);
  const draftEnd = useRef<DrawingAnchor | null>(null);
  // Latest props for chart callbacks that are registered once.
  const live = useRef({
    analysis,
    layers,
    minScore,
    selectedId,
    drawings,
    drawingTool,
    selectedDrawingId,
    onSelect,
    onSelectDrawing,
    onAddDrawing,
    onDraftChange,
  });
  useEffect(() => {
    live.current = {
      analysis,
      layers,
      minScore,
      selectedId,
      drawings,
      drawingTool,
      selectedDrawingId,
      onSelect,
      onSelectDrawing,
      onAddDrawing,
      onDraftChange,
    };
  }, [analysis, layers, minScore, selectedId, drawings, drawingTool, selectedDrawingId, onSelect, onSelectDrawing, onAddDrawing, onDraftChange]);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: COLORS.mute,
        fontFamily: '"Schibsted Grotesk Variable", system-ui, sans-serif',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: rgba(COLORS.line, 0.35) },
        horzLines: { color: rgba(COLORS.line, 0.35) },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: COLORS.mute, labelBackgroundColor: "#1b313b" },
        horzLine: { color: COLORS.mute, labelBackgroundColor: "#1b313b" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 14 },
    });
    const s = c.addSeries(CandlestickSeries, {
      upColor: COLORS.jade,
      downColor: COLORS.coral,
      wickUpColor: COLORS.jade,
      wickDownColor: COLORS.coral,
      borderVisible: false,
      priceLineColor: COLORS.mute,
      // Keep the selected zone on screen even when it is far from price.
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original();
        const { analysis: a, selectedId: id } = live.current;
        const zone = id ? a?.orderBlocks.find((o) => o.id === id) : null;
        if (!info?.priceRange || !zone) return info;
        return {
          ...info,
          priceRange: {
            minValue: Math.min(info.priceRange.minValue, zone.bottom),
            maxValue: Math.max(info.priceRange.maxValue, zone.top),
          },
        };
      },
    });
    const o = new SmcOverlay();
    s.attachPrimitive(o);
    const d = new DrawingOverlay();
    s.attachPrimitive(d);

    const pushDrawings = () => {
      const { drawings: ds, drawingTool: tool, selectedDrawingId: sel } = live.current;
      d.set({
        drawings: ds,
        selectedId: sel,
        draft: draftStart.current && draftEnd.current && (tool === "rect" || tool === "fib") ? { kind: tool, a: draftStart.current, b: draftEnd.current } : null,
        digits: digitsRef.current,
        firstTime: firstTime.current,
        lastTime: lastTime.current,
        lastIndex: lastIndex.current,
        barStep: barStep.current,
      });
    };

    const pointToAnchor = (point: { x: number; y: number }, paramTime?: Time): DrawingAnchor | null => {
      const price = s.coordinateToPrice(point.y);
      if (price === null || !Number.isFinite(price)) return null;
      if (typeof paramTime === "number") return { time: paramTime, price };
      const mapped = c.timeScale().coordinateToTime(point.x);
      if (typeof mapped === "number") return { time: mapped, price };
      const logical = c.timeScale().coordinateToLogical(point.x);
      if (logical === null) return null;
      return { time: Math.round(lastTime.current + (logical - lastIndex.current) * barStep.current), price };
    };

    c.subscribeCrosshairMove((param) => {
      const { drawingTool: tool } = live.current;
      if (!draftStart.current || !param.point || (tool !== "rect" && tool !== "fib")) return;
      const anchor = pointToAnchor(param.point, param.time);
      if (!anchor) return;
      draftEnd.current = anchor;
      pushDrawings();
    });

    // Click to place/select drawings or inspect an SMC order block.
    c.subscribeClick((param) => {
      if (!param.point) return;
      const curLive = live.current;
      const tool = curLive.drawingTool;

      if (tool === "hline") {
        const price = s.coordinateToPrice(param.point.y);
        if (price !== null && Number.isFinite(price)) {
          curLive.onAddDrawing?.({ id: newDrawingId(), kind: "hline", price });
        }
        return;
      }

      if (tool === "rect" || tool === "fib") {
        const anchor = pointToAnchor(param.point, param.time);
        if (!anchor) return;
        if (!draftStart.current) {
          draftStart.current = anchor;
          draftEnd.current = anchor;
          curLive.onDraftChange?.(true);
          pushDrawings();
        } else {
          const next: ChartDrawing = { id: newDrawingId(), kind: tool, a: draftStart.current, b: anchor };
          draftStart.current = null;
          draftEnd.current = null;
          curLive.onDraftChange?.(false);
          curLive.onAddDrawing?.(next);
        }
        return;
      }

      const price = s.coordinateToPrice(param.point.y);
      if (price === null) return;
      const pTop = s.coordinateToPrice(Math.max(0, param.point.y - 7));
      const pBot = s.coordinateToPrice(param.point.y + 7);
      const tol = pTop !== null && pBot !== null ? Math.abs(pTop - pBot) / 2 : 0;
      const anchorTime = pointToAnchor(param.point, param.time)?.time ?? null;
      const hitDrawing = hitTestDrawing(curLive.drawings, anchorTime, price, tol);
      if (hitDrawing) {
        curLive.onSelectDrawing?.(hitDrawing.id);
        curLive.onSelect(null);
        return;
      }
      curLive.onSelectDrawing?.(null);

      const { analysis: a, layers: l, minScore: min, selectedId: cur, onSelect: select } = curLive;
      if (!a || !l.blocks) return;
      const time = typeof param.time === "number" ? param.time : Infinity;
      const hit = a.orderBlocks.find(
        (ob) =>
          (ob.score >= min || ob.id === cur) &&
          price <= ob.top &&
          price >= ob.bottom &&
          time >= ob.time &&
          (!ob.mitigated || time <= (ob.mitigatedTime ?? Infinity)),
      );
      select(hit ? hit.id : null);
    });

    chart.current = c;
    series.current = s;
    overlay.current = o;
    drawingOverlay.current = d;
    markers.current = createSeriesMarkers(s, []);
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      overlay.current = null;
      drawingOverlay.current = null;
      markers.current = null;
      priceLines.current = [];
    };
  }, []);

  // Axis and crosshair times in the viewer's zone or in server (UTC) time.
  useEffect(() => {
    chart.current?.applyOptions({
      localization: {
        timeFormatter: (t: Time) => fmtClock(t as number, localTime, { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }),
      },
      timeScale: {
        tickMarkFormatter: (t: Time, type: number) => {
          const n = t as number;
          if (type === 0) return fmtClock(n, localTime, { year: "numeric" });
          if (type === 1) return fmtClock(n, localTime, { month: "short" });
          if (type === 2) return fmtClock(n, localTime, { day: "numeric", month: "short" });
          return fmtClock(n, localTime, { hour: "numeric", minute: "2-digit" });
        },
      },
    });
  }, [localTime]);

  useImperativeHandle(ref, () => ({
    setData(candles, digits, fit = true) {
      const s = series.current;
      const c = chart.current;
      if (!s || !c || !candles.length) return;
      s.applyOptions({ priceFormat: { type: "price", precision: digits, minMove: 1 / 10 ** digits } });
      s.setData(candles.map(toBar));
      digitsRef.current = digits;
      firstTime.current = candles[0].time;
      lastTime.current = candles[candles.length - 1].time;
      lastIndex.current = candles.length - 1;
      barStep.current = candles.length >= 2 ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time) : 60;
      drawingOverlay.current?.set({
        drawings: live.current.drawings,
        selectedId: live.current.selectedDrawingId,
        draft: null,
        digits,
        firstTime: firstTime.current,
        lastTime: lastTime.current,
        lastIndex: lastIndex.current,
        barStep: barStep.current,
      });
      if (fit) {
        const bars = Math.max(40, Math.round((box.current?.clientWidth ?? 800) / 8));
        c.timeScale().setVisibleLogicalRange({ from: candles.length - bars, to: candles.length + 14 });
      }
    },
    update(candle) {
      if (!series.current || candle.time < lastTime.current) return;
      lastTime.current = candle.time;
      series.current.update(toBar(candle));
    },
    screenshot() {
      return chart.current?.takeScreenshot() ?? null;
    },
  }));

  useEffect(() => {
    const s = series.current;
    if (!s || !overlay.current || !markers.current) return;
    overlay.current.set({ analysis, reaction: reaction ?? null, layers, minScore, firstTime: firstTime.current, selectedId });
    chart.current?.priceScale("right").applyOptions({ autoScale: true });
    markers.current.setMarkers(buildChartMarkers(analysis, layers, firstTime.current, lastTime.current));
    priceLines.current = syncSetupLines(s, priceLines.current, analysis);
  }, [analysis, reaction, layers, minScore, selectedId]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    positionLines.current = syncPositionLines(s, positionLines.current, positions ?? [], symbol);
  }, [positions, symbol]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    alertLines.current = syncAlertLines(s, alertLines.current, alerts ?? [], symbol);
  }, [alerts, symbol]);

  useEffect(() => {
    const d = drawingOverlay.current;
    if (!d) return;
    if (drawingTool === "select" || drawingTool === "hline") {
      draftStart.current = null;
      draftEnd.current = null;
    }
    d.set({
      drawings,
      selectedId: selectedDrawingId,
      draft:
        draftStart.current && draftEnd.current && (drawingTool === "rect" || drawingTool === "fib")
          ? { kind: drawingTool, a: draftStart.current, b: draftEnd.current }
          : null,
      digits: digitsRef.current,
      firstTime: firstTime.current,
      lastTime: lastTime.current,
      lastIndex: lastIndex.current,
      barStep: barStep.current,
    });
  }, [drawings, selectedDrawingId, drawingTool]);

  return <div ref={box} className={`absolute inset-0 ${drawingTool === "select" ? "" : "cursor-crosshair"}`} />;
}
