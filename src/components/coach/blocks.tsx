"use client";

import { AlertTriangle, BellOff, Brain, Check, CheckCircle2, Info, Lightbulb, ListChecks, Loader2, OctagonAlert, Target, Timer } from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { Button } from "@/components/ui/button";
import { cellSign, type ActionBlock, type CalloutBlock, type CardsBlock, type ChartBlock, type CoachAction, type CoachBlock, type TableBlock } from "@/lib/coach-blocks";
import { runCoachAction } from "@/server/actions/coach";
import { COACH_TEXT, type CoachLang } from "./i18n";
import { cn, formatMoney } from "@/lib/utils";

const tick = { fontSize: 11, fill: "var(--muted-foreground)" };
const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

export function CoachBlockView({ block, currency, lang = "en" }: { block: CoachBlock; currency: string; lang?: CoachLang }) {
  switch (block.kind) {
    case "action":
      return <ActionView block={block} lang={lang} />;
    case "chart":
      return <ChartView block={block} currency={currency} />;
    case "table":
      return <TableView block={block} />;
    case "cards":
      return <CardsView block={block} />;
    case "callout":
      return <CalloutView block={block} />;
  }
}

function fmt(v: number, unit: ChartBlock["unit"], currency: string, compact = false) {
  switch (unit) {
    case "money":
      return formatMoney(v, currency, { compact, sign: !compact });
    case "percent":
      // Models send both 0.54 and 54 for 54%.
      return `${(Math.abs(v) <= 1 ? v * 100 : v).toFixed(compact ? 0 : 1)}%`;
    case "r":
      return `${v > 0 && !compact ? "+" : ""}${v.toFixed(compact ? 1 : 2)}R`;
    default:
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
}

function ChartView({ block, currency }: { block: ChartBlock; currency: string }) {
  const unit = block.unit ?? "count";
  const cur = block.currency || currency;
  const signed = unit === "money" || unit === "r";
  const data = block.data.slice(0, 24);
  const tooltip = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) => {
    const d = payload?.[0]?.payload as { label: string; value: number } | undefined;
    if (!active || !d) return null;
    return <ChartTooltip title={d.label} rows={[{ label: block.title ?? "Value", value: fmt(d.value, unit, cur), tone: signed ? d.value : undefined }]} />;
  };
  return (
    <figure className="my-3 rounded-xl border bg-card p-3 shadow-soft sm:p-4">
      {block.title && <figcaption className="mb-2 text-sm font-medium">{block.title}</figcaption>}
      {block.type === "pie" ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="h-48 w-full sm:w-1/2">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="90%" paddingAngle={2} stroke="var(--card)">
                  {data.map((d, i) => (
                    <Cell key={d.label} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid w-full gap-1.5 text-sm sm:w-1/2">
            {(() => {
              const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
              return data.map((d, i) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="min-w-0 flex-1 truncate">{d.label}</span>
                  <span className="font-mono text-xs tabular text-muted-foreground">{Math.round((d.value / total) * 100)}%</span>
                  <span className="font-mono text-xs tabular">{fmt(d.value, unit, cur)}</span>
                </li>
              ));
            })()}
          </ul>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer>
            {block.type === "line" ? (
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                <YAxis width={56} tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, unit, cur, true)} />
                {signed && <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />}
                <Tooltip content={tooltip} />
                <Line dataKey="value" type="monotone" stroke="var(--brand)" strokeWidth={2} dot={data.length <= 12} animationDuration={600} />
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={data.length > 10 ? "preserveStartEnd" : 0} minTickGap={8} />
                <YAxis width={56} tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, unit, cur, true)} />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
                <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }} content={tooltip} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={600}>
                  {data.map((d, i) => (
                    <Cell
                      key={d.label}
                      fill={signed ? (d.value >= 0 ? "var(--chart-up)" : "var(--chart-down)") : PALETTE[i % PALETTE.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

/** Table cells may hold markdown links: [text](/trades/id). */
function CellText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
        if (!m) return p;
        const href = m[2];
        return href.startsWith("/") ? (
          <Link key={i} href={href} className="font-medium text-brand-ink underline-offset-2 hover:underline">
            {m[1]}
          </Link>
        ) : (
          <span key={i}>{m[1]}</span>
        );
      })}
    </>
  );
}

function TableView({ block }: { block: TableBlock }) {
  const money = new Set(block.money ?? []);
  return (
    <figure className="my-3 overflow-hidden rounded-xl border bg-card shadow-soft">
      {block.title && <figcaption className="border-b px-4 py-2.5 text-sm font-medium">{block.title}</figcaption>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {block.columns.map((c, i) => (
                <th key={i} className={cn("px-3 py-2 font-medium whitespace-nowrap", money.has(i) && "text-right")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, ri) => (
              <tr key={ri} className="border-t">
                {r.map((c, ci) => {
                  const sign = money.has(ci) ? cellSign(c) : 0;
                  return (
                    <td
                      key={ci}
                      className={cn(
                        "px-3 py-2 align-top",
                        money.has(ci) && "text-right font-mono tabular whitespace-nowrap",
                        sign > 0 && "text-profit",
                        sign < 0 && "text-loss",
                      )}
                    >
                      <CellText text={c} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

const CARD_TONE = {
  profit: "bg-profit-soft/60 text-profit",
  loss: "bg-loss-soft/60 text-loss",
  warning: "bg-warning/15 text-warning-ink",
  info: "bg-info-soft/60 text-info",
  neutral: "bg-card text-foreground",
} as const;

function CardsView({ block }: { block: CardsBlock }) {
  const n = block.items.length;
  return (
    <div className={cn("my-3 grid gap-2", n === 1 ? "grid-cols-1" : n === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4")}>
      {block.items.map((c, i) => {
        const tone = c.tone ?? "neutral";
        return (
          <div key={i} className={cn("rounded-xl border p-3 shadow-soft", CARD_TONE[tone], n === 3 && i === 0 && "col-span-2 sm:col-span-1")}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={cn("mt-1 text-lg font-semibold leading-tight", /\d/.test(c.value) && "font-mono tabular")}>{c.value}</p>
            {c.sub && <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

const CALLOUT = {
  tip: { icon: Lightbulb, cls: "border-brand/40 bg-brand-soft/50", ink: "text-brand-ink" },
  success: { icon: CheckCircle2, cls: "border-profit/40 bg-profit-soft/50", ink: "text-profit" },
  warning: { icon: AlertTriangle, cls: "border-warning/50 bg-warning/10", ink: "text-warning-ink" },
  danger: { icon: OctagonAlert, cls: "border-loss/40 bg-loss-soft/50", ink: "text-loss" },
  info: { icon: Info, cls: "border-info/40 bg-info-soft/50", ink: "text-info" },
} as const;

function CalloutView({ block }: { block: CalloutBlock }) {
  const s = CALLOUT[block.tone ?? "info"];
  const Icon = s.icon;
  return (
    <div className={cn("my-3 flex gap-3 rounded-xl border p-3.5", s.cls)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", s.ink)} aria-hidden />
      <div className="min-w-0">
        {block.title && <p className={cn("font-semibold", s.ink)}>{block.title}</p>}
        <p className="text-sm leading-relaxed whitespace-pre-line">
          <CellText text={block.text} />
        </p>
      </div>
    </div>
  );
}

const ACTION_ICON = { goal: Target, checklist: ListChecks, cooldown: Timer, news_window: BellOff, memory: Brain } as const;

/** Buttons that apply the coach's advice; nothing changes until the trader clicks. */
function ActionView({ block, lang }: { block: ActionBlock; lang: CoachLang }) {
  return (
    <div className="my-3 flex flex-wrap gap-2">
      {block.items.map((a, i) => (
        <ActionButton key={i} action={a} lang={lang} />
      ))}
    </div>
  );
}

function ActionButton({ action, lang }: { action: CoachAction; lang: CoachLang }) {
  const t = COACH_TEXT[lang];
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const Icon = ACTION_ICON[action.type];
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant={state?.ok ? "secondary" : "outline"}
        size="sm"
        disabled={pending || state?.ok}
        className={cn("h-auto min-h-9 justify-start py-1.5 text-left whitespace-normal", !state && "border-brand/50 hover:bg-brand-soft/50")}
        onClick={() =>
          start(async () => {
            const r = await runCoachAction(action);
            setState(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : state?.ok ? <Check className="text-profit" /> : <Icon className="text-brand-ink" />}
        <span>{action.label}</span>
        {state?.ok && <span className="text-xs text-muted-foreground">· {t.actionDone}</span>}
      </Button>
      {state && <p className={cn("text-xs", state.ok ? "text-muted-foreground" : "text-loss")}>{state.text}</p>}
    </div>
  );
}
