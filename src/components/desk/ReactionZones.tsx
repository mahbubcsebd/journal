"use client";

import { fmt } from "@/lib/desk/format";
import { useT, type T } from "@/lib/desk/settings";
import type { AdrState, ReactionBrief, ReactionZone } from "@/lib/desk/types";

/** Chart labels stay in English in both languages, like BOS and CHoCH. */
export const KIND_LABEL: Record<string, string> = {
  OB: "OB",
  FVG: "FVG",
  BRK: "Breaker",
  OTE: "OTE",
  EQH: "EQH",
  EQL: "EQL",
  PDH: "PDH",
  PDL: "PDL",
  PWH: "PWH",
  PWL: "PWL",
  SWING: "Swing",
  ASIA_H: "Asia high",
  ASIA_L: "Asia low",
  DO: "Day open",
  NYO: "NY open",
  WO: "Week open",
  ROUND: "Round",
};

const MAX_KINDS_SHOWN = 3;
const LIQUIDITY_GROUPS = new Set(["liquidity", "asia"]);
const pct = (p: number) => Math.round(p * 100);

export function kindsLabel(kinds: readonly string[]): string {
  const shown = kinds.slice(0, MAX_KINDS_SHOWN).map((k) => KIND_LABEL[k] ?? k);
  const rest = kinds.length - MAX_KINDS_SHOWN;
  return rest > 0 ? `${shown.join(" · ")} +${rest}` : shown.join(" · ");
}

function ZoneRow({ zone, digits, t }: { zone: ReactionZone; digits: number; t: T }) {
  const support = zone.side === "support";
  const tone = support ? "border-jade" : "border-coral";
  const fill = support ? "bg-jade" : "bg-coral";
  const known = zone.probability !== null;
  const lo = zone.low === null ? 0 : pct(zone.low);
  const hi = zone.high === null ? 0 : pct(zone.high);

  return (
    <li className={`rounded-md border-l-2 bg-deck px-3 py-2 ${tone} ${known ? "" : "opacity-70"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-semibold">
          {LIQUIDITY_GROUPS.has(zone.group) && <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full bg-gold align-middle" />}
          {kindsLabel(zone.kinds)}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-mute">{t("rz.distance", { v: zone.distanceAtr.toFixed(1) })}</span>
      </div>
      <div className="mt-0.5 text-[12px] tabular-nums text-mute">
        {fmt(zone.bottom, digits)} – {fmt(zone.top, digits)}
        {zone.members > 1 && <span> · {t("rz.stacked", { n: zone.members })}</span>}
      </div>

      {known ? (
        <>
          <div className="mt-2 flex items-center gap-3">
            <span className="w-11 shrink-0 text-[18px] font-semibold leading-none tabular-nums">{pct(zone.probability!)}%</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="img" aria-label={`${pct(zone.probability!)}%`}>
              <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct(zone.probability!)}%` }} />
            </div>
          </div>
          <div className="mt-1.5 text-[12px] text-mute">
            {t("rz.sample", { n: zone.n, lo, hi })}
            {zone.basis === "group" && <span> · {t("rz.typeAverage")}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] tabular-nums text-mute">
            {zone.reach !== null && <span title={t("rz.reachHint")}>{t("rz.reach", { p: pct(zone.reach) })}</span>}
            {zone.depthMedian !== null && <span title={t("rz.depthHint")}>{t("rz.depth", { p: pct(zone.depthMedian) })}</span>}
            {zone.runMedian !== null && <span title={t("rz.runHint")}>{t("rz.run", { v: zone.runMedian.toFixed(1) })}</span>}
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-[12px] text-mute">{t("rz.notEnough")}</p>
      )}
    </li>
  );
}

function Stack({ title, zones, digits, t }: { title: string; zones: ReactionZone[]; digits: number; t: T }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[12px] font-semibold text-mute">{title}</h3>
      {zones.length === 0 ? (
        <p className="text-[12px] text-mute">{t("rz.none")}</p>
      ) : (
        <ul className="space-y-1.5">
          {zones.map((z) => (
            <ZoneRow key={z.id} zone={z} digits={digits} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdrMeter({ adr, digits, t }: { adr: AdrState; digits: number; t: T }) {
  const used = pct(adr.used);
  return (
    <div className="rounded-md bg-deck px-3 py-2">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="font-semibold text-mute">{t("rz.adrTitle")}</span>
        <span className="tabular-nums">{t("rz.adrUsed", { used, adr: fmt(adr.adr, digits) })}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${used}%`}>
        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, used)}%` }} />
      </div>
      <p className="mt-1.5 text-[12px] tabular-nums text-mute">
        {t("rz.adrProjected", { lo: fmt(adr.projectedLow, digits), hi: fmt(adr.projectedHigh, digits) })}
      </p>
    </div>
  );
}

/** Zones around price, nearest to price in the middle: resistance on top, support below. */
export default function ReactionZones({ brief, digits }: { brief: ReactionBrief | null; digits: number }) {
  const t = useT();
  if (!brief) return <p className="text-[13px] text-mute">{t("rz.building")}</p>;

  const above = [...brief.above].reverse();
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-mute">
        <span
          className={`rounded border px-1.5 py-0.5 font-semibold ${brief.validated ? "border-jade text-jade" : "border-line text-mute"}`}
          title={t(brief.validated ? "rz.adjustedHint" : "rz.baseOnlyHint")}
        >
          {t(brief.validated ? "rz.adjusted" : "rz.baseOnly")}
        </span>
      </p>
      <Stack title={t("rz.above")} zones={above} digits={digits} t={t} />
      <div className="flex items-center gap-2 text-[12px] font-semibold tabular-nums" aria-label="price">
        <span className="h-px flex-1 bg-gold/60" />
        <span className="text-gold">{fmt(brief.price, digits)}</span>
        <span className="h-px flex-1 bg-gold/60" />
      </div>
      <Stack title={t("rz.below")} zones={brief.below} digits={digits} t={t} />
      {brief.adr && <AdrMeter adr={brief.adr} digits={digits} t={t} />}
      <p className="text-[12px] text-mute">{t("rz.limit")}</p>
    </div>
  );
}
