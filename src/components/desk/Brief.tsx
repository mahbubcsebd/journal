"use client";

import { fmt, lotSize } from "@/lib/desk/format";
import { useSettings, useT, type T } from "@/lib/desk/settings";
import {
  TIMEFRAMES,
  type Analysis,
  type Bias,
  type OpenPosition,
  type ReactionBrief,
  type RiskGuardStatus,
  type TF,
  type Trend,
} from "@/lib/desk/types";
import { matchesSymbol } from "@/lib/desk/useAccount";
import { lightOf, type Light } from "@/lib/desk/useAlerts";
import { useSymbolInfo } from "@/lib/desk/useSymbolInfo";
import { CheckRow, OpenPositionsList, Score, Section, ZoneDetail } from "./BriefSections";
import ReactionZones from "./ReactionZones";
import SetupExplain from "./SetupExplain";
import { buttonClass } from "./ui";

interface Props {
  analysis: Analysis | null;
  bias: Bias | null;
  price: number | null;
  digits: number;
  tf: TF;
  minScore: number;
  selectedId: string | null;
  replay: boolean;
  positions?: OpenPosition[];
  riskGuard?: RiskGuardStatus | null;
  reaction?: ReactionBrief | null;
  onSelect(id: string | null): void;
  onTimeframe(tf: TF): void;
  onSave(): void;
}

export const TREND_COLOR: Record<Trend, string> = { bull: "text-jade", bear: "text-coral", neutral: "text-mute" };
const LIGHT_COLOR: Record<Light, string> = { ready: "bg-jade", wait: "bg-gold", avoid: "bg-coral" };

function summary(a: Analysis, price: number, digits: number, t: T) {
  const parts = [t(`sum.trend.${a.trend}`, { tf: a.tf })];
  if (a.range) parts.push(t(price > a.range.eq ? "sum.premium" : "sum.discount"));
  if (a.setup) parts.push(t(a.setup.dir === "bull" ? "sum.zone.buy" : "sum.zone.sell", { d: fmt(Math.abs(price - a.setup.entry), digits) }));
  return parts.join(" ");
}

function SetupBlock({
  analysis,
  price,
  digits,
  replay,
  riskGuard,
  onSave,
}: {
  analysis: Analysis;
  price: number;
  digits: number;
  replay: boolean;
  riskGuard?: RiskGuardStatus | null;
  onSave(): void;
}) {
  const t = useT();
  const { s: settings } = useSettings();
  const symbolInfo = useSymbolInfo(analysis.symbol);
  const s = analysis.setup;
  const { light, inside, gone } = lightOf(analysis, price);
  const explain = (
    <SetupExplain
      key={`${analysis.symbol}:${analysis.tf}:${settings.lang}:${replay ? analysis.lastTime : "live"}`}
      symbol={analysis.symbol}
      tf={analysis.tf}
      until={replay ? analysis.lastTime : undefined}
    />
  );

  const lightRow = (
    <p className="flex items-center gap-2 text-[13px] font-semibold">
      <span className={`h-2.5 w-2.5 rounded-full ${LIGHT_COLOR[light]}`} aria-hidden />
      {t(`light.${light}`)}
      <span className="font-normal text-mute">{s ? t("setup.label", { tf: analysis.tf, grade: s.grade }) : analysis.tf}</span>
    </p>
  );

  if (!s) {
    return (
      <div className="px-5 py-6">
        {lightRow}
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">{t("setup.none")}</h1>
        <p className="mt-2 max-w-[40ch] text-mute">{t(`note.${analysis.setupNote || "no_zone"}`, { dir: t(`word.${analysis.trend}`) })}</p>
        <p className="mt-4 max-w-[44ch] text-[13px] text-mute">{summary(analysis, price, digits, t)}</p>
        {explain}
      </div>
    );
  }

  const long = s.dir === "bull";
  const distance = fmt(Math.abs(price - s.entry), digits);
  const status = gone ? t("status.gone") : inside ? t("status.inside") : t(long ? "status.above" : "status.below", { d: distance });
  const passed = s.checks.filter((c) => c.ok).length;
  const riskMoney = (settings.balance * settings.riskPct) / 100;
  const lot = lotSize(analysis.symbol, s.entry, s.stop, riskMoney, symbolInfo);

  return (
    <div className={`border-l-[3px] px-5 py-6 ${long ? "border-jade" : "border-coral"}`}>
      {lightRow}
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
        {t(long ? "setup.buy" : "setup.sell", { price: fmt(s.entry, digits) })}
      </h1>
      <p className="mt-2 max-w-[40ch] text-mute">{status}</p>

      <dl className="mt-5 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-2 tabular-nums">
        <dt className="text-mute">{t("row.entry")}</dt>
        <dd className="text-[18px] font-medium">{fmt(s.entry, digits)}</dd>
        <dd className="text-[13px] text-mute">{t("row.zoneEdge")}</dd>

        <dt className="text-mute">{t("row.stop")}</dt>
        <dd className="text-[18px] font-medium text-coral">{fmt(s.stop, digits)}</dd>
        <dd className="text-[13px] text-mute">{t("row.risk", { x: fmt(Math.abs(s.entry - s.stop), digits) })}</dd>

        <dt className="text-mute">{t("row.target")}</dt>
        <dd className="text-[18px] font-medium text-jade">{fmt(s.target, digits)}</dd>
        <dd className="text-[13px] text-mute">{t(`target.${s.targetKind}`)}</dd>

        <dt className="text-mute">{t("row.reward")}</dt>
        <dd className="text-[18px] font-medium">{s.rr.toFixed(1)} R</dd>
        <dd className="text-[13px] text-mute">{t("row.perR")}</dd>
      </dl>

      <p className="mt-4 rounded-md bg-deck px-3 py-2 text-[13px] tabular-nums">
        {lot.lots >= 0.01
          ? t("lot.line", { lots: lot.lots.toFixed(2), money: fmt(lot.loss, 2), limit: fmt(riskMoney, 2), pct: settings.riskPct })
          : t("lot.tooSmall", { money: fmt(riskMoney, 2) })}
        {!lot.exact && <span className="text-mute"> {t("lot.approx")}</span>}
      </p>

      <h2 className="mb-2 mt-6 text-[13px] font-semibold text-mute">{t("checks.count", { n: passed, m: s.checks.length })}</h2>
      <ul className="space-y-1.5">
        {s.checks.map((c) => (
          <CheckRow key={c.key} ok={c.ok}>
            <span className={c.ok ? "" : "line-through decoration-line"}>
              {t(c.key === "location" ? `check.location.${s.dir}` : `check.${c.key}`, { tf: analysis.tf, htf: analysis.htf ?? "" })}
            </span>
            {!c.ok && <span className="sr-only"> ({t("check.notMet")})</span>}
          </CheckRow>
        ))}
      </ul>

      {!replay && riskGuard?.anyLimitHit && (
        <p className="mt-4 rounded-md border border-coral/50 bg-coral/15 px-3 py-2 text-[13px] font-medium text-ink">
          {t("riskGuard.briefNotice")}
        </p>
      )}
      {!replay && (
        <button type="button" onClick={onSave} className={`${buttonClass} mt-5`}>
          {t("setup.save")}
        </button>
      )}
      <p className="mt-5 max-w-[44ch] text-[13px] text-mute">{summary(analysis, price, digits, t)}</p>
      {explain}
    </div>
  );
}

