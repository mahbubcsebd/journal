export type DrawingTool = "select" | "hline" | "rect" | "fib";

export interface DrawingAnchor {
  time: number;
  price: number;
}

export type ChartDrawing =
  | { id: string; kind: "hline"; price: number }
  | { id: string; kind: "rect"; a: DrawingAnchor; b: DrawingAnchor }
  | { id: string; kind: "fib"; a: DrawingAnchor; b: DrawingAnchor };

export const FIB_LEVELS = [0, 0.5, 0.618, 0.705, 0.79, 1] as const;

export interface FibLine {
  ratio: number;
  price: number;
  isOte: boolean;
}

/** Retracement prices from impulse anchor `b` (0%) back toward `a` (100%). */
export function fibLevels(aPrice: number, bPrice: number): FibLine[] {
  const span = aPrice - bPrice;
  return FIB_LEVELS.map((ratio) => ({
    ratio,
    price: bPrice + span * ratio,
    isOte: ratio >= 0.618 && ratio <= 0.79,
  }));
}

export function drawingStorageKey(symbol: string): string {
  return `smc-desk.drawings.${symbol.trim().toUpperCase()}`;
}

function isAnchor(v: unknown): v is DrawingAnchor {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.time === "number" && Number.isFinite(o.time) && typeof o.price === "number" && Number.isFinite(o.price);
}

export function parseDrawingsJson(raw: string | null): ChartDrawing[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ChartDrawing[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string" || !o.id) continue;
      if (o.kind === "hline" && typeof o.price === "number" && Number.isFinite(o.price)) {
        out.push({ id: o.id, kind: "hline", price: o.price });
      } else if ((o.kind === "rect" || o.kind === "fib") && isAnchor(o.a) && isAnchor(o.b)) {
        out.push({ id: o.id, kind: o.kind, a: o.a, b: o.b });
      }
    }
    return out;
  } catch {
    return [];
  }
}

const EMPTY_DRAWINGS: readonly ChartDrawing[] = [];
const snapshotCache = new Map<string, { raw: string | null; list: readonly ChartDrawing[] }>();
const listeners = new Set<() => void>();

export function subscribeDrawings(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (typeof window === "undefined") {
    return () => listeners.delete(onStoreChange);
  }
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith("smc-desk.drawings.")) {
      snapshotCache.clear();
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getDrawingsServerSnapshot(): readonly ChartDrawing[] {
  return EMPTY_DRAWINGS;
}

export function loadDrawings(symbol: string): readonly ChartDrawing[] {
  if (typeof window === "undefined") return EMPTY_DRAWINGS;
  try {
    const key = drawingStorageKey(symbol);
    const raw = window.localStorage.getItem(key);
    const cached = snapshotCache.get(key);
    if (cached && cached.raw === raw) return cached.list;
    const list = parseDrawingsJson(raw);
    snapshotCache.set(key, { raw, list });
    return list;
  } catch {
    return EMPTY_DRAWINGS;
  }
}

export function saveDrawings(symbol: string, drawings: readonly ChartDrawing[]): void {
  if (typeof window === "undefined") return;
  try {
    const key = drawingStorageKey(symbol);
    const raw = JSON.stringify(drawings);
    window.localStorage.setItem(key, raw);
    snapshotCache.set(key, { raw, list: drawings });
  } catch {
    // Ignore storage quota errors in restricted browsers.
  }
  for (const fn of listeners) fn();
}

export function appendDrawing(drawings: readonly ChartDrawing[], next: ChartDrawing): ChartDrawing[] {
  return [...drawings, next];
}

export function removeDrawing(drawings: readonly ChartDrawing[], id: string): ChartDrawing[] {
  return drawings.filter((d) => d.id !== id);
}

/** Pure hit test returning top-most matching drawing at (time, price), or null. */
export function hitTestDrawing(
  drawings: readonly ChartDrawing[],
  time: number | null,
  price: number,
  priceTolerance: number,
): ChartDrawing | null {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    if (d.kind === "hline") {
      if (Math.abs(price - d.price) <= priceTolerance) return d;
      continue;
    }
    const low = Math.min(d.a.price, d.b.price) - priceTolerance;
    const high = Math.max(d.a.price, d.b.price) + priceTolerance;
    if (price < low || price > high) continue;
    const minT = Math.min(d.a.time, d.b.time);
    const maxT = Math.max(d.a.time, d.b.time);
    if (time === null || (time >= minT && time <= maxT)) {
      if (d.kind === "rect") return d;
      const lines = fibLevels(d.a.price, d.b.price);
      if (lines.some((l) => Math.abs(price - l.price) <= priceTolerance)) return d;
    }
  }
  return null;
}

export function newDrawingId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
