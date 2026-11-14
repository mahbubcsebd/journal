"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createManualTrade, type ManualTradeState } from "@/server/actions/trades";

const SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "GBPJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "BTCUSD", "ETHUSD", "US30", "USTEC", "US500", "USOIL"];

export function ManualTradeForm({
  accounts,
  timezone,
}: {
  accounts: { id: string; label: string; currency: string }[];
  timezone: string;
}) {
  const [state, action, pending] = useActionState<ManualTradeState, FormData>(createManualTrade, {});
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [closed, setClosed] = useState(true);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  if (accounts.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Add a trading account first.{" "}
        <Link href="/accounts" className="font-medium text-brand-ink hover:underline">
          Go to accounts
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form action={action} className="grid gap-5">
        <input type="hidden" name="side" value={side} />
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Account" htmlFor="accountId" error={err("accountId")}>
            <Select id="accountId" name="accountId">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Symbol" htmlFor="symbol" error={err("symbol")}>
            <Input id="symbol" name="symbol" list="symbols" placeholder="XAUUSD" required className="uppercase" />
            <datalist id="symbols">
              {SYMBOLS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium">Direction</span>
            <div className="inline-flex h-10 rounded-lg border bg-card p-0.5">
              {(["LONG", "SHORT"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={cn(
                    "rounded-md px-4 text-sm font-medium transition",
                    side === s
                      ? s === "LONG"
                        ? "bg-profit-soft text-profit"
                        : "bg-loss-soft text-loss"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "LONG" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Lot size" htmlFor="volume" error={err("volume")}>
            <Input id="volume" name="volume" type="number" step="0.01" min="0" placeholder="0.10" required />
          </Field>
          <Field label="Stop loss" htmlFor="sl" error={err("sl")}>
            <Input id="sl" name="sl" type="number" step="any" placeholder="Optional" />
          </Field>
          <Field label="Take profit" htmlFor="tp" error={err("tp")}>
            <Input id="tp" name="tp" type="number" step="any" placeholder="Optional" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Entry time (${timezone})`} htmlFor="openTime" error={err("openTime")}>
            <Input id="openTime" name="openTime" type="datetime-local" required />
          </Field>
          <Field label="Entry price" htmlFor="openPrice" error={err("openPrice")}>
            <Input id="openPrice" name="openPrice" type="number" step="any" required />
          </Field>
        </div>

        <label className="flex w-fit items-center gap-2 text-sm">
          <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} className="size-4 accent-[var(--brand)]" />
          Trade is closed
        </label>

        {closed && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Exit time (${timezone})`} htmlFor="closeTime" error={err("closeTime")}>
                <Input id="closeTime" name="closeTime" type="datetime-local" required />
              </Field>
              <Field label="Exit price" htmlFor="closePrice" error={err("closePrice")}>
                <Input id="closePrice" name="closePrice" type="number" step="any" required />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Profit / loss (before costs)" htmlFor="profit" error={err("profit")} hint="Negative for a loss">
                <Input id="profit" name="profit" type="number" step="0.01" placeholder="-25.00" required />
              </Field>
              <Field label="Commission" htmlFor="commission" error={err("commission")}>
                <Input id="commission" name="commission" type="number" step="0.01" placeholder="0.00" />
              </Field>
              <Field label="Swap" htmlFor="swap" error={err("swap")}>
                <Input id="swap" name="swap" type="number" step="0.01" placeholder="0.00" />
              </Field>
            </div>
          </>
        )}

        <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="isBacktest" className="size-4 accent-[var(--brand)]" />
          This is a backtest (kept out of your stats and calendar)
        </label>

        {state.error && <p className="text-sm text-loss">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save trade
          </Button>
          <Button asChild variant="ghost">
            <Link href="/trades">Cancel</Link>
          </Button>
        </div>
      </form>
    </Card>
  );
}
