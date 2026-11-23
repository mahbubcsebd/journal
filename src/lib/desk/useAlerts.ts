"use client";

import { useEffect, useRef } from "react";
import { fmt } from "./format";
import { useSettings, useT } from "./settings";
import type { Analysis } from "./types";

export type Light = "ready" | "wait" | "avoid";

/** Traffic-light state for the current setup against the live price. */
export function lightOf(analysis: Analysis | null, price: number | null): { light: Light; inside: boolean; gone: boolean } {
  const s = analysis?.setup;
  if (!s || price === null) return { light: "avoid", inside: false, gone: false };
  const inside = price <= s.zoneTop && price >= s.zoneBottom;
  const gone = s.dir === "bull" ? price < s.zoneBottom : price > s.zoneTop;
  return { light: gone ? "avoid" : inside ? "ready" : "wait", inside, gone };
}

export function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio is blocked until the page has been interacted with.
  }
}

/** Raises an alert when price enters the setup zone, a new setup appears, structure breaks, or a Judas swing completes. */
export function useAlerts(analysis: Analysis | null, price: number | null, digits: number, push: (text: string) => void) {
  const { s } = useSettings();
  const t = useT();
  const prev = useRef<{ key: string; obId: string | null; inside: boolean; eventTime: number; judasTime: number } | null>(null);

  useEffect(() => {
    if (!analysis || price === null) return;
    const key = `${analysis.symbol}:${analysis.tf}`;
    const setup = analysis.setup;
    const { inside } = lightOf(analysis, price);
    const lastEvent = analysis.events[analysis.events.length - 1];
    const judas = analysis.judas;
    const now = { key, obId: setup?.obId ?? null, inside, eventTime: lastEvent?.time ?? 0, judasTime: judas?.time ?? 0 };
    const before = prev.current;
    prev.current = now;
    // First reading of this market: remember it, but do not alert.
    if (!before || before.key !== key) return;

    const messages: string[] = [];
    const tag = `${analysis.symbol} ${analysis.tf}`;
    if (setup && now.obId !== before.obId) {
      messages.push(t(setup.dir === "bull" ? "alert.newBuy" : "alert.newSell", { tag, price: fmt(setup.entry, digits), grade: setup.grade }));
    } else if (setup && inside && !before.inside) {
      messages.push(t(setup.dir === "bull" ? "alert.inBuy" : "alert.inSell", { tag, price: fmt(setup.entry, digits) }));
    }
    if (lastEvent && now.eventTime !== before.eventTime) {
      messages.push(
        t("alert.event", {
          tag,
          dir: t(lastEvent.dir === "bull" ? "word.bullish" : "word.bearish"),
          type: t(lastEvent.type === "CHoCH" ? "word.choch" : "word.bos"),
          price: fmt(lastEvent.price, digits),
        }),
      );
    }
    if (judas && now.judasTime !== before.judasTime) {
      messages.push(t(`alert.judas.${judas.side}`, { tag, level: fmt(judas.level, digits) }));
    }
    for (const text of messages) {
      if (s.alertToast) push(text);
      if (s.alertNotify && "Notification" in window && Notification.permission === "granted") new Notification("SMC Desk", { body: text });
      if (s.alertSound) beep();
    }
  }, [analysis, price, digits, push, s.alertToast, s.alertNotify, s.alertSound, t]);
}
