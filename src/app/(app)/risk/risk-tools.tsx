"use client";

import { motion } from "motion/react";
import { Calculator, Scale, ShieldAlert, Sigma, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { defaultContractSize, losingStreakProbability, pipValuePerLot, positionSize, quoteCurrency, recoveryNeeded, riskReward } from "@/lib/risk";
import { pipSize } from "@/lib/trading/symbols";
import { cn, formatMoney } from "@/lib/utils";

type Account = { id: string; label: string; balance: number | null; currency: string };

const SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "GBPJPY", "EURJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "EURGBP", "XAGUSD", "BTCUSD", "ETHUSD", "US30", "USTEC", "US500", "USOIL"];

const num = (s: string) => (s.trim() === "" ? null : Number(s));

// Currencies normally quoted as USDxxx (so we ask for that price and invert it).
const USD_BASE = ["JPY", "CHF", "CAD", "SGD", "HKD", "MXN", "ZAR", "NOK", "SEK", "TRY", "PLN", "CNH"];

function Tool({ icon: Icon, title, hint, children, className }: { icon: typeof Calculator; title: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[13px] text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function Result({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <motion.p
        key={value}
        initial={{ opacity: 0.4, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("font-mono font-semibold tabular", big ? "text-2xl" : "text-base", tone === "good" && "text-profit", tone === "bad" && "text-loss")}
      >
        {value}
      </motion.p>
    </div>
  );
}

function SymbolInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} list="risk-symbols" className="uppercase" />
      <datalist id="risk-symbols">
        {SYMBOLS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

export function RiskTools({ accounts, winRate, tradesSample }: { accounts: Account[]; winRate: number | null; tradesSample: number }) {
  return (
    <div className="grid gap-6">
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <PositionSize accounts={accounts} />
        <RiskReward />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <PipValue />
        <Recovery />
        <Streaks winRate={winRate} sample={tradesSample} />
      </div>
    </div>
  );
}

/* ───────────────────────── Position size ───────────────────────── */

function PositionSize({ accounts }: { accounts: Account[] }) {
  const first = accounts.find((a) => a.balance != null);
  const [accountId, setAccountId] = useState(first?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const [balance, setBalance] = useState(first?.balance != null ? String(first.balance) : "1000");
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [risk, setRisk] = useState("1");
  const [symbol, setSymbol] = useState("XAUUSD");
  const [stopMode, setStopMode] = useState<"pips" | "price">("pips");
  const [stopPips, setStopPips] = useState("30");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [contract, setContract] = useState("");
  const [rate, setRate] = useState("");
  const currency = account?.currency ?? "USD";
  const cent = currency === "USC";

  const quote = quoteCurrency(symbol);
  const needsRate = quote !== "USD" && !symbol.startsWith("USD");
  const pip = pipSize(symbol || "EURUSD");
  const pipsFromPrice = num(entry) != null && num(sl) != null ? Math.abs(num(entry)! - num(sl)!) / pip : null;
  const stop = stopMode === "pips" ? num(stopPips) : pipsFromPrice;
  const pv = pipValuePerLot({
    symbol: symbol || "EURUSD",
    price: num(entry) ?? undefined,
    quoteToUsd: num(rate) ? (USD_BASE.includes(quote) ? 1 / num(rate)! : num(rate)!) : undefined,
    contractSize: num(contract) ?? undefined,
  });
  const bal = num(balance) ?? 0;
  const riskAmount = mode === "percent" ? (bal * (num(risk) ?? 0)) / 100 : (num(risk) ?? 0);
  const result = pv && stop ? positionSize({ riskAmount, stopPips: stop, pipValue: pv }) : null;
  const missing = !pv
    ? symbol.startsWith("USD")
      ? "Enter the entry price to value pips on a USD-based pair."
      : `Enter the ${USD_BASE.includes(quote) ? `USD${quote}` : `${quote}USD`} price to value pips on this pair.`
    : !stop
      ? "Enter the stop distance."
      : null;

  return (
    <Tool icon={Calculator} title="Position size" hint="How many lots to trade so a stop-out costs exactly what you planned.">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account" htmlFor="ps-account" hint={cent ? "Cent account: amounts in USC, result in cent lots." : undefined}>
            <Select
              id="ps-account"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                const a = accounts.find((x) => x.id === e.target.value);
                if (a?.balance != null) setBalance(String(a.balance));
              }}
            >
              <option value="">Manual</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Balance (${currency})`} htmlFor="ps-balance">
            <Input id="ps-balance" type="number" min="0" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Risk per trade" htmlFor="ps-risk">
            <div className="flex gap-2">
              <Input id="ps-risk" type="number" min="0" step={mode === "percent" ? "0.1" : "1"} value={risk} onChange={(e) => setRisk(e.target.value)} />
              <div className="inline-flex shrink-0 rounded-lg border bg-card p-0.5">
                {(["percent", "amount"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-md px-2.5 text-[13px] font-medium", mode === m ? "bg-secondary" : "text-muted-foreground")}>
                    {m === "percent" ? "%" : currency === "USC" ? "¢" : "$"}
                  </button>
                ))}
              </div>
            </div>
          </Field>
          <Field label="Symbol" htmlFor="ps-symbol">
            <SymbolInput id="ps-symbol" value={symbol} onChange={setSymbol} />
          </Field>
        </div>
        <div className="grid gap-2">
          <div className="inline-flex w-fit rounded-lg border bg-card p-0.5">
            {(["pips", "price"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setStopMode(m)} className={cn("rounded-md px-3 py-1 text-[13px] font-medium", stopMode === m ? "bg-secondary" : "text-muted-foreground")}>
                Stop in {m}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {stopMode === "pips" ? (
              <Field label="Stop loss (pips)" htmlFor="ps-pips" hint={`1 pip on ${symbol || "this symbol"} = ${pip}`}>
                <Input id="ps-pips" type="number" min="0" step="0.1" value={stopPips} onChange={(e) => setStopPips(e.target.value)} />
              </Field>
            ) : (
              <Field label="Stop loss price" htmlFor="ps-sl" hint={pipsFromPrice != null ? `${pipsFromPrice.toFixed(1)} pips` : undefined}>
                <Input id="ps-sl" type="number" step="any" value={sl} onChange={(e) => setSl(e.target.value)} />
              </Field>
            )}
            <Field label="Entry price" htmlFor="ps-entry" hint={stopMode === "pips" && !symbol.startsWith("USD") ? "Optional for this symbol" : undefined}>
              <Input id="ps-entry" type="number" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} />
            </Field>
          </div>
        </div>
        <details className="group text-sm">
          <summary className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">Advanced: contract size</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Contract size (units per lot)" htmlFor="ps-contract" hint={`Default ${defaultContractSize(symbol || "EURUSD").toLocaleString()} — check MT5 symbol specification`}>
              <Input id="ps-contract" type="number" min="0" value={contract} placeholder={String(defaultContractSize(symbol || "EURUSD"))} onChange={(e) => setContract(e.target.value)} />
            </Field>
          </div>
        </details>
        {needsRate && (
          <Field
            label={`${USD_BASE.includes(quote) ? `USD${quote}` : `${quote}USD`} price`}
            htmlFor="ps-rate"
            hint={`Needed to value pips on ${symbol} (quoted in ${quote})`}
          >
            <Input id="ps-rate" type="number" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
        )}

        <div className="grid gap-3 border-t pt-4 sm:grid-cols-3">
          <Result label={cent ? "Position size (cent lots)" : "Position size"} value={result ? `${result.lots.toFixed(2)} lots` : "—"} big />
          <Result label="Money at risk" value={result ? formatMoney(result.actualRisk, currency) : formatMoney(riskAmount, currency)} />
          <Result label="Pip value per lot" value={pv ? formatMoney(pv, currency) : "—"} />
        </div>
        {missing && <p className="text-xs text-muted-foreground">{missing}</p>}
        {result && result.lots === 0 && <p className="text-xs text-loss">Risk is too small for even 0.01 lots with this stop. Widen the risk or tighten the stop.</p>}
        {mode === "percent" && (num(risk) ?? 0) > 2 && <p className="text-xs text-warning">Risking more than 2% per trade makes long losing streaks very costly — see the tables below.</p>}
      </div>
    </Tool>
  );
}

/* ───────────────────────── Risk : reward ───────────────────────── */

function RiskReward() {
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [symbol, setSymbol] = useState("XAUUSD");
  const [entry, setEntry] = useState("2650");
  const [sl, setSl] = useState("2645");
  const [tp, setTp] = useState("2665");
  const r = num(entry) != null && num(sl) != null ? riskReward({ side, entry: num(entry)!, sl: num(sl)!, tp: num(tp), symbol: symbol || "EURUSD" }) : null;
  const ok = r && !("error" in r);
  const rr = ok ? r.rr : null;

  return (
    <Tool icon={Scale} title="Risk : reward" hint="Is this trade worth it? And what win rate does it need?">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium">Direction</span>
            <div className="inline-flex h-10 rounded-lg border bg-card p-0.5">
              {(["LONG", "SHORT"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={cn("flex-1 rounded-md text-sm font-medium", side === s ? (s === "LONG" ? "bg-profit-soft text-profit" : "bg-loss-soft text-loss") : "text-muted-foreground")}
                >
                  {s === "LONG" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>
          </div>
          <Field label="Symbol" htmlFor="rr-symbol">
            <SymbolInput id="rr-symbol" value={symbol} onChange={setSymbol} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Entry" htmlFor="rr-entry">
            <Input id="rr-entry" type="number" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} />
          </Field>
          <Field label="Stop loss" htmlFor="rr-sl">
            <Input id="rr-sl" type="number" step="any" value={sl} onChange={(e) => setSl(e.target.value)} />
          </Field>
          <Field label="Take profit" htmlFor="rr-tp">
            <Input id="rr-tp" type="number" step="any" value={tp} onChange={(e) => setTp(e.target.value)} />
          </Field>
        </div>
        {r && "error" in r ? (
          <p className="rounded-lg bg-loss-soft px-3 py-2 text-sm text-loss">{r.error}</p>
        ) : ok ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Result label="Risk : reward" value={rr == null ? "—" : `1 : ${rr.toFixed(2)}`} big tone={rr != null ? (rr >= 1.5 ? "good" : rr < 1 ? "bad" : undefined) : undefined} />
              <Result label="Break-even win rate" value={r.breakevenWinRate == null ? "—" : `${(r.breakevenWinRate * 100).toFixed(1)}%`} big />
              <Result label="Stop distance" value={`${r.slPips} pips`} />
              <Result label="Target distance" value={r.tpPips == null ? "—" : `${r.tpPips} pips`} />
            </div>
            {rr != null && (
              <div className="grid gap-1.5">
                <div className="flex h-3 overflow-hidden rounded-full">
                  <motion.div className="bg-chart-down" animate={{ width: `${(1 / (1 + rr)) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
                  <motion.div className="flex-1 bg-chart-up" />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Risk 1R</span>
                  <span>Reward {rr.toFixed(2)}R</span>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Tool>
  );
}

/* ───────────────────────── Pip value ───────────────────────── */

function PipValue() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [lots, setLots] = useState("0.10");
  const [price, setPrice] = useState("");
  const [pips, setPips] = useState("20");
  const pv = pipValuePerLot({ symbol: symbol || "EURUSD", price: num(price) ?? undefined });
  const perPip = pv != null ? pv * (num(lots) ?? 0) : null;
  return (
    <Tool icon={Sigma} title="Pip value" hint="What one pip is worth at your size.">
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Symbol" htmlFor="pv-symbol">
            <SymbolInput id="pv-symbol" value={symbol} onChange={setSymbol} />
          </Field>
          <Field label="Lots" htmlFor="pv-lots">
            <Input id="pv-lots" type="number" step="0.01" min="0" value={lots} onChange={(e) => setLots(e.target.value)} />
          </Field>
        </div>
        {symbol.startsWith("USD") && quoteCurrency(symbol) !== "USD" && (
          <Field label="Current price" htmlFor="pv-price">
            <Input id="pv-price" type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        )}
        <Field label="Move (pips)" htmlFor="pv-pips">
          <Input id="pv-pips" type="number" step="0.1" value={pips} onChange={(e) => setPips(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Result label="Per pip" value={perPip == null ? "—" : formatMoney(perPip, "USD")} />
          <Result label={`${pips || 0} pips`} value={perPip == null ? "—" : formatMoney(perPip * (num(pips) ?? 0), "USD")} />
        </div>
        {pv == null && <p className="text-xs text-muted-foreground">Cross pairs need a conversion rate — use the position size tool.</p>}
      </div>
    </Tool>
  );
}

/* ───────────────────────── Drawdown recovery ───────────────────────── */

function Recovery() {
  const rows = [5, 10, 20, 30, 40, 50, 60];
  return (
    <Tool icon={TrendingDown} title="Drawdown recovery" hint="Losses hurt more than gains help.">
      <ul className="grid gap-2.5">
        {rows.map((l) => {
          const g = recoveryNeeded(l / 100) * 100;
          return (
            <li key={l} className="grid grid-cols-[64px_1fr_64px] items-center gap-3 text-sm">
              <span className="font-mono text-loss tabular">−{l}%</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full bg-chart-up" initial={{ width: 0 }} animate={{ width: `${Math.min(100, g / 1.5)}%` }} transition={{ duration: 0.8, delay: l / 400 }} />
              </div>
              <span className="text-right font-mono font-semibold text-profit tabular">+{g.toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Gain needed to get back to break-even after each drawdown.</p>
    </Tool>
  );
}

/* ───────────────────────── Losing streaks ───────────────────────── */

function Streaks({ winRate, sample }: { winRate: number | null; sample: number }) {
  const [wr, setWr] = useState(winRate != null ? String(Math.round(winRate * 100)) : "50");
  const [trades, setTrades] = useState("100");
  const [riskPct, setRiskPct] = useState("1");
  const rows = useMemo(() => {
    const p = Math.min(0.99, Math.max(0.01, (num(wr) ?? 50) / 100));
    const n = Math.min(2000, Math.max(1, Math.round(num(trades) ?? 100)));
    return [3, 4, 5, 6, 7, 8, 10].map((k) => ({ k, prob: losingStreakProbability(p, k, n) }));
  }, [wr, trades]);
  const r = (num(riskPct) ?? 1) / 100;

  return (
    <Tool icon={ShieldAlert} title="Losing streaks" hint="How likely a bad run is — and what it would cost.">
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Win rate %" htmlFor="ls-wr">
            <Input id="ls-wr" type="number" min="1" max="99" value={wr} onChange={(e) => setWr(e.target.value)} />
          </Field>
          <Field label="Trades" htmlFor="ls-n">
            <Input id="ls-n" type="number" min="1" value={trades} onChange={(e) => setTrades(e.target.value)} />
          </Field>
          <Field label="Risk %" htmlFor="ls-r">
            <Input id="ls-r" type="number" min="0" step="0.1" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} />
          </Field>
        </div>
        {winRate != null && sample >= 20 && <p className="text-[11px] text-muted-foreground">Win rate pre-filled from your last 90 days ({sample} trades).</p>}
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Losses in a row</th>
              <th className="py-1 text-right font-medium">Chance</th>
              <th className="py-1 text-right font-medium">Drawdown</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ k, prob }) => (
              <tr key={k} className="border-t">
                <td className="py-1.5 tabular">{k}</td>
                <td className={cn("py-1.5 text-right font-mono tabular", prob > 0.5 && "font-semibold")}>{prob >= 0.995 ? ">99%" : `${(prob * 100).toFixed(prob < 0.1 ? 1 : 0)}%`}</td>
                <td className="py-1.5 text-right font-mono text-loss tabular">−{((1 - (1 - r) ** k) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tool>
  );
}
