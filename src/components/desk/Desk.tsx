"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, fmt } from "@/lib/desk/format";
import { syncPaperTrades } from "@/server/actions/desk-trades";
import { SettingsProvider, useSettings, useT } from "@/lib/desk/settings";
import { TF_SECONDS, type PriceAlert, type TF } from "@/lib/desk/types";
import { useAccount } from "@/lib/desk/useAccount";
import { beep, useAlerts } from "@/lib/desk/useAlerts";
import { useFeed, type FeedHandlers } from "@/lib/desk/useFeed";
import { useNews } from "@/lib/desk/useNews";
import { usePriceAlerts } from "@/lib/desk/usePriceAlerts";
import { usePush } from "@/lib/desk/usePush";
import { useRiskGuard } from "@/lib/desk/useRiskGuard";
import AlertsSheet from "./AlertsSheet";
import BacktestView from "./BacktestView";
import ChartScreen from "./ChartScreen";
import ChatPanel from "./ChatPanel";
import JournalView from "./JournalView";
import LearnView from "./LearnView";
import NewsAlertBanner, { NewsPill } from "./NewsAlertBanner";
import RiskGuardBanner from "./RiskGuardBanner";
import ScannerView from "./ScannerView";
import SettingsSheet from "./SettingsSheet";

type Tab = "chart" | "scanner" | "backtest" | "journal" | "learn";
const TABS: Tab[] = ["chart", "scanner", "backtest", "journal", "learn"];

interface Meta {
  source?: "mock" | "mt5";
  symbols: string[];
  telegram: boolean;
}

