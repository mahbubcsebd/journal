import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  SeriesType,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { fibLevels, type ChartDrawing, type DrawingAnchor, type DrawingTool } from "@/lib/desk/drawings";
import { COLORS, fmt, rgba } from "@/lib/desk/format";

export interface DrawingOverlayData {
  drawings: readonly ChartDrawing[];
  selectedId: string | null;
  draft: { kind: Extract<DrawingTool, "rect" | "fib">; a: DrawingAnchor; b: DrawingAnchor } | null;
  digits: number;
  firstTime: number;
  lastTime: number;
  lastIndex: number;
  barStep: number;
}

const FONT = '500 11px "Schibsted Grotesk Variable", system-ui, sans-serif';
const DEFAULT_DATA: DrawingOverlayData = {
  drawings: [],
  selectedId: null,
  draft: null,
  digits: 2,
  firstTime: 0,
  lastTime: 0,
  lastIndex: 0,
  barStep: 60,
};

type Ctx = CanvasRenderingContext2D;

/** Series primitive that draws user hlines, rectangles, and Fib/OTE tools. */
export class DrawingOverlay implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private data: DrawingOverlayData = DEFAULT_DATA;
  private views: IPrimitivePaneView[] = [this.createView()];

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart;
    this.series = p.series;
    this.requestUpdate = p.requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  set(data: DrawingOverlayData) {
    this.data = data;
    this.requestUpdate?.();
  }

  paneViews() {
    return this.views;
  }

  private createView(): IPrimitivePaneView {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) =>
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          this.drawAll(context, mediaSize.width);
        }),
    };
    const z: PrimitivePaneViewZOrder = "top";
    return { zOrder: () => z, renderer: () => renderer };
  }

  private x(time: number): number | null {
    if (!this.chart) return null;
    const direct = this.chart.timeScale().timeToCoordinate(time as UTCTimestamp);
    if (direct !== null) return direct;
    const { firstTime, lastTime, lastIndex, barStep } = this.data;
    if (barStep <= 0) return null;
    if (time < firstTime) {
      const logical = (time - firstTime) / barStep;
      return this.chart.timeScale().logicalToCoordinate(logical as Logical);
    }
    if (time > lastTime) {
      const logical = lastIndex + (time - lastTime) / barStep;
      return this.chart.timeScale().logicalToCoordinate(logical as Logical);
    }
    return null;
  }

  private y(price: number): number | null {
    return this.series?.priceToCoordinate(price) ?? null;
  }

  private drawAll(ctx: Ctx, width: number) {
    const { drawings, draft, selectedId, digits } = this.data;
    if (drawings.length === 0 && !draft) return;

    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = "middle";

    for (const d of drawings) {
      this.drawItem(ctx, width, d, d.id === selectedId, false, digits);
    }
    if (draft) {
      this.drawItem(ctx, width, { id: "__draft__", ...draft }, false, true, digits);
    }

    ctx.restore();
  }

  private drawItem(ctx: Ctx, width: number, d: ChartDrawing, selected: boolean, isDraft: boolean, digits: number) {
    if (d.kind === "hline") {
      const py = this.y(d.price);
      if (py === null) return;
      ctx.save();
      ctx.strokeStyle = selected ? COLORS.ink : COLORS.gold;
      ctx.lineWidth = selected ? 2 : 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
      ctx.fillStyle = rgba("#15262f", 0.85);
      const text = fmt(d.price, digits);
      const w = ctx.measureText(text).width + 10;
      ctx.fillRect(10, py - 9, w, 18);
      ctx.fillStyle = selected ? COLORS.ink : COLORS.gold;
      ctx.fillText(text, 15, py);
      ctx.restore();
      return;
    }

    const x1 = this.x(d.a.time);
    const x2 = this.x(d.b.time);
    const y1 = this.y(d.a.price);
    const y2 = this.y(d.b.price);
    if (x1 === null || x2 === null || y1 === null || y2 === null) return;
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const spanX = Math.max(2, right - left);

    if (d.kind === "rect") {
      const top = Math.min(y1, y2);
      const height = Math.max(2, Math.abs(y2 - y1));
      ctx.save();
      ctx.fillStyle = rgba(COLORS.jade, isDraft ? 0.08 : 0.12);
      ctx.fillRect(left, top, spanX, height);
      ctx.strokeStyle = selected ? COLORS.ink : COLORS.jade;
      ctx.lineWidth = selected ? 2 : 1.25;
      if (isDraft) ctx.setLineDash([4, 4]);
      ctx.strokeRect(left, top, spanX, height);
      if (selected) this.drawHandles(ctx, [x1, x2], [y1, y2]);
      ctx.restore();
      return;
    }

    // Fibonacci retracement with shaded ICT OTE zone (0.618 - 0.79)
    const levels = fibLevels(d.a.price, d.b.price);
    const y618 = this.y(levels[2].price);
    const y79 = this.y(levels[4].price);
    ctx.save();
    if (y618 !== null && y79 !== null) {
      const oteTop = Math.min(y618, y79);
      ctx.fillStyle = rgba(COLORS.gold, isDraft ? 0.07 : 0.11);
      ctx.fillRect(left, oteTop, spanX, Math.abs(y79 - y618));
    }
    for (const lvl of levels) {
      const ly = this.y(lvl.price);
      if (ly === null) continue;
      ctx.strokeStyle = lvl.isOte ? COLORS.gold : selected ? COLORS.ink : rgba(COLORS.mute, 0.85);
      ctx.lineWidth = lvl.isOte ? 1.5 : 1;
      ctx.setLineDash(lvl.ratio === 0 || lvl.ratio === 1 ? [] : [4, 3]);
      ctx.beginPath();
      ctx.moveTo(left, ly);
      ctx.lineTo(right, ly);
      ctx.stroke();

      const label = `${lvl.ratio} (${fmt(lvl.price, digits)})`;
      ctx.fillStyle = lvl.isOte ? COLORS.gold : COLORS.mute;
      ctx.fillText(label, left + 6, ly - 7);
    }
    if (selected) this.drawHandles(ctx, [x1, x2], [y1, y2]);
    ctx.restore();
  }

  private drawHandles(ctx: Ctx, xs: [number, number], ys: [number, number]) {
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.ink;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(xs[i], ys[i], 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

