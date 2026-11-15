"use client";

import { Download, Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
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
}: {
  value: T | undefined;
  options: { value: T | undefined; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full rounded-md px-2.5 text-[13px] font-medium transition",
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

  const update = (patch: Partial<TradeFilters>) => {
    const q = filtersToQuery({ ...filters, ...patch, page: 1 });
    start(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };

  const active =
    filters.symbol || filters.side || filters.result || filters.status || filters.session || filters.from || filters.to || filters.tag || filters.setup;
  const exportQuery = filtersToQuery({ ...filters, page: 1 });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Combobox
        aria-label="Symbol"
        value={filters.symbol ?? ""}
        onValueChange={(v) => update({ symbol: v || undefined })}
        className="h-9 w-36"
        searchPlaceholder="Search or type a symbol…"
        allowCustom
        format={(s) => s.trim().toUpperCase().replace(/\s+/g, "")}
        options={[{ value: "", label: "All symbols", icon: <Search className="size-4 text-muted-foreground" /> }, ...options.symbols.map((s) => ({ value: s, label: s }))]}
      />
      <Segmented
        value={filters.side}
        onChange={(side) => update({ side })}
        options={[
          { value: undefined, label: "All" },
          { value: "LONG", label: "Long" },
          { value: "SHORT", label: "Short" },
        ]}
      />
      <Segmented
        value={filters.status}
        onChange={(status) => update({ status })}
        options={[
          { value: undefined, label: "All" },
          { value: "OPEN", label: "Open" },
          { value: "CLOSED", label: "Closed" },
        ]}
      />
      <Segmented
        value={filters.result}
        onChange={(result) => update({ result })}
        options={[
          { value: undefined, label: "Any" },
          { value: "win", label: "Wins" },
          { value: "loss", label: "Losses" },
        ]}
      />
      <Combobox
        aria-label="Session"
        value={filters.session ?? ""}
        onValueChange={(v) => update({ session: (v || undefined) as typeof filters.session })}
        className="h-9 w-auto"
        options={[{ value: "", label: "All sessions" }, ...Object.entries(SESSION_LABEL).map(([k, v]) => ({ value: k, label: v }))]}
      />
      {options.tags.length > 0 && (
        <Combobox
          aria-label="Tag"
          value={filters.tag ?? ""}
          onValueChange={(v) => update({ tag: v || undefined })}
          className="h-9 w-auto max-w-56"
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
      )}
      {options.setups.length > 0 && (
        <Combobox
          aria-label="Setup"
          value={filters.setup ?? ""}
          onValueChange={(v) => update({ setup: v || undefined })}
          className="h-9 w-auto max-w-56"
          searchPlaceholder="Search setups…"
          options={[{ value: "", label: "All setups" }, ...options.setups.map((s) => ({ value: s.id, label: s.name }))]}
        />
      )}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="From"
          value={filters.from ?? ""}
          onChange={(e) => update({ from: e.target.value || undefined })}
          className="h-9 w-[140px]"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label="To"
          value={filters.to ?? ""}
          onChange={(e) => update({ to: e.target.value || undefined })}
          className="h-9 w-[140px]"
        />
      </div>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => start(() => router.replace(pathname, { scroll: false }))}>
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
  );
}
