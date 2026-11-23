"use client";

import { fmt } from "@/lib/desk/format";
import { useT } from "@/lib/desk/settings";
import type { OpenPosition, OrderBlock } from "@/lib/desk/types";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-5">
      <h2 className="mb-3 text-[13px] font-semibold text-mute">{title}</h2>
      {children}
    </section>
  );
}

export function Score({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex gap-[3px]" role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < value ? "bg-ink" : "bg-line"}`} />
      ))}
    </span>
  );
}

export function CheckRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`relative flex items-start gap-2.5 ${ok ? "" : "text-mute"}`}>
      <span
        aria-hidden
        className={`mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
          ok ? "bg-ink text-water" : "border border-line"
        }`}
      >
        {ok ? "✓" : ""}
      </span>
      <span>{children}</span>
    </li>
  );
}

export function ZoneDetail({ ob, digits, onClose }: { ob: OrderBlock; digits: number; onClose(): void }) {
  const t = useT();
  const f = ob.factors;
  const rows: [string, boolean][] = [
    ["displacement", f.displacement],
    ["fvg", f.fvg],
    ["sweep", f.sweep],
    [`location.${ob.dir}`, f.goodLocation],
    ["fresh", f.fresh],
  ];
  return (
    <section className="border-t border-line bg-deck px-5 py-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-semibold">
          {t(ob.dir === "bull" ? "zone.title.bull" : "zone.title.bear")}
          <span className="block text-[13px] font-normal tabular-nums text-mute">
            {fmt(ob.bottom, digits)} – {fmt(ob.top, digits)}, {t("zone.score", { n: ob.score })}
          </span>
        </h2>
        <button type="button" onClick={onClose} aria-label={t("action.close")} className="rounded px-2 py-0.5 text-mute hover:text-ink">
          ✕
        </button>
      </div>
      <ul className="space-y-2 text-[14px]">
        {rows.map(([key, ok]) => (
          <CheckRow key={key} ok={ok}>
            {t(`why.${key}.${ok ? "ok" : "no"}`)}
          </CheckRow>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-mute">{t(ob.origin === "CHoCH" ? "zone.fromChoch" : "zone.fromBos")}</p>
    </section>
  );
}

export function OpenPositionsList({ positions }: { positions: OpenPosition[] }) {
  const t = useT();
  return (
    <ul className="space-y-2 tabular-nums">
      {positions.map((p) => {
        const net = p.profit + p.swap;
        return (
          <li key={p.ticket} className="rounded-md bg-deck px-3 py-2 text-[13px]">
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className={`font-semibold ${p.dir === "bull" ? "text-jade" : "text-coral"}`}>{t(p.dir === "bull" ? "scan.buy" : "scan.sell")}</span>{" "}
                <span>{t("acct.lots", { v: p.volume.toFixed(2) })}</span> <span className="text-mute">@ {fmt(p.priceOpen, p.digits)}</span>
              </span>
              <span className={`font-semibold ${net >= 0 ? "text-jade" : "text-coral"}`}>
                {net >= 0 ? "+" : ""}${fmt(net, 2)}
              </span>
            </div>
            {(p.sl !== null || p.tp !== null) && (
              <div className="mt-1 flex gap-3 text-[12px] text-mute">
                {p.sl !== null && (
                  <span>
                    {t("acct.sl")} {fmt(p.sl, p.digits)}
                  </span>
                )}
                {p.tp !== null && (
                  <span>
                    {t("acct.tp")} {fmt(p.tp, p.digits)}
                  </span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

