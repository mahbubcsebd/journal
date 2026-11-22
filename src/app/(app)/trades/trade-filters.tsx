"use client";

import { CalendarRange, Download, Filter, Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import { SESSION_LABEL } from "@/lib/trading/metrics";
import { filtersToQuery, type TradeFilters } from "@/lib/trade-filters";
import { cn } from "@/lib/utils";

type Options = {
  symbols: string[];
  tags: { id: string; name: string; kind: string }[];
  setups: { id: string; name: string }[];
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T | undefined;
  options: { value: T | undefined; label: string }[];
  onChange: (v: T | undefined) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex h-9 items-center rounded-lg border bg-card p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full flex-1 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition",
            value === o.value ? "bg-secondary text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TradeFiltersBar({ filters, options }: { filters: TradeFilters; options: Options }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const sheetId = useId();
  const dateId = useId();

  const update = (patch: Partial<TradeFilters>) => {
    const q = filtersToQuery({ ...filters, ...patch, page: 1 });
    start(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };
  const clearAll = () => {
    setFrom("");
    setTo("");
    start(() => router.replace(pathname, { scroll: false }));
  };

  const active = [filters.symbol, filters.side, filters.result, filters.status, filters.session, filters.from, filters.to, filters.tag, filters.setup].filter(Boolean).length;
  // Everything except the always-visible symbol search.
  const sheetCount = [filters.side, filters.result, filters.status, filters.session, filters.from, filters.to, filters.tag, filters.setup].filter(Boolean).length;
  const custom = Boolean(filters.from || filters.to);
  const exportQuery = filtersToQuery({ ...filters, page: 1 });

  const symbolPicker = (
    <Combobox
      aria-label="Symbol"
      value={filters.symbol ?? ""}
      onValueChange={(v) => update({ symbol: v || undefined })}
      className="h-9 w-full sm:w-36"
      searchPlaceholder="Search or type a symbol…"
      allowCustom
      format={(s) => s.trim().toUpperCase().replace(/\s+/g, "")}
      options={[{ value: "", label: "All symbols", icon: <Search className="size-4 text-muted-foreground" /> }, ...options.symbols.map((s) => ({ value: s, label: s }))]}
    />
  );

  const dateRange = (
    <ResponsivePopover
      open={dateOpen}
      onOpenChange={setDateOpen}
      title="Date range"
      id={dateId}
      align="start"
      className="w-72 p-4"
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-full items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-medium shadow-xs transition hover:bg-accent sm:w-auto",
            custom && "border-brand/40 bg-brand-soft/60 text-brand-ink",
          )}
        >
          <CalendarRange className="size-4" />
          <span className="truncate">{custom ? `${filters.from || "…"} → ${filters.to || "today"}` : "Date range"}</span>
        </button>
      }
    >
      <form
        className="grid gap-3 p-4 md:p-0"
        onSubmit={(e) => {
          e.preventDefault();
          setDateOpen(false);
          update({ from: from || undefined, to: to || undefined });
        }}
      >
        <Field label="From" htmlFor="tf-from">
          <Input id="tf-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" htmlFor="tf-to" hint="Leave empty for today.">
          <Input id="tf-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
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
  );

  const sideSeg = (
    <Segmented
      value={filters.side}
      onChange={(side) => update({ side })}
      options={[
        { value: undefined, label: "All" },
        { value: "LONG", label: "Long" },
        { value: "SHORT", label: "Short" },
      ]}
    />
  );
  const statusSeg = (
    <Segmented
      value={filters.status}
      onChange={(status) => update({ status })}
      options={[
        { value: undefined, label: "All" },
        { value: "OPEN", label: "Open" },
        { value: "CLOSED", label: "Closed" },
      ]}
    />
  );
  const resultSeg = (
    <Segmented
      value={filters.result}
      onChange={(result) => update({ result })}
      options={[
        { value: undefined, label: "Any" },
        { value: "win", label: "Wins" },
        { value: "loss", label: "Losses" },
      ]}
    />
  );
  const sessionPicker = (
    <Combobox
      aria-label="Session"
      value={filters.session ?? ""}
      onValueChange={(v) => update({ session: (v || undefined) as typeof filters.session })}
      className="h-9 w-full sm:w-auto"
      options={[{ value: "", label: "All sessions" }, ...Object.entries(SESSION_LABEL).map(([k, v]) => ({ value: k, label: v }))]}
    />
  );
  const tagPicker = options.tags.length > 0 && (
    <Combobox
      aria-label="Tag"
      value={filters.tag ?? ""}
      onValueChange={(v) => update({ tag: v || undefined })}
      className="h-9 w-full sm:w-auto sm:max-w-56"
      searchPlaceholder="Search tags…"
      groups={[
        { options: [{ value: "", label: "All tags" }] },
        ...(["TAG", "MISTAKE", "EMOTION"] as const)
          .map((kind) => ({
            heading: kind === "TAG" ? "Tags" : kind === "MISTAKE" ? "Mistakes" : "Emotions",
            options: options.tags.filter((t) => t.kind === kind).map((t) => ({ value: t.id, label: t.name })),
          }))
          .filter((g) => g.options.length > 0),
      ]}
    />
  );
  const setupPicker = options.setups.length > 0 && (
    <Combobox
      aria-label="Setup"
      value={filters.setup ?? ""}
      onValueChange={(v) => update({ setup: v || undefined })}
      className="h-9 w-full sm:w-auto sm:max-w-56"
      searchPlaceholder="Search setups…"
      options={[{ value: "", label: "All setups" }, ...options.setups.map((s) => ({ value: s.id, label: s.name }))]}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Phones: symbol + a Filters sheet, so the page leads with trades. */}
      <div className="flex w-full items-center gap-2 sm:hidden">
        <div className="flex-1">{symbolPicker}</div>
        <ResponsivePopover
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Filter trades"
          id={sheetId}
          align="end"
          trigger={
            <button
              type="button"
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 text-[13px] font-medium shadow-xs transition hover:bg-accent",
                sheetCount > 0 && "border-brand/40 bg-brand-soft/60 text-brand-ink",
              )}
            >
              <Filter className="size-4" />
              {sheetCount ? `Filters · ${sheetCount}` : "Filters"}
            </button>
          }
        >
          <div className="grid gap-4 p-4">
            <Field label="Direction">{sideSeg}</Field>
            <Field label="Status">{statusSeg}</Field>
            <Field label="Result">{resultSeg}</Field>
            <Field label="Session">{sessionPicker}</Field>
            {tagPicker && <Field label="Tag or mistake">{tagPicker}</Field>}
            {setupPicker && <Field label="Setup">{setupPicker}</Field>}
            <Field label="Date range">{dateRange}</Field>
            <div className="flex gap-2">
              {active > 0 && (
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={clearAll}>
                  <X /> Clear all
                </Button>
              )}
              <Button type="button" size="sm" className="flex-1" onClick={() => setSheetOpen(false)}>
                Show trades
              </Button>
            </div>
          </div>
        </ResponsivePopover>
        <Button asChild variant="outline" size="icon" aria-label="Export CSV">
          <a href={`/api/trades/export${exportQuery ? `?${exportQuery}` : ""}`}>
            <Download />
          </a>
        </Button>
      </div>

      {/* Tablet and up: the full inline bar. */}
      <div className="hidden w-full flex-wrap items-center gap-2 sm:flex">
        {symbolPicker}
        {sideSeg}
        {statusSeg}
        {resultSeg}
        {sessionPicker}
        {tagPicker}
        {setupPicker}
        {dateRange}
        {active > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X /> Clear
          </Button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <div className="flex-1" />
        <Button asChild variant="outline" size="sm">
          <a href={`/api/trades/export${exportQuery ? `?${exportQuery}` : ""}`}>
            <Download /> CSV
          </a>
        </Button>
      </div>
    </div>
  );
}
