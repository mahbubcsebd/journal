"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { cn, formatMoney } from "@/lib/utils";
import { commitImport, previewImport, type ImportPreview, type ImportResult } from "@/server/actions/import";

type Account = { id: string; nickname: string; login: string; color: string; currency: string };

const FORMAT_LABEL: Record<ImportPreview["format"], string> = {
  MT5_REPORT: "MT5 history report",
  EXNESS_CSV: "Exness Personal Area export",
  CSV: "CSV file",
};

export function ImportWizard({ accounts }: { accounts: Account[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("auto");
  const [offset, setOffset] = useState("0");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const form = (f: File, acc = accountId) => {
    const fd = new FormData();
    fd.set("file", f);
    fd.set("accountId", acc);
    fd.set("offset", offset);
    return fd;
  };

  const choose = (f: File | undefined, acc = accountId) => {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    start(async () => {
      const res = await previewImport(form(f, acc));
      if (res.ok) {
        setPreview(res);
        // CSVs carry no account number: default to the only account if there is one.
        if (!res.detected && acc === "auto" && accounts.length === 1) setAccountId(accounts[0].id);
      } else setError(res.error);
    });
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const needsAccount = preview && !preview.detected && accountId === "auto";
  const target =
    accountId !== "auto" ? accounts.find((a) => a.id === accountId) : accounts.find((a) => a.id === preview?.matchedAccountId);
  const currency = target?.currency ?? preview?.detected?.currency ?? "USD";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-6">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Card className="flex flex-col items-center gap-4 p-10 text-center">
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="flex size-14 items-center justify-center rounded-2xl bg-profit-soft text-profit"
                >
                  <CheckCircle2 className="size-7" />
                </motion.span>
                <div className="grid gap-1">
                  <h2 className="text-lg font-semibold tracking-tight">Import complete</h2>
                  <p className="text-sm text-muted-foreground">
                    {result.inserted} new trades, {result.updated} updated
                    {result.skipped ? `, ${result.skipped} duplicates skipped` : ""}
                    {result.transactions ? `, ${result.transactions} deposits/withdrawals` : ""}.
                    {result.createdAccount && " A new account was created from the report."}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href="/trades">
                      View trades <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                  <Button variant="ghost" onClick={reset}>
                    <RotateCcw /> Import another
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-6">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  choose(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed bg-card px-6 py-12 text-center transition",
                  dragging ? "border-brand bg-brand-soft/40" : "hover:border-foreground/25",
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".html,.htm,.xlsx,.csv"
                  className="sr-only"
                  onChange={(e) => choose(e.target.files?.[0])}
                />
                <motion.span
                  animate={{ y: dragging ? -4 : 0 }}
                  className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink"
                >
                  {pending ? <Loader2 className="size-6 animate-spin" /> : <UploadCloud className="size-6" />}
                </motion.span>
                {file ? (
                  <div className="grid gap-0.5">
                    <p className="flex items-center justify-center gap-2 font-medium">
                      <FileSpreadsheet className="size-4 text-muted-foreground" /> {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB · {pending ? "Reading…" : "Click to choose a different file"}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-1">
                    <p className="font-medium">Drop your report here, or click to browse</p>
                    <p className="text-sm text-muted-foreground">MT5 report (.html, .xlsx) or CSV · up to 8 MB</p>
                  </div>
                )}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account" htmlFor="account" hint="MT5 reports name their account, so it's matched automatically.">
                  <Select
                    id="account"
                    value={accountId}
                    onChange={(e) => {
                      setAccountId(e.target.value);
                      if (file) choose(file, e.target.value);
                    }}
                  >
                    <option value="auto">Detect from file</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nickname} · #{a.login}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Report time zone" htmlFor="offset" hint="Exness server time is UTC+0. Exness CSV exports are always UTC.">
                  <Select id="offset" value={offset} onChange={(e) => setOffset(e.target.value)}>
                    {[-5, -4, 0, 1, 2, 3, 5.5, 6].map((h) => (
                      <option key={h} value={h}>
                        UTC{h >= 0 ? "+" : ""}
                        {h}
                        {h === 0 ? " (Exness)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
                </motion.div>
              )}

              {preview && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold">Preview</p>
                        <p className="text-[13px] text-muted-foreground">
                          {FORMAT_LABEL[preview.format]}
                          {preview.detected &&
                            ` · Account #${preview.detected.login} (${preview.detected.currency}${preview.detected.server ? `, ${preview.detected.server}` : ""})`}
                        </p>
                      </div>
                      {preview.detected && accountId === "auto" && (
                        <Badge variant={preview.matchedAccountId ? "profit" : "brand"}>
                          {preview.matchedAccountId
                            ? `Matched: ${accounts.find((a) => a.id === preview.matchedAccountId)?.nickname}`
                            : "New account will be created"}
                        </Badge>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                      {[
                        ["Trades", preview.trades.toString()],
                        ["New", preview.newTrades.toString()],
                        ["Already imported", preview.existingTrades.toString()],
                        ["Still open", preview.openTrades.toString()],
                        ["Net P&L", formatMoney(preview.netPnl, currency, { sign: true })],
                        ["Wins / losses", `${preview.wins} / ${preview.losses}`],
                        ["Deposits", formatMoney(preview.deposits, currency)],
                        ["Withdrawals", formatMoney(preview.withdrawals, currency)],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-card px-5 py-4">
                          <dt className="text-xs text-muted-foreground">{k}</dt>
                          <dd
                            className={cn(
                              "mt-1 font-mono text-lg font-semibold tabular",
                              k === "Net P&L" && (preview.netPnl >= 0 ? "text-profit" : "text-loss"),
                            )}
                          >
                            {v}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="grid gap-3 border-t px-5 py-4">
                      {preview.from && (
                        <p className="text-[13px] text-muted-foreground">
                          {new Date(preview.from).toLocaleDateString()} → {new Date(preview.to!).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {preview.symbols.map((s) => (
                          <Badge key={s.symbol} variant="outline">
                            {s.symbol} · {s.count}
                          </Badge>
                        ))}
                      </div>
                      {preview.warnings.map((w) => (
                        <p key={w} className="flex items-center gap-2 text-[13px] text-warning-ink">
                          <AlertTriangle className="size-3.5" /> {w}
                        </p>
                      ))}
                      {needsAccount && (
                        <p className="text-[13px] text-loss">This file has no account number — pick the account above.</p>
                      )}
                      <Button
                        className="mt-1 w-fit"
                        disabled={pending || preview.trades === 0 || Boolean(needsAccount)}
                        onClick={() =>
                          file &&
                          start(async () => {
                            const res = await commitImport(form(file));
                            if (res.ok) setResult(res);
                            else setError(res.error);
                          })
                        }
                      >
                        {pending && <Loader2 className="animate-spin" />}
                        Import {preview.newTrades + preview.existingTrades} trades
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Card className="h-fit p-5">
        <h3 className="text-sm font-semibold">How to export from MT5</h3>
        <ol className="mt-3 grid gap-3 text-[13px] text-muted-foreground">
          {[
            "Open MT5 (desktop) and log in to the account.",
            "Open the Toolbox (Ctrl+T) → History tab.",
            "Right-click → choose a period such as All History.",
            "Right-click again → Report → HTML or Open XML (xlsx).",
            "Drop the saved file here. Repeat for each sub-account.",
          ].map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <div className="mt-5 grid gap-2 border-t pt-4 text-[13px] text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Exness Personal Area:</span> Trading history → Download CSV also
            works.
          </p>
          <p>Re-importing is safe: trades already in your journal are updated, never duplicated.</p>
          <a
            href="/templates/journal-trades-template.csv"
            download
            className="mt-1 inline-flex items-center gap-1.5 font-medium text-brand-ink hover:underline"
          >
            <Download className="size-3.5" /> CSV template
          </a>
        </div>
      </Card>
    </div>
  );
}
