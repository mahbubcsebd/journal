"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  appendDrawing,
  getDrawingsServerSnapshot,
  loadDrawings,
  removeDrawing,
  saveDrawings,
  subscribeDrawings,
  type ChartDrawing,
} from "./drawings";

export function useSymbolDrawings(symbol: string) {
  const getSnapshot = useCallback(() => loadDrawings(symbol), [symbol]);
  const drawings = useSyncExternalStore(subscribeDrawings, getSnapshot, getDrawingsServerSnapshot);

  const addDrawing = useCallback(
    (drawing: ChartDrawing) => {
      saveDrawings(symbol, appendDrawing(loadDrawings(symbol), drawing));
    },
    [symbol],
  );

  const deleteDrawing = useCallback(
    (id: string) => {
      saveDrawings(symbol, removeDrawing(loadDrawings(symbol), id));
    },
    [symbol],
  );

  const clearDrawings = useCallback(() => {
    saveDrawings(symbol, []);
  }, [symbol]);

  return { drawings, addDrawing, deleteDrawing, clearDrawings };
}

