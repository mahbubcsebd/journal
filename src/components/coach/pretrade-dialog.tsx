"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Loader2, MessageSquare, OctagonAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatMoney } from "@/lib/utils";
import { preTradeCheckAction, type PreTradeResult } from "@/server/actions/coach";
import { CoachMarkdown } from "./coach-markdown";
import { COACH_TEXT, type CoachLang } from "./i18n";

export type PreTradeAccount = { id: string; name: string; currency: string; balance: number | null };

const LEVEL = {
  ok: { icon: CheckCircle2, ink: "text-profit", bg: "bg-profit-soft/60 border-profit/40" },
  caution: { icon: AlertTriangle, ink: "text-warning-ink", bg: "bg-warning/10 border-warning/50" },
  stop: { icon: OctagonAlert, ink: "text-loss", bg: "bg-loss-soft/60 border-loss/40" },
} as const;

/** Check a planned trade against the trader's rules, history and the news. */
export function PreTradeDialog({
  open,
  onOpenChange,
  accounts,
  symbols,
  lang,
  defaultAccountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: PreTradeAccount[];
  symbols: string[];
  lang: CoachLang;
  defaultAccountId?: string;
}) {
  const t = COACH_TEXT[lang].pt;
  const router = useRouter();
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [symbol, setSymbol] = useState(symbols[0] ?? "XAUUSD");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [form, setForm] = useState({ entry: "", sl: "", tp: "", lots: "0.01" });
  const [result, setResult] = useState<PreTradeResult | null>(null);
  const [pending, start] = useTransition();
  const account = accounts.find((a) => a.id === accountId);

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  function check() {
    start(async () => {
      setResult(
        await preTradeCheckAction({
          accountId,
          symbol,
          side,
          entry: num(form.entry) ?? 0,
          sl: num(form.sl),
          tp: num(form.tp),
          lots: num(form.lots) ?? 0,
          lang,
        }),
      );
    });
  }

  function discuss() {
    if (!result?.ok) return;
    const q =
      lang === "bn"
        ? `আমি ${symbol} ${side === "LONG" ? "বাই" : "সেল"} করতে চাই: এন্ট্রি ${form.entry}, SL ${form.sl || "নেই"}, TP ${form.tp || "নেই"}, লট ${form.lots}। চেকের ফল: ${result.checks.map((c) => `${c.title} (${c.level})`).join("; ")}। ট্রেডটা কি নেব? কী বদলাব?`
        : `I want to ${side === "LONG" ? "buy" : "sell"} ${symbol}: entry ${form.entry}, SL ${form.sl || "none"}, TP ${form.tp || "none"}, ${form.lots} lots. The pre-trade check said: ${result.checks.map((c) => `${c.title} (${c.level})`).join("; ")}. Should I take it, and what should I change?`;
    onOpenChange(false);
    router.push(`/coach?ask=${encodeURIComponent(q)}`);
  }

  const v = result?.ok ? LEVEL[result.verdict] : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-brand-ink" /> {t.title}
          </DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
        </DialogHeader>

        {result?.ok && v ? (
          <div className="grid gap-3">
            <div className={cn("flex items-start gap-3 rounded-xl border p-4", v.bg)}>
              <v.icon className={cn("mt-0.5 size-7 shrink-0", v.ink)} />
              <div>
                <p className={cn("text-lg font-semibold", v.ink)}>{t.verdict[result.verdict]}</p>
                <p className="text-sm text-muted-foreground">{t.verdictSub[result.verdict]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {symbol} · {side === "LONG" ? t.buy : t.sell} · {form.lots} · {result.account.name}
                  {result.account.balance != null && ` · ${t.balance} ${formatMoney(result.account.balance, result.account.currency)}`}
                </p>
              </div>
            </div>
            <ul className="grid gap-2">
              {result.checks.map((c) => {
                const s = LEVEL[c.level];
                return (
                  <li key={c.id} className="flex gap-2.5 rounded-lg border bg-card p-3">
                    <s.icon className={cn("mt-0.5 size-4 shrink-0", s.ink)} aria-label={c.level} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {result.ai && (
              <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-3">
                <p className="mb-1 text-xs font-medium text-brand-ink">{t.coach}</p>
                <div className="text-sm">
                  <CoachMarkdown text={result.ai} currency={result.account.currency} lang={lang} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setResult(null)}>
                {t.again}
              </Button>
              <Button variant="brand" onClick={discuss}>
                <MessageSquare /> {t.discuss}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
          >
            {accounts.length > 1 && (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t.account}</span>
                <Combobox
                  value={accountId}
                  onValueChange={setAccountId}
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: a.name,
                    hint: a.balance != null ? formatMoney(a.balance, a.currency) : a.currency,
                  }))}
                />
              </label>
            )}
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t.symbol}</span>
                <Combobox
                  value={symbol}
                  onValueChange={setSymbol}
                  allowCustom
                  format={(s) => s.toUpperCase().replace(/\s+/g, "")}
                  options={[...new Set([...symbols, "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30"])].map((s) => ({ value: s, label: s }))}
                />
              </label>
              <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Side">
                {(["LONG", "SHORT"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={side === s}
                    onClick={() => setSide(s)}
                    className={cn(
                      "flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors",
                      side === s ? (s === "LONG" ? "bg-profit text-white dark:text-background" : "bg-loss text-white dark:text-background") : "text-muted-foreground",
                    )}
                  >
                    {s === "LONG" ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                    {s === "LONG" ? t.buy : t.sell}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["entry", t.entry, true],
                  ["lots", t.lots, true],
                  ["sl", t.sl, false],
                  ["tp", t.tp, false],
                ] as const
              ).map(([k, label, required]) => (
                <label key={k} className="grid gap-1.5 text-sm">
                  <span className="font-medium">
                    {label} {!required && k === "tp" && <span className="font-normal text-muted-foreground">({t.optional})</span>}
                  </span>
                  <Input
                    inputMode="decimal"
                    required={required}
                    value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="font-mono tabular"
                    placeholder={k === "lots" ? "0.10" : "0.00"}
                  />
                </label>
              ))}
            </div>
            {account && account.balance != null && (
              <p className="text-xs text-muted-foreground">
                {t.balance}: <span className="font-mono tabular">{formatMoney(account.balance, account.currency)}</span>
              </p>
            )}
            {result && !result.ok && <p className="text-sm text-loss">{result.error}</p>}
            <Button type="submit" variant="brand" disabled={pending || !accountId}>
              {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {pending ? t.checking : t.check}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
