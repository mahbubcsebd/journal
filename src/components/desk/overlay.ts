import { COLORS, rgba } from "@/lib/desk/format";
import { SIMPLE_LAYERS, type Layers } from "@/lib/desk/settings";
import type { Analysis, ReactionBrief } from "@/lib/desk/types";
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  SeriesType,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { drawReactionChips } from "./overlayReaction";

export interface OverlayData {
  analysis: Analysis | null;
  reaction?: ReactionBrief | null;
  layers: Layers;
  minScore: number;
  firstTime: number;
  selectedId: string | null;
}

const FONT = '500 11px "Schibsted Grotesk Variable", system-ui, sans-serif';
/** Right-aligned labels stop here so they clear the Entry / Stop / Target tags. */
const LABEL_INSET = 64;
const LIQUIDITY_LABEL = { EQH: "EQH", EQL: "EQL", PDH: "PDH", PDL: "PDL", PWH: "PWH", PWL: "PWL" } as const;
const SESSION_LABEL = { asia: "Asia", london: "London KZ", newyork: "New York KZ" } as const;
const LEVEL_LABEL = { DO: "Day open", NYO: "NY open", WO: "Week open", ROUND: "" } as const;

type Ctx = CanvasRenderingContext2D;

/** Draws zones, structure lines and liquidity levels on top of the candle series. */
export class SmcOverlay implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private data: OverlayData = {
    analysis: null,
    layers: SIMPLE_LAYERS,
    minScore: 0,
    firstTime: 0,
    selectedId: null,
  };
  private views: IPrimitivePaneView[] = [this.view('bottom'), this.view('top')];

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

  set(data: OverlayData) {
    this.data = data;
    this.requestUpdate?.();
  }

  paneViews() {
    return this.views;
  }

  private view(z: PrimitivePaneViewZOrder): IPrimitivePaneView {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) =>
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          if (z === 'bottom') this.drawZones(context, mediaSize.width);
          else this.drawLines(context, mediaSize.width);
        }),
    };
    return { zOrder: () => z, renderer: () => renderer };
  }

  /** x for a candle time; times older than the loaded history clamp to the left edge. */
  private x(time: number): number | null {
    if (!this.chart) return null;
    if (time < this.data.firstTime) return -1;
    return this.chart.timeScale().timeToCoordinate(time as UTCTimestamp);
  }

  private y(price: number): number | null {
    return this.series?.priceToCoordinate(price) ?? null;
  }

  private drawZones(ctx: Ctx, width: number) {
    const { analysis: a, layers, minScore, selectedId } = this.data;
    if (!a) return;
    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = 'middle';

    if (layers.sessions) {
      for (const s of a.sessions) {
        const x1 = this.x(s.start);
        const x2 = this.x(s.end);
        const y1 = this.y(s.high);
        const y2 = this.y(s.low);
        if (x1 === null || x2 === null || y1 === null || y2 === null || x2 < 0)
          continue;
        ctx.fillStyle = rgba(COLORS.ink, 0.035);
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeStyle = rgba(COLORS.mute, 0.5);
        ctx.setLineDash([1, 3]);
        ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1, y2 - y1);
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.mute;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(SESSION_LABEL[s.name], Math.max(4, x1 + 2), y1 - 2);
        ctx.textBaseline = 'middle';
      }
    }

    if (layers.range && a.range) {
      const x1 = this.x(a.range.fromTime);
      const yh = this.y(a.range.high);
      const ye = this.y(a.range.eq);
      const yl = this.y(a.range.low);
      if (x1 !== null && yh !== null && ye !== null && yl !== null) {
        ctx.fillStyle = rgba(COLORS.coral, 0.045);
        ctx.fillRect(x1, yh, width - x1, ye - yh);
        ctx.fillStyle = rgba(COLORS.jade, 0.045);
        ctx.fillRect(x1, ye, width - x1, yl - ye);
      }
    }

    if (layers.ote && a.ote) {
      const x1 = this.x(a.ote.fromTime);
      const y1 = this.y(a.ote.top);
      const y2 = this.y(a.ote.bottom);
      if (x1 !== null && y1 !== null && y2 !== null) {
        ctx.fillStyle = rgba(COLORS.ink, 0.07);
        ctx.fillRect(x1, y1, width - x1, y2 - y1);
        ctx.fillStyle = COLORS.mute;
        ctx.textAlign = 'right';
        ctx.fillText('OTE 62–79%', width - LABEL_INSET, (y1 + y2) / 2);
      }
    }

    if (layers.fvg) {
      for (const f of a.fvgs) {
        const x1 = this.x(f.time);
        const y1 = this.y(f.top);
        const y2 = this.y(f.bottom);
        if (x1 === null || y1 === null || y2 === null) continue;
        const color = f.dir === 'bull' ? COLORS.jade : COLORS.coral;
        ctx.fillStyle = rgba(color, 0.08);
        ctx.fillRect(x1, y1, width - x1, y2 - y1);
        ctx.strokeStyle = rgba(color, 0.45);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(x1 + 0.5, y1 + 0.5, width - x1 + 4, y2 - y1);
        ctx.setLineDash([]);
        if (y2 - y1 >= 11 && x1 > 0) {
          ctx.fillStyle = rgba(color, 0.9);
          ctx.textAlign = 'left';
          ctx.fillText('FVG', x1 + 5, (y1 + y2) / 2);
        }
      }
    }

    if (layers.breakers) {
      for (const b of a.breakers) {
        const x1 = this.x(b.flippedTime);
        const y1 = this.y(b.top);
        const y2 = this.y(b.bottom);
        if (x1 === null || y1 === null || y2 === null) continue;
        const color = b.dir === 'bull' ? COLORS.jade : COLORS.coral;
        ctx.fillStyle = rgba(color, 0.07);
        ctx.fillRect(x1, y1, width - x1, y2 - y1);
        ctx.strokeStyle = rgba(color, 0.7);
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(x1 + 0.5, y1 + 0.5, width - x1 + 4, y2 - y1);
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(
          'Breaker',
          Math.max(4, x1 + 5),
          y2 - y1 >= 13 ? (y1 + y2) / 2 : y1 - 8,
        );
      }
    }

    if (layers.blocks) {
      for (const ob of a.orderBlocks) {
        if (ob.score < minScore && ob.id !== selectedId) continue;
        const x1 = this.x(ob.time);
        const xEnd =
          ob.mitigated && ob.mitigatedTime ? this.x(ob.mitigatedTime) : width;
        const y1 = this.y(ob.top);
        const y2 = this.y(ob.bottom);
        if (x1 === null || xEnd === null || y1 === null || y2 === null)
          continue;
        const color = ob.dir === 'bull' ? COLORS.jade : COLORS.coral;
        const isSetup = a.setup?.obId === ob.id;
        const isSelected = ob.id === selectedId;
        ctx.fillStyle = rgba(
          color,
          ob.mitigated ? 0.07 : isSetup || isSelected ? 0.26 : 0.16,
        );
        ctx.fillRect(x1, y1, xEnd - x1, y2 - y1);
        if (isSelected) {
          ctx.strokeStyle = COLORS.ink;
          ctx.lineWidth = 2;
          ctx.strokeRect(x1 + 0.5, y1 + 0.5, xEnd - x1 + 4, y2 - y1);
        }
        if (!ob.mitigated) {
          if (!isSelected) {
            ctx.strokeStyle = rgba(color, isSetup ? 1 : 0.6);
            ctx.lineWidth = isSetup ? 1.5 : 1;
            ctx.strokeRect(x1 + 0.5, y1 + 0.5, width - x1 + 4, y2 - y1);
          }
          ctx.fillStyle = color;
          ctx.textAlign = 'right';
          // Sit the label just outside the zone when the zone is too thin to hold it.
          const inside = y2 - y1 >= 13;
          ctx.fillText(
            `OB ${ob.score}/5`,
            width - LABEL_INSET,
            inside ? (y1 + y2) / 2 : ob.dir === 'bull' ? y2 + 8 : y1 - 8,
          );
        }
      }
    }
    ctx.restore();
  }

  private drawLines(ctx: Ctx, width: number) {
    const { analysis: a, layers } = this.data;
    if (!a) return;
    ctx.save();
    ctx.font = FONT;
    ctx.lineWidth = 1;

    if (layers.levels) {
      for (const l of a.levels) {
        const x1 = l.kind === 'ROUND' ? 0 : this.x(l.fromTime);
        const y = this.y(l.price);
        if (x1 === null || y === null) continue;
        ctx.strokeStyle = rgba(COLORS.mute, l.kind === 'ROUND' ? 0.35 : 0.7);
        ctx.setLineDash(l.kind === 'ROUND' ? [1, 5] : [8, 4]);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x1), y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        if (LEVEL_LABEL[l.kind]) {
          ctx.fillStyle = COLORS.mute;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(LEVEL_LABEL[l.kind], Math.max(6, x1 + 6), y - 2);
        }
      }
    }

    if (layers.range && a.range) {
      const x1 = this.x(a.range.fromTime);
      const ye = this.y(a.range.eq);
      if (x1 !== null && ye !== null) {
        ctx.strokeStyle = rgba(COLORS.mute, 0.55);
        ctx.setLineDash([1, 4]);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x1), ye + 0.5);
        ctx.lineTo(width, ye + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.mute;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Premium', Math.max(6, x1 + 6), ye - 3);
        ctx.textBaseline = 'top';
        ctx.fillText('Discount', Math.max(6, x1 + 6), ye + 4);
      }
    }

    if (layers.structure) {
      for (const e of a.events) {
        const x1 = this.x(e.fromTime);
        const x2 = this.x(e.time);
        const y = this.y(e.price);
        if (x1 === null || x2 === null || y === null || x2 < 0) continue;
        const color = e.dir === 'bull' ? COLORS.jade : COLORS.coral;
        ctx.strokeStyle = color;
        ctx.setLineDash(e.type === 'CHoCH' ? [4, 3] : []);
        ctx.beginPath();
        ctx.moveTo(x1, y + 0.5);
        ctx.lineTo(x2, y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = e.dir === 'bull' ? 'bottom' : 'top';
        ctx.fillText(e.type, (x1 + x2) / 2, e.dir === 'bull' ? y - 2 : y + 3);
      }
    }

    // Asian high and low carried forward: the liquidity a Judas swing runs.
    if (layers.sessions && a.asia) {
      const x1 = this.x(a.asia.end);
      const swept = a.judas?.side;
      const sides = [
        {
          price: a.asia.high,
          label: 'Asia high',
          isSwept: swept === 'high',
          above: true,
        },
        {
          price: a.asia.low,
          label: 'Asia low',
          isSwept: swept === 'low',
          above: false,
        },
      ];
      for (const side of sides) {
        const y = this.y(side.price);
        if (x1 === null || y === null) continue;
        ctx.strokeStyle = rgba(COLORS.gold, side.isSwept ? 0.35 : 0.8);
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x1), y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(COLORS.gold, side.isSwept ? 0.6 : 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = side.above ? 'bottom' : 'top';
        ctx.fillText(
          side.isSwept ? `${side.label} · swept` : side.label,
          Math.max(6, x1 + 6),
          side.above ? y - 2 : y + 3,
        );
      }
    }

    if (layers.liquidity) {
      for (const l of a.liquidity) {
        const x1 = this.x(l.fromTime);
        const y = this.y(l.price);
        if (x1 === null || y === null) continue;
        ctx.strokeStyle = rgba(COLORS.gold, l.swept ? 0.3 : 0.9);
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x1), y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        if (l.swept) continue;
        const label =
          l.kind === 'SWING'
            ? l.side === 'buy'
              ? 'BSL'
              : 'SSL'
            : LIQUIDITY_LABEL[l.kind];
        ctx.fillStyle = COLORS.gold;
        ctx.textAlign = 'right';
        ctx.textBaseline = l.side === 'buy' ? 'bottom' : 'top';
        ctx.fillText(
          label,
          width - LABEL_INSET,
          l.side === 'buy' ? y - 2 : y + 3,
        );
      }
      for (const idm of a.inducements ?? []) {
        const x1 = this.x(idm.fromTime);
        const y = this.y(idm.price);
        if (x1 === null || y === null) continue;
        const xEnd = idm.swept && idm.sweptTime ? (this.x(idm.sweptTime) ?? width) : width;
        ctx.strokeStyle = rgba(COLORS.gold, idm.swept ? 0.45 : 0.85);
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x1), y + 0.5);
        ctx.lineTo(Math.max(x1, xEnd), y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(COLORS.gold, idm.swept ? 0.65 : 0.95);
        ctx.textAlign = "left";
        ctx.textBaseline = idm.dir === "bull" ? "top" : "bottom";
        ctx.fillText(idm.swept ? "IDM · swept" : "IDM", Math.max(6, x1 + 4), idm.dir === "bull" ? y + 3 : y - 2);
      }
    }
    ctx.restore();
    drawReactionChips(ctx, width, this.data.reaction, (p) => this.y(p));
  }
}