function Countdown({ closeAt }: { closeAt: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.round(closeAt - Date.now() / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [closeAt]);
  if (left === null || left < 0 || left > 86400) return <>—</>;
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const sec = String(left % 60).padStart(2, "0");
  return <>{h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`}</>;
}

function Shell() {
  const { s, set } = useSettings();
  const t = useT();
  const [tab, setTab] = useState<Tab>("chart");
  const [meta, setMeta] = useState<Meta>({ symbols: ["XAUUSD"], telegram: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const nextToast = useRef(1);

  const toast = useCallback((text: string) => {
    const id = nextToast.current++;
    setToasts((list) => [...list.slice(-3), { id, text }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 9000);
  }, []);

  // Paper trades live on the SMC server; copy them into Journal's trades when
  // the desk opens and each time the Journal tab is shown.
  useEffect(() => {
    if (tab !== "chart" && tab !== "journal") return;
    syncPaperTrades()
      .then((r) => {
        if (!r.ok) console.warn("[desk] paper trade sync:", r.error);
        else if (r.inserted > 0) toast(`${r.inserted} paper trade(s) added to your Journal`);
      })
      .catch((e: unknown) => console.error("[desk] paper trade sync failed", e));
  }, [tab, toast]);

  const { alerts, reload: reloadAlerts, create: createAlert, rearm: rearmAlert, remove: removeAlert } = usePriceAlerts();
  const push = usePush();
  const onAlertRef = useRef<(alert: PriceAlert, message: string) => void>(() => {});
  useEffect(() => {
    onAlertRef.current = (_alert, message) => {
      if (s.alertToast) toast(message);
      if (s.alertSound) beep();
      reloadAlerts();
    };
  }, [reloadAlerts, s.alertSound, s.alertToast, toast]);

  const handlers = useRef<FeedHandlers | null>(null);
  const setFeedHandlers = useCallback((h: FeedHandlers | null) => {
    handlers.current = h ? { ...h, onAlert: (alert, message) => onAlertRef.current(alert, message) } : null;
  }, []);
  const feed = useFeed(s.symbol, s.tf, handlers);
  const account = useAccount(meta.source === "mt5" || feed.source === "mt5");
  const riskGuard = useRiskGuard({
    maxTrades: s.maxTrades,
    maxLossR: s.maxLossR,
    balance: s.balance,
    riskPct: s.riskPct,
    syncKey: (account?.deals.length ?? 0) + (account?.positions.length ?? 0),
  });
  const { news, activeAlert, dismiss } = useNews(s.symbol);

  useAlerts(feed.analysis, feed.price, feed.digits, toast);

  useEffect(() => {
    api<Meta>("/api/meta")
      .then((m) => {
        if (m.symbols?.length) setMeta(m);
      })
      .catch(() => {});
  }, []);

  // A saved symbol that this data source does not have falls back to the first one.
  useEffect(() => {
    if (meta.symbols.length && !meta.symbols.includes(s.symbol)) set({ symbol: meta.symbols[0] });
  }, [meta.symbols, s.symbol, set]);

  const openMarket = useCallback(
    (symbol: string, tf: TF) => {
      set({ symbol, tf });
      setTab("chart");
    },
    [set],
  );

  const statusText =
    feed.status === "live"
      ? t(feed.source === "mt5" ? "status.live" : "status.demo")
      : t(
          feed.status === "connecting"
            ? "status.connecting"
            : feed.status === "error"
              ? "status.error"
              : feed.status === "stale"
                ? "status.stale"
                : "status.offline",
        );
  const statusColor = feed.status === "live" ? (feed.source === "mt5" ? "bg-jade" : "bg-gold") : "bg-coral";
  const closeAt = feed.analysis ? feed.analysis.lastTime + 2 * TF_SECONDS[s.tf] : 0;

  return (
    <div className="dark flex min-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-xl border border-line bg-water pb-14 text-ink shadow-soft lg:h-[calc(100dvh-8rem)] lg:pb-0">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 lg:px-5">
        <span className="text-[18px] font-bold tracking-tight">SMC Desk</span>

        <nav aria-label={t("label.sections")} className="hidden gap-1 lg:flex">
          {TABS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setTab(x)}
              aria-current={tab === x ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-[14px] font-semibold ${tab === x ? "bg-deck text-ink" : "text-mute hover:text-ink"}`}
            >
              {t(`tab.${x}`)}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="relative">
            <span className="sr-only">{t("label.market")}</span>
            <select
              value={s.symbol}
              onChange={(e) => set({ symbol: e.target.value })}
              className="rounded-md border border-line bg-hull px-2.5 py-1.5 font-semibold"
            >
              {meta.symbols.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <span className="text-[18px] font-semibold tabular-nums">{feed.price !== null ? fmt(feed.price, feed.digits) : "—"}</span>
          {account?.account && (
            <span className="hidden items-center gap-2 rounded-md border border-line bg-hull px-2.5 py-1 text-[13px] tabular-nums sm:inline-flex">
              <span className="text-mute">{t("acct.balance")}</span>
              <span className="font-semibold">${fmt(account.account.balance, 2)}</span>
              <span className="text-line">|</span>
              <span className="text-mute">{t("acct.equity")}</span>
              <span className="font-semibold">${fmt(account.account.equity, 2)}</span>
              {(account.account.profit !== 0 || account.positions.length > 0) && (
                <span className={`font-semibold ${account.account.profit >= 0 ? "text-jade" : "text-coral"}`}>
                  {account.account.profit >= 0 ? "+" : ""}${fmt(account.account.profit, 2)}
                </span>
              )}
              {account.positions.length > 0 && (
                <span className="text-[12px] text-gold">{t("acct.openCount", { n: account.positions.length })}</span>
              )}
            </span>
          )}
          <span className="flex items-center gap-2 text-[13px] text-mute">
            <span className={`h-2 w-2 rounded-full ${statusColor} ${feed.status === "live" ? "pulse-dot" : ""}`} />
            {statusText}
          </span>
          {feed.status === "live" && (
            <span className="text-[13px] tabular-nums text-mute" title={t("label.countdown")}>
              {s.tf} <Countdown closeAt={closeAt} />
            </span>
          )}
          <NewsPill events={news?.events ?? []} nextEvent={news?.nextEvent} />
          <button
            type="button"
            onClick={() => setAlertsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[13px] font-semibold hover:border-mute"
          >
            <span>{t("alerts.button")}</span>
            {alerts.filter((a) => a.active).length > 0 && (
              <span className="rounded-full bg-gold/20 px-1.5 text-[11px] font-bold tabular-nums text-gold">
                {alerts.filter((a) => a.active).length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => set({ lang: s.lang === "en" ? "bn" : "en" })}
            className="rounded-md border border-line px-2.5 py-1 text-[13px] font-semibold hover:border-mute"
          >
            {s.lang === "en" ? "বাংলা" : "English"}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-line px-2.5 py-1 text-[13px] font-semibold hover:border-mute"
          >
            {t("action.settings")}
          </button>
        </div>
      </header>

      <NewsAlertBanner
        alert={activeAlert}
        events={news?.events ?? []}
        onDismiss={dismiss}
      />

      <RiskGuardBanner status={riskGuard} onOpenSettings={() => setSettingsOpen(true)} />

      {feed.source === "mock" && (
        <p className="border-b border-line bg-hull px-4 py-2 text-[13px] text-mute lg:px-5">
          <span className="font-semibold text-gold">{t("demo.title")}</span> {t("demo.body")}
        </p>
      )}

      <ChartScreen active={tab === "chart"} feed={feed} positions={account?.positions ?? []} alerts={alerts} riskGuard={riskGuard} onHandlers={setFeedHandlers} toast={toast} />
      {tab === "scanner" && <ScannerView symbols={meta.symbols} positions={account?.positions ?? []} onOpen={openMarket} />}
      {tab === "backtest" && <BacktestView />}
      {tab === "journal" && <JournalView toast={toast} />}
      {tab === "learn" && <LearnView />}

      <nav aria-label={t("label.sections")} className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-hull lg:hidden">
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setTab(x)}
            aria-current={tab === x ? "page" : undefined}
            className={`px-1 py-3.5 text-[13px] font-semibold ${tab === x ? "text-ink shadow-[inset_0_2px_0_var(--color-gold)]" : "text-mute"}`}
          >
            {t(`tab.${x}`)}
          </button>
        ))}
      </nav>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-5 lg:items-end lg:px-5">
        {toasts.map((x) => (
          <p key={x.id} className="pointer-events-auto max-w-[420px] rounded-lg border border-gold bg-deck px-4 py-3 text-[14px] shadow-lg shadow-black/40">
            {x.text}
          </p>
        ))}
      </div>

      <ChatPanel symbol={s.symbol} tf={s.tf} tab={tab} />

      {settingsOpen && <SettingsSheet telegram={meta.telegram} onClose={() => setSettingsOpen(false)} />}
      {alertsOpen && (
        <AlertsSheet
          symbols={meta.symbols}
          currentSymbol={s.symbol}
          currentTf={s.tf}
          currentPrice={feed.price}
          telegram={meta.telegram}
          alerts={alerts}
          push={push}
          onCreate={createAlert}
          onRearm={rearmAlert}
          onDelete={removeAlert}
          onCreatedToast={() => toast(t("alerts.created"))}
          onClose={() => setAlertsOpen(false)}
        />
      )}
    </div>
  );
}

export default function Desk() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}
