"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { api, fmt, fmtR, lotSize } from "@/lib/desk/format";
import { useSettings, useT } from "@/lib/desk/settings";
import type { Emotion, JournalTrade, Setup, TF } from "@/lib/desk/types";
import { notifyJournalChanged } from "@/lib/desk/useRiskGuard";
import { useSymbolInfo } from "@/lib/desk/useSymbolInfo";
import { inputClass, Modal, primaryClass } from "./ui";

export const EMOTIONS: Emotion[] = ["calm", "confident", "fomo", "revenge", "fear", "bored"];
const CHECKLIST = ["htf", "risk", "news", "calm"] as const;

interface Props {
  symbol: string;
  tf: TF;
  setup: Setup;
  chartImage?: string | null;
  onClose(): void;
  onSaved(): void;
}

/** Trades saved today and the R lost today, for the daily-limit warning. */
export function todayUsage(trades: JournalTrade[], riskMoneyUsd = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startSec = Math.floor(start.getTime() / 1000);
  let count = 0;
  let netR = 0;
  for (const t of trades) {
    if (t.status === "cancelled") continue;
    if (t.createdAt >= startSec) count += 1;
    const realizedAt = t.closedAt ?? t.createdAt;
    if (t.status === "pending" || t.status === "open" || realizedAt < startSec) continue;
    if (t.resultR !== undefined && Number.isFinite(t.resultR)) netR += t.resultR;
    else if (t.pnlUsd !== undefined && Number.isFinite(t.pnlUsd) && riskMoneyUsd > 0) netR += t.pnlUsd / riskMoneyUsd;
  }
  const lostR = Math.round(Math.max(0, -netR) * 100) / 100;
  return { count, lostR };
}

export default function SaveTradeDialog({ symbol, tf, setup, chartImage, onClose, onSaved }: Props) {
  const t = useT();
  const { s } = useSettings();
  const [entry, setEntry] = useState(String(setup.entry));
  const [stop, setStop] = useState(String(setup.stop));
  const [target, setTarget] = useState(String(setup.target));
  const [emotion, setEmotion] = useState<Emotion>("calm");
  const [note, setNote] = useState("");
  const [attachImage, setAttachImage] = useState(Boolean(chartImage));
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [usage, setUsage] = useState<{ count: number; lostR: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const riskMoney = (s.balance * s.riskPct) / 100;

  useEffect(() => {
    api<{ trades: JournalTrade[] }>("/api/journal")
      .then((r) => setUsage(todayUsage(r.trades, riskMoney)))
      .catch(() => setUsage(null));
  }, [riskMoney]);

  const allTicked = CHECKLIST.every((k) => ticks[k]);
  const overTrades = usage !== null && s.maxTrades > 0 && usage.count >= s.maxTrades;
  const overLoss = usage !== null && s.maxLossR > 0 && usage.lostR >= s.maxLossR;
  const symbolInfo = useSymbolInfo(symbol);
  const lot = lotSize(symbol, Number(entry), Number(stop), riskMoney, symbolInfo);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/journal", {
        method: "POST",
        body: JSON.stringify({
          symbol,
          tf,
          dir: setup.dir,
          grade: setup.grade,
          entry: Number(entry),
          stop: Number(stop),
          target: Number(target),
          emotion,
          note,
          ...(attachImage && chartImage ? { chartImage } : {}),
        }),
      });
      notifyJournalChanged();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={t(setup.dir === "bull" ? "save.title.buy" : "save.title.sell", { symbol })} onClose={onClose}>
      {(overTrades || overLoss) && (
        <p className="mb-4 rounded-md border border-coral px-3 py-2 text-[14px]">
          {overLoss ? t("save.overLoss", { r: fmtR(-usage!.lostR), max: s.maxLossR }) : t("save.overTrades", { n: usage!.count, max: s.maxTrades })}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["row.entry", entry, setEntry],
            ["row.stop", stop, setStop],
            ["row.target", target, setTarget],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="text-[13px] text-mute">
            {t(label)}
            <input className={`${inputClass} mt-1 text-ink`} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
          </label>
        ))}
      </div>

      <p className="mt-3 rounded-md bg-deck px-3 py-2 text-[13px] tabular-nums">
        {Math.abs(Number(entry) - Number(stop)) <= 0 || !Number.isFinite(Number(entry)) || !Number.isFinite(Number(stop))
          ? t("lot.invalidStop")
          : lot.lots > 0
            ? t("lot.line", { lots: lot.lots.toFixed(2), money: fmt(lot.loss, 2), limit: fmt(riskMoney, 2), pct: s.riskPct })
            : t("lot.tooSmall", { money: fmt(riskMoney, 2) })}
        {lot.lots > 0 && !lot.exact && <span className="text-mute"> {t("lot.approx")}</span>}
      </p>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-semibold text-mute">{t("save.checklist")}</legend>
        <div className="space-y-2">
          {CHECKLIST.map((k) => (
            <label key={k} className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#57bfa4]"
                checked={Boolean(ticks[k])}
                onChange={(e) => setTicks((x) => ({ ...x, [k]: e.target.checked }))}
              />
              <span>{t(`save.check.${k}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block text-[13px] text-mute">
        {t("save.emotion")}
        <select className={`${inputClass} mt-1 text-ink`} value={emotion} onChange={(e) => setEmotion(e.target.value as Emotion)}>
          {EMOTIONS.map((e) => (
            <option key={e} value={e}>
              {t(`emotion.${e}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-[13px] text-mute">
        {t("save.note")}
        <textarea className={`${inputClass} mt-1 text-ink`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {chartImage && (
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-mute">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#57bfa4]"
              checked={attachImage}
              onChange={(e) => setAttachImage(e.target.checked)}
            />
            <span>{t("journal.attachChart")}</span>
          </label>
          {attachImage && (
            <Image
              unoptimized
              src={chartImage}
              alt={t("journal.chartSnapshot")}
              width={280}
              height={158}
              className="mt-2 h-24 w-auto rounded border border-line object-cover"
            />
          )}
        </div>
      )}

      {error && <p className="mt-3 text-coral">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button type="button" className={primaryClass} disabled={!allTicked || busy} onClick={save}>
          {t("save.submit")}
        </button>
        {!allTicked && <span className="text-[13px] text-mute">{t("save.tickAll")}</span>}
      </div>
    </Modal>
  );
}
