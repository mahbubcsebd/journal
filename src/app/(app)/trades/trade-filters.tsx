"use client";

import { Download, Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
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
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          key={filters.symbol ?? ""}
          defaultValue={filters.symbol}
          list="trade-symbols"
          placeholder="Symbol"
          className="h-9 w-36 pl-8"
          onKeyDown={(e) => e.key === "Enter" && update({ symbol: e.currentTarget.value || undefined })}
          onBlur={(e) => e.currentTarget.value !== (filters.symbol ?? "") && update({ symbol: e.currentTarget.value || undefined })}
        />
        <datalist id="trade-symbols">
          {options.symbols.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
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
        value={filters.result}
        onChange={(result) => update({ result })}
        options={[
          { value: undefined, label: "Any" },
          { value: "win", label: "Wins" },
          { value: "loss", label: "Losses" },
        ]}
      />
      <Select
        aria-label="Session"
        value={filters.session ?? ""}
        onChange={(e) => update({ session: e.target.value || undefined })}
        className="h-9 w-auto"
      >
        <option value="">All sessions</option>
        {Object.entries(SESSION_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Select>
      {options.tags.length > 0 && (
        <Select aria-label="Tag" value={filters.tag ?? ""} onChange={(e) => update({ tag: e.target.value || undefined })} className="h-9 w-auto">
          <option value="">All tags</option>
          {options.tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.kind === "MISTAKE" ? "Mistake: " : t.kind === "EMOTION" ? "Emotion: " : ""}
              {t.name}
            </option>
          ))}
        </Select>
      )}
      {options.setups.length > 0 && (
        <Select aria-label="Setup" value={filters.setup ?? ""} onChange={(e) => update({ setup: e.target.value || undefined })} className="h-9 w-auto">
          <option value="">All setups</option>
          {options.setups.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
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
