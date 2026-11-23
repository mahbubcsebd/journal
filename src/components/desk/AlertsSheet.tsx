"use client";

import { useState } from "react";
import { fmt, fmtTime } from "@/lib/desk/format";
import { useSettings, useT } from "@/lib/desk/settings";
import { TIMEFRAMES, type AlertCondition, type PriceAlert, type TF } from "@/lib/desk/types";
import type { PushState } from "@/lib/desk/usePush";
import { buttonClass, inputClass, Modal, primaryClass } from "./ui";

interface Props {
  symbols: string[];
  currentSymbol: string;
  currentTf: TF;
  currentPrice: number | null;
  telegram: boolean;
  alerts: PriceAlert[];
  push: PushState;
  onCreate(input: { symbol: string; tf: TF; condition: AlertCondition; targetPrice: number | null; note: string }): Promise<PriceAlert>;
  onRearm(id: string): Promise<void>;
  onDelete(id: string): Promise<void>;
  onCreatedToast(): void;
  onClose(): void;
}

const CONDITIONS: readonly AlertCondition[] = ["above", "below", "zone_ob", "zone_fvg"];

function describeAlert(a: PriceAlert, t: (k: string, vars?: Record<string, string | number>) => string): string {
  const condLabel = t(`alerts.cond.${a.condition}`);
  if (a.targetPrice !== null) return `${a.symbol} ${a.tf} · ${condLabel} ${fmt(a.targetPrice, a.digits)}`;
  return `${a.symbol} ${a.tf} · ${condLabel}`;
}

export default function AlertsSheet({
  symbols,
  currentSymbol,
  currentTf,
  currentPrice,
  telegram,
  alerts,
  push,
  onCreate,
  onRearm,
  onDelete,
  onCreatedToast,
  onClose,
}: Props) {
  const t = useT();
  const { s } = useSettings();
  const [symbol, setSymbol] = useState(currentSymbol);
  const [tf, setTf] = useState<TF>(currentTf);
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [priceStr, setPriceStr] = useState(currentPrice !== null ? String(currentPrice) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPrice = condition === "above" || condition === "below";
  const activeAlerts = alerts.filter((a) => a.active);
  const triggeredAlerts = alerts.filter((a) => !a.active);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(priceStr);
    if (needsPrice && (!Number.isFinite(num) || num <= 0)) {
      setError(t("lot.invalidStop"));
      return;
    }
    setBusy(true);
    try {
      await onCreate({
        symbol,
        tf,
        condition,
        targetPrice: needsPrice ? num : null,
        note: note.trim(),
      });
      setNote("");
      onCreatedToast();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("alerts.title")} onClose={onClose}>
      <p className="text-[13px] text-mute">{t("alerts.lede")}</p>

      <div className="mt-4 rounded-lg border border-line bg-deck p-3.5 text-[13px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">{t("alerts.pushTitle")}</span>
          {push.supported && push.permission !== "denied" && (
            <button
              type="button"
              disabled={push.busy}
              onClick={() => void (push.subscribed ? push.disable() : push.enable())}
              className={buttonClass}
            >
              {t(push.subscribed ? "alerts.disablePush" : "alerts.enablePush")}
            </button>
          )}
        </div>
        <p className={`mt-1.5 ${push.subscribed ? "text-jade" : push.permission === "denied" ? "text-coral" : "text-mute"}`}>
          {!push.supported
            ? t("alerts.pushUnsupported")
            : push.permission === "denied"
              ? t("alerts.pushBlocked")
              : push.subscribed
                ? t("alerts.pushOn")
                : t("alerts.pushOff")}
        </p>
        {push.error && <p className="mt-1 text-coral">{push.error}</p>}
        <p className="mt-1.5 text-mute">{t(telegram ? "set.telegram.on" : "set.telegram.off")}</p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3 border-t border-line pt-4">
        <h3 className="text-[13px] font-semibold text-mute">{t("alerts.newTitle")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[13px] text-mute">
            {t("label.market")}
            <select className={`${inputClass} mt-1 text-ink`} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {symbols.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] text-mute">
            {t("label.timeframe")}
            <select className={`${inputClass} mt-1 text-ink`} value={tf} onChange={(e) => setTf(e.target.value as TF)}>
              {TIMEFRAMES.map((frame) => (
                <option key={frame} value={frame}>
                  {frame}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={`grid gap-3 ${needsPrice ? "grid-cols-2" : "grid-cols-1"}`}>
          <label className="text-[13px] text-mute">
            {t("alerts.condition")}
            <select
              className={`${inputClass} mt-1 text-ink`}
              value={condition}
              onChange={(e) => setCondition(e.target.value as AlertCondition)}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`alerts.cond.${c}`)}
                </option>
              ))}
            </select>
          </label>
          {needsPrice && (
            <label className="text-[13px] text-mute">
              {t("alerts.price")}
              <input
                className={`${inputClass} mt-1 text-ink tabular-nums`}
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
              />
            </label>
          )}
        </div>

        <input
          className={`${inputClass} text-ink`}
          maxLength={300}
          placeholder={t("alerts.notePlaceholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-[13px] text-coral">{error}</p>}
        <button type="submit" disabled={busy} className={primaryClass}>
          {t("alerts.create")}
        </button>
      </form>

      <div className="mt-6 space-y-4 border-t border-line pt-4">
        <h3 className="text-[13px] font-semibold text-mute">{t("alerts.active")}</h3>
        {activeAlerts.length === 0 ? (
          <p className="text-[13px] text-mute">{t("alerts.empty")}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line text-[13px]">
            {activeAlerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <span className="font-semibold text-gold">{describeAlert(a, t)}</span>
                  {a.note && <p className="text-mute">{a.note}</p>}
                </div>
                <button type="button" onClick={() => void onDelete(a.id)} className="text-coral hover:underline">
                  {t("journal.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}

        {triggeredAlerts.length > 0 && (
          <>
            <h3 className="text-[13px] font-semibold text-mute">{t("alerts.triggered")}</h3>
            <ul className="divide-y divide-line border-y border-line text-[13px]">
              {triggeredAlerts.slice(0, 10).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p>{a.lastMessage ?? describeAlert(a, t)}</p>
                    {a.triggeredAt && (
                      <p className="text-[12px] text-mute">{t("alerts.firedAt", { time: fmtTime(a.triggeredAt, s.localTime) })}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => void onRearm(a.id)} className="text-jade hover:underline">
                      {t("alerts.rearm")}
                    </button>
                    <button type="button" onClick={() => void onDelete(a.id)} className="text-coral hover:underline">
                      {t("journal.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}

