"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { api, downloadFile, fmt, fmtR, fmtTime } from "@/lib/desk/format";
import { useSettings, useT } from "@/lib/desk/settings";
import type { Emotion, JournalAnalytics as JournalAnalyticsData, JournalTrade, TradeStatus } from "@/lib/desk/types";
import { useNowSec } from "@/lib/desk/useNews";
import { notifyJournalChanged } from "@/lib/desk/useRiskGuard";
import JournalAnalytics from "./JournalAnalytics";
import { EMOTIONS, todayUsage } from "./SaveTradeDialog";
import { buttonClass, inputClass, Modal, Stat } from "./ui";

const STATUS_COLOR: Record<TradeStatus, string> = {
  pending: "text-gold",
  open: "text-ink",
  won: "text-jade",
  lost: "text-coral",
  cancelled: "text-mute",
  closed: "text-mute",
};

const isDone = (t: JournalTrade) => t.resultR !== undefined || t.pnlUsd !== undefined;
const isWin = (t: JournalTrade) => (t.resultR !== undefined ? t.resultR > 0 : (t.pnlUsd ?? 0) > 0);
const fmtUsd = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}$${fmt(Math.abs(v), 2)}`;

function TradeRow({ trade, onChange, onDelete }: { trade: JournalTrade; onChange(t: JournalTrade): void; onDelete(): void }) {
  const t = useT();
  const { s } = useSettings();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [note, setNote] = useState(trade.note);
  const [closeR, setCloseR] = useState("0");
  const d = trade.digits;
  const isMt5 = trade.source === "mt5";

  const patch = async (body: object) => {
    const r = await api<{ trade: JournalTrade }>(`/api/journal/${trade.id}`, { method: "PATCH", body: JSON.stringify(body) });
    notifyJournalChanged();
    onChange(r.trade);
  };

  const rightSummary =
    trade.resultR !== undefined
      ? fmtR(trade.resultR)
      : trade.pnlUsd !== undefined
        ? fmtUsd(trade.pnlUsd)
        : `${trade.rr.toFixed(1)} R`;

  return (
    <li className="py-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 text-left">
        <span>
          <span className="font-semibold">{trade.symbol}</span>{" "}
          {isMt5 ? (
            <span className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-gold">{t("journal.mt5Badge")}</span>
          ) : (
            <span className="text-mute">{trade.tf}</span>
          )}{" "}
          <span className={trade.dir === "bull" ? "text-jade" : "text-coral"}>{t(trade.dir === "bull" ? "scan.buy" : "scan.sell")}</span>{" "}
          <span className="tabular-nums">{fmt(trade.entry, d)}</span>
          <span className="block text-[13px] text-mute">
            {fmtTime(trade.createdAt, s.localTime)}, {t(`emotion.${trade.emotion}`)}
            {trade.grade ? `, ${t("bt.grade")} ${trade.grade}` : ""}
            {trade.volume !== undefined ? `, ${t("acct.lots", { v: trade.volume.toFixed(2) })}` : ""}
          </span>
        </span>
        <span className="text-right">
          <span className={`block font-semibold ${STATUS_COLOR[trade.status]}`}>{t(`trade.${trade.status}`)}</span>
          <span className="block text-[13px] tabular-nums text-mute">{rightSummary}</span>
        </span>
      </button>

      {open && (
        <div className="mt-3 rounded-lg bg-hull p-4">
          <dl className="grid grid-cols-3 gap-3 text-[14px] tabular-nums">
            <div>
              <dt className="text-[13px] text-mute">{t("row.entry")}</dt>
              <dd>{fmt(trade.entry, d)}</dd>
            </div>
            {isMt5 ? (
              <>
                <div>
                  <dt className="text-[13px] text-mute">{t("journal.exitPrice")}</dt>
                  <dd>{fmt(trade.exitPrice ?? trade.target, d)}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-mute">{t("journal.volume")}</dt>
                  <dd>{trade.volume !== undefined ? trade.volume.toFixed(2) : "—"}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt className="text-[13px] text-mute">{t("row.stop")}</dt>
                  <dd className="text-coral">{fmt(trade.stop, d)}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-mute">{t("row.target")}</dt>
                  <dd className="text-jade">{fmt(trade.target, d)}</dd>
                </div>
              </>
            )}
          </dl>

          <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
            <label className="text-[13px] text-mute">
              {t("save.emotion")}
              <select className={`${inputClass} mt-1 text-ink`} value={trade.emotion} onChange={(e) => patch({ emotion: e.target.value as Emotion })}>
                {EMOTIONS.map((e) => (
                  <option key={e} value={e}>
                    {t(`emotion.${e}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[13px] text-mute">
              {t("journal.review")}
              <textarea
                className={`${inputClass} mt-1 text-ink`}
                rows={2}
                value={note}
                placeholder={t("journal.reviewHint")}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== trade.note && patch({ note })}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            {trade.status === "pending" && (
              <button type="button" className={buttonClass} onClick={() => patch({ status: "closed" })}>
                {t("journal.cancel")}
              </button>
            )}
            {trade.status === "open" && (
              <>
                <label className="text-[13px] text-mute">
                  {t("journal.closeAt")}
                  <input className={`${inputClass} mt-1 w-24 text-ink`} inputMode="decimal" value={closeR} onChange={(e) => setCloseR(e.target.value)} />
                </label>
                <button type="button" className={buttonClass} onClick={() => patch({ status: "closed", resultR: Number(closeR) })}>
                  {t("journal.closeNow")}
                </button>
              </>
            )}
            <button type="button" className={`${buttonClass} ml-auto text-coral`} onClick={() => window.confirm(t("journal.deleteAsk")) && onDelete()}>
              {t("journal.delete")}
            </button>
          </div>

          {trade.chartImage && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-[13px] text-mute">{t("journal.chartSnapshot")}</p>
              <button type="button" onClick={() => setPreviewOpen(true)} aria-label={t("journal.viewChart")} className="block rounded border border-line hover:border-mute">
                <Image
                  unoptimized
                  src={trade.chartImage}
                  alt={t("journal.chartSnapshot")}
                  width={320}
                  height={180}
                  className="h-28 w-auto rounded object-cover"
                />
              </button>
              {previewOpen && (
                <Modal title={`${trade.symbol} ${trade.tf} · ${t("journal.chartSnapshot")}`} onClose={() => setPreviewOpen(false)}>
                  <Image
                    unoptimized
                    src={trade.chartImage}
                    alt={t("journal.chartSnapshot")}
                    width={960}
                    height={540}
                    className="h-auto w-full rounded border border-line"
                  />
                </Modal>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function JournalView({ toast }: { toast(text: string): void }) {
  const t = useT();
  const { s } = useSettings();
  const [trades, setTrades] = useState<JournalTrade[] | null>(null);
  const [analytics, setAnalytics] = useState<JournalAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nowSec = useNowSec(60_000);

  const load = useCallback(() => {
    api<{ trades: JournalTrade[]; analytics?: JournalAnalyticsData }>("/api/journal")
      .then((r) => {
        setTrades(r.trades);
        setAnalytics(r.analytics ?? null);
        setError(null);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const done = (trades ?? []).filter(isDone);
  const wins = done.filter(isWin).length;
  const rTrades = done.filter((x) => x.resultR !== undefined);
  const totalR = rTrades.reduce((sum, x) => sum + x.resultR!, 0);
  const weekAgo = nowSec > 0 ? nowSec - 7 * 86400 : Infinity;
  const weekR = rTrades.filter((x) => (x.closedAt ?? x.createdAt) >= weekAgo).reduce((sum, x) => sum + x.resultR!, 0);
  const mt5Done = done.filter((x) => x.pnlUsd !== undefined);
  const mt5Pnl = mt5Done.reduce((sum, x) => sum + x.pnlUsd!, 0);
  const usage = todayUsage(trades ?? [], (s.balance * s.riskPct) / 100);
  const overTrades = s.maxTrades > 0 && usage.count >= s.maxTrades;
  const overLoss = s.maxLossR > 0 && usage.lostR >= s.maxLossR;
  const byEmotion = EMOTIONS.map((e) => {
    const list = done.filter((x) => x.emotion === e);
    return {
      e,
      n: list.length,
      r: list.reduce((sum, x) => sum + (x.resultR ?? 0), 0),
      wins: list.filter(isWin).length,
    };
  }).filter((x) => x.n > 0);

  const exportCsv = () => {
    const head = "created,source,symbol,timeframe,side,grade,volume,entry,exit_price,stop,target,planned_rr,status,result_r,pnl_usd,emotion,note";
    const lines = (trades ?? []).map((x) =>
      [
        new Date(x.createdAt * 1000).toISOString(),
        x.source ?? "paper",
        x.symbol,
        x.tf,
        x.dir === "bull" ? "buy" : "sell",
        x.grade ?? "",
        x.volume ?? "",
        x.entry,
        x.exitPrice ?? "",
        x.stop,
        x.target,
        x.rr.toFixed(2),
        x.status,
        x.resultR ?? "",
        x.pnlUsd ?? "",
        x.emotion,
        `"${x.note.replaceAll('"', '""')}"`,
      ].join(","),
    );
    downloadFile("smc-desk-journal.csv", [head, ...lines].join("\n"), "text/csv");
  };

  const remove = async (id: string) => {
    await api(`/api/journal/${id}`, { method: "DELETE" });
    setTrades((list) => list && list.filter((x) => x.id !== id));
    notifyJournalChanged();
    load();
    toast(t("journal.deleted"));
  };

  return (
    <div className="brief-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-[860px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">{t("journal.title")}</h1>
            <p className="mt-1 max-w-[60ch] text-mute">{t("journal.lede")}</p>
          </div>
          {trades && trades.length > 0 && (
            <button type="button" className={buttonClass} onClick={exportCsv}>
              {t("journal.export")}
            </button>
          )}
        </div>

        {error && <p className="mt-6 text-coral">{error}</p>}
        {!trades && !error && <p className="mt-6 text-mute">{t("state.loading")}</p>}

        {trades && trades.length === 0 && <p className="mt-8 max-w-[52ch]">{t("journal.empty")}</p>}

        {trades && trades.length > 0 && (
          <>
            {(overTrades || overLoss) && (
              <p className="mt-5 rounded-md border border-coral px-3 py-2">
                {overLoss ? t("save.overLoss", { r: fmtR(-usage.lostR), max: s.maxLossR }) : t("save.overTrades", { n: usage.count, max: s.maxTrades })}
              </p>
            )}

            <dl className={`mt-6 grid grid-cols-2 gap-x-6 gap-y-5 ${mt5Done.length > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
              <Stat label={t("journal.finished")} value={String(done.length)} />
              <Stat label={t("bt.winRate")} value={done.length ? `${((wins / done.length) * 100).toFixed(0)}%` : "—"} />
              <Stat label={t("bt.totalR")} value={rTrades.length ? fmtR(totalR) : "—"} tone={rTrades.length ? (totalR >= 0 ? "good" : "bad") : undefined} />
              <Stat label={t("journal.week")} value={fmtR(weekR)} tone={weekR > 0 ? "good" : weekR < 0 ? "bad" : undefined} />
              {mt5Done.length > 0 && (
                <Stat label={t("journal.mt5Pnl")} value={fmtUsd(mt5Pnl)} tone={mt5Pnl > 0 ? "good" : mt5Pnl < 0 ? "bad" : undefined} />
              )}
            </dl>

            {analytics && <JournalAnalytics analytics={analytics} localTime={s.localTime} />}

            {byEmotion.length > 0 && (
              <>
                <h2 className="mb-2 mt-8 text-[13px] font-semibold text-mute">{t("journal.byEmotion")}</h2>
                <ul className="max-w-[480px] divide-y divide-line border-y border-line tabular-nums">
                  {byEmotion.map((x) => (
                    <li key={x.e} className="grid grid-cols-[1fr_auto_5rem] gap-x-4 py-1.5">
                      <span>{t(`emotion.${x.e}`)}</span>
                      <span className="text-[13px] text-mute">{t("journal.emotionRow", { n: x.n, wins: x.wins })}</span>
                      <span className={`text-right font-semibold ${x.r >= 0 ? "text-jade" : "text-coral"}`}>{fmtR(x.r)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h2 className="mb-1 mt-8 text-[13px] font-semibold text-mute">{t("journal.trades")}</h2>
            <ul className="divide-y divide-line border-y border-line">
              {trades.map((x) => (
                <TradeRow
                  key={x.id}
                  trade={x}
                  onChange={(next) => {
                    setTrades((list) => list && list.map((y) => (y.id === next.id ? next : y)));
                    load();
                  }}
                  onDelete={() => remove(x.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
