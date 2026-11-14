"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave: calls `save(value)` `delay` ms after the last change.
 * Only saves when the value differs from what was last saved (so simply
 * opening a page never writes), saves run one at a time in order, and any
 * pending change is flushed when the component unmounts or the page hides.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<unknown>, delay = 900) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSaved = useRef(JSON.stringify(value));
  const pending = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const run = useEffectEvent((v: T) => {
    pending.current = null;
    const json = JSON.stringify(v);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    setStatus("saving");
    chain.current = chain.current.then(async () => {
      try {
        await save(v);
        setStatus("saved");
      } catch {
        lastSaved.current = ""; // retry on the next change
        setStatus("error");
      }
    });
  });

  useEffect(() => {
    if (JSON.stringify(value) === lastSaved.current) return;
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);

  useEffect(() => {
    const flush = () => {
      if (pending.current !== null) run(pending.current);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return status;
}
