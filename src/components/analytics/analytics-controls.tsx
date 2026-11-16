"use client";

import { CalendarRange, Filter, Loader2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import { INTERVALS, METRICS, type AnalyticsQuery } from "@/lib/analytics-query";
import { RANGES } from "@/lib/ranges";
import { SESSION_LABEL } from "@/lib/trading/metrics";
import { cn } from "@/lib/utils";

type Options = { symbols: string[]; setups: { id: string; name: string }[]; tags: { name: string }[] };

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition",
            value === o.value ? "bg-secondary text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Date range, filters, P&L measure and time grouping for the analytics page — all kept in the URL. */
export function AnalyticsControls({ query, options, tab }: { query: AnalyticsQuery; options: Options; tab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [from, setFrom] = useState(query.from ?? "");
  const [to, setTo] = useState(query.to ?? "");
  const dateId = useId();
  const filterId = useId();

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const f = query.filters;
  const filterCount = Object.values(f).filter(Boolean).length;
  const custom = Boolean(query.from);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => update({ range: r.key === "90d" ? undefined : r.key, from: undefined, to: undefined })}
            className={cn(
              "h-full rounded-md px-2.5 text-[13px] font-medium transition",
              !custom && query.range === r.key ? "bg-secondary text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <ResponsivePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        title="Custom date range"
        id={dateId}
        align="end"
        className="w-72 p-4"
        trigger={
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-medium shadow-xs transition hover:bg-accent",
              custom && "border-brand/40 bg-brand-soft/60 text-brand-ink",
            )}
          >
            <CalendarRange className="size-4" />
            {custom ? `${query.from} → ${query.to ?? "today"}` : "Date range"}
          </button>
        }
      >
        <form
          className="grid gap-3 p-4 md:p-0"
          onSubmit={(e) => {
            e.preventDefault();
            setDateOpen(false);
            update({ from: from || undefined, to: to || undefined, range: undefined });
          }}
        >
          <Field label="From" htmlFor="ac-from">
            <Input id="ac-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} required />
          </Field>
          <Field label="To" htmlFor="ac-to" hint="Leave empty for today.">
            <Input id="ac-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            {custom && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setDateOpen(false);
                  update({ from: undefined, to: undefined });
                }}
              >
                Clear
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </ResponsivePopover>

      <ResponsivePopover
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filters"
        id={filterId}
        align="end"
        className="w-80 p-4"
        trigger={
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-medium shadow-xs transition hover:bg-accent",
              filterCount > 0 && "border-brand/40 bg-brand-soft/60 text-brand-ink",
            )}
          >
            <Filter className="size-4" />
            {filterCount ? `${filterCount} filter${filterCount > 1 ? "s" : ""}` : "Filter"}
          </button>
        }
      >
        <div className="grid gap-3 p-4 md:p-0">
          <Field label="Symbol" htmlFor="af-symbol">
            <Combobox
              id="af-symbol"
              value={f.symbol ?? ""}
              onValueChange={(v) => update({ symbol: v || undefined })}
              options={[{ value: "", label: "All symbols" }, ...options.symbols.map((s) => ({ value: s, label: s }))]}
            />
          </Field>
          <Field label="Direction" htmlFor="af-side">
            <Combobox
              id="af-side"
              value={f.side ?? ""}
              onValueChange={(v) => update({ side: v || undefined })}
              options={[
                { value: "", label: "Long and short" },
                { value: "LONG", label: "Long only" },
                { value: "SHORT", label: "Short only" },
              ]}
            />
          </Field>
          <Field label="Setup" htmlFor="af-setup">
            <Combobox
              id="af-setup"
              value={f.setup ?? ""}
              onValueChange={(v) => update({ setup: v || undefined })}
              options={[{ value: "", label: "All setups" }, ...options.setups.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          <Field label="Session" htmlFor="af-session">
            <Combobox
              id="af-session"
              value={f.session ?? ""}
              onValueChange={(v) => update({ session: v || undefined })}
              options={[{ value: "", label: "All sessions" }, ...Object.entries(SESSION_LABEL).map(([k, v]) => ({ value: k, label: v }))]}
            />
          </Field>
          <Field label="Tag or mistake" htmlFor="af-tag">
            <Combobox
              id="af-tag"
              value={f.tag ?? ""}
              onValueChange={(v) => update({ tag: v || undefined })}
              options={[{ value: "", label: "Any tag" }, ...[...new Set(options.tags.map((t) => t.name))].map((n) => ({ value: n, label: n }))]}
            />
          </Field>
          {filterCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => {
                setFilterOpen(false);
                update({ symbol: undefined, side: undefined, setup: undefined, session: undefined, tag: undefined });
              }}
            >
              <X /> Clear all filters
            </Button>
          )}
        </div>
      </ResponsivePopover>

      <Combobox
        aria-label="P&L showing"
        value={query.metric}
        onValueChange={(v) => update({ metric: v === "net" ? undefined : v })}
        className="h-9 w-auto"
        options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
      />

      {tab === "time" && (
        <>
          <Segmented
            value={query.by}
            onChange={(v) => update({ by: v === "exit" ? "exit" : undefined })}
            options={[
              { value: "entry", label: "Entry time" },
              { value: "exit", label: "Exit time" },
            ]}
          />
          <Combobox
            aria-label="Time interval"
            value={String(query.interval)}
            onValueChange={(v) => update({ interval: v === "60" ? undefined : v })}
            className="h-9 w-auto"
            options={INTERVALS.map((i) => ({ value: String(i), label: i < 60 ? `${i} min` : `${i / 60} hour${i > 60 ? "s" : ""}` }))}
          />
        </>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