export default function Brief({ analysis, bias, price, digits, tf, minScore, selectedId, replay, positions, riskGuard, reaction, onSelect, onTimeframe, onSave }: Props) {
  const t = useT();
  if (!analysis || price === null) return <div className="px-5 py-6 text-mute">{t("state.reading")}</div>;

  const openPositions = (positions ?? []).filter((p) => matchesSymbol(p.symbol, analysis.symbol));
  const selected = selectedId ? analysis.orderBlocks.find((o) => o.id === selectedId) : undefined;
  const blocks = analysis.orderBlocks
    .filter((o) => !o.mitigated && (o.score >= minScore || o.id === selectedId))
    .map((o) => ({ ...o, distance: price > o.top ? price - o.top : price < o.bottom ? o.bottom - price : 0 }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);
  const pools = analysis.liquidity.filter((l) => !l.swept).sort((a, b) => b.price - a.price);
  const lastEvent = analysis.events[analysis.events.length - 1];

  return (
    <div>
      <SetupBlock analysis={analysis} price={price} digits={digits} replay={replay} riskGuard={riskGuard} onSave={onSave} />

      {!replay && openPositions.length > 0 && (
        <Section title={t("acct.positions")}>
          <OpenPositionsList positions={openPositions} />
        </Section>
      )}

      {selected && <ZoneDetail ob={selected} digits={digits} onClose={() => onSelect(null)} />}

      {!replay && (
        <Section title={t("sec.trend")}>
          <div className="grid grid-cols-6 gap-1.5">
            {TIMEFRAMES.map((x) => {
              const trend = bias?.[x] ?? "neutral";
              return (
                <button
                  key={x}
                  type="button"
                  onClick={() => onTimeframe(x)}
                  aria-pressed={x === tf}
                  className={`rounded-md px-1 py-2 text-center transition-colors hover:bg-deck ${x === tf ? "bg-deck ring-1 ring-line" : ""}`}
                >
                  <span className="block text-[12px] text-mute">{x}</span>
                  <span className={`block text-[13px] font-semibold ${TREND_COLOR[trend]}`}>{t(`trend.${trend}`)}</span>
                </button>
              );
            })}
          </div>
          {lastEvent && (
            <p className="mt-3 text-[13px] text-mute">
              {t("latest.event", {
                tf,
                dir: t(lastEvent.dir === "bull" ? "word.bullish" : "word.bearish"),
                type: t(lastEvent.type === "CHoCH" ? "word.choch" : "word.bos"),
                price: fmt(lastEvent.price, digits),
              })}
            </p>
          )}
        </Section>
      )}

      {!replay && (
        <Section title={t("sec.reaction")}>
          <ReactionZones brief={reaction ?? null} digits={digits} />
        </Section>
      )}

      {analysis.smt && (
        <Section title={t("sec.smt")}>
          <p className={`border-l-2 pl-3 text-[14px] ${analysis.smt.dir === "bull" ? "border-jade" : "border-coral"}`}>
            {t(analysis.smt.dir === "bull" ? "smt.bull" : "smt.bear", {
              symbol: analysis.symbol,
              peer: analysis.smt.peer,
              p1: fmt(analysis.smt.primaryFrom, digits),
              p2: fmt(analysis.smt.primaryTo, digits),
              q1: fmt(analysis.smt.peerFrom, Math.abs(analysis.smt.peerTo) > 20 ? 2 : 5),
              q2: fmt(analysis.smt.peerTo, Math.abs(analysis.smt.peerTo) > 20 ? 2 : 5),
            })}
          </p>
        </Section>
      )}

      {analysis.asia && (
        <Section title={t("sec.asia")}>
          <dl className="grid grid-cols-2 gap-x-4 tabular-nums">
            {(["low", "high"] as const).map((side) => (
              <div key={side} className={analysis.judas?.side === side ? "opacity-60" : ""}>
                <dt className="text-[12px] text-mute">{t(`asia.${side}`)}</dt>
                <dd className="text-[18px] font-medium text-gold">{fmt(analysis.asia![side], digits)}</dd>
              </div>
            ))}
          </dl>
          {analysis.judas ? (
            <p className={`mt-3 border-l-2 pl-3 text-[14px] ${analysis.judas.dir === "bull" ? "border-jade" : "border-coral"}`}>
              {t(`judas.${analysis.judas.side}`, { extreme: fmt(analysis.judas.extreme, digits) })}
            </p>
          ) : (
            <p className="mt-3 text-[13px] text-mute">{t("judas.none")}</p>
          )}
        </Section>
      )}

      <Section title={t("sec.blocks")}>
        {blocks.length === 0 ? (
          <p className="text-mute">{t("blocks.none")}</p>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {blocks.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onSelect(o.id === selectedId ? null : o.id)}
                  aria-pressed={o.id === selectedId}
                  className={`relative grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 rounded-md px-2 py-1.5 text-left tabular-nums hover:bg-deck ${
                    o.id === selectedId ? "bg-deck" : ""
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-sm ${o.dir === "bull" ? "bg-jade" : "bg-coral"}`} aria-hidden />
                  <span>
                    <span className="sr-only">{t(o.dir === "bull" ? "zone.title.bull" : "zone.title.bear")} </span>
                    {fmt(o.bottom, digits)} – {fmt(o.top, digits)}
                    <span className="ml-2 text-[13px] text-mute">
                      {o.distance === 0 ? t("blocks.inside") : t("blocks.away", { d: fmt(o.distance, digits) })}
                    </span>
                  </span>
                  <Score value={o.score} label={t("zone.score", { n: o.score })} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {blocks.length > 0 && <p className="mt-2 text-[13px] text-mute">{t("blocks.hint")}</p>}
      </Section>

      <Section title={t("sec.liquidity")}>
        {pools.length === 0 ? (
          <p className="text-mute">{t("liq.none")}</p>
        ) : (
          <ul className="space-y-1.5 tabular-nums">
            {pools.map((l, i) => {
              const crossing = l.price >= price && (i === pools.length - 1 || pools[i + 1].price < price);
              return (
                <li key={l.id}>
                  <div className="grid grid-cols-[1fr_auto] gap-x-3">
                    <span>
                      <span className="text-gold">{fmt(l.price, digits)}</span>
                      <span className="ml-2 text-[13px] text-mute">{t(l.kind === "SWING" ? `liq.SWING.${l.side}` : `liq.${l.kind}`)}</span>
                    </span>
                    <span className="text-[13px] text-mute">{fmt(Math.abs(l.price - price), digits)}</span>
                  </div>
                  {crossing && (
                    <div className="my-2 flex items-center gap-2 text-[12px] text-mute">
                      <span className="h-px flex-1 bg-line" />
                      {t("liq.price", { price: fmt(price, digits) })}
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <p className="border-t border-line px-5 py-5 text-[13px] text-mute">{t("disclaimer")}</p>
    </div>
  );
}
