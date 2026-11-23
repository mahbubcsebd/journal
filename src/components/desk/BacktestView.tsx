'use client';

import { api, downloadFile, fmtTime } from '@/lib/desk/format';
import { useSettings, useT } from '@/lib/desk/settings';
import { TIMEFRAMES, type BacktestResult, type TF } from '@/lib/desk/types';
import { useState } from 'react';
import BacktestReport from './BacktestReport';
import ReactionReportPanel from './ReactionReportPanel';
import { buttonClass, primaryClass, Segmented } from './ui';

function defaultSpread(symbol: string): number {
  if (symbol.includes('XAU')) return 0.3;
  if (symbol.includes('XAG')) return 0.03;
  if (symbol.includes('JPY')) return 0.02;
  return 0.00015;
}

function csvCell(v: string | number): string {
  const s =
    typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function exportBacktestCsv(result: BacktestResult, localTime: boolean) {
  const header = [
    'Signal Time',
    'Entry Time',
    'Exit Time',
    'Side',
    'Grade',
    'Entry',
    'Stop',
    'Target',
    'RR',
    'Exit',
    'Result (R)',
    'Checks Passed',
  ];
  const rows = result.trades.map((tr) => [
    fmtTime(tr.signalTime, localTime),
    fmtTime(tr.entryTime, localTime),
    fmtTime(tr.exitTime, localTime),
    tr.dir === 'bull' ? 'Buy' : 'Sell',
    tr.grade,
    tr.entry.toFixed(result.digits),
    tr.stop.toFixed(result.digits),
    tr.target.toFixed(result.digits),
    tr.rr.toFixed(2),
    (tr.exitReason ?? '').toUpperCase(),
    tr.resultR.toFixed(4),
    (tr.checks ?? [])
      .filter((c) => c.ok)
      .map((c) => c.key)
      .join(';'),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
  downloadFile(
    `backtest-${result.symbol}-${result.tf}.csv`,
    csv,
    'text/csv;charset=utf-8',
  );
}

function BacktestPanel({
  symbol,
  initialTf,
  localTime,
}: {
  symbol: string;
  initialTf: TF;
  localTime: boolean;
}) {
  const t = useT();
  const [tf, setTf] = useState<TF>(initialTf);
  const [spread, setSpread] = useState<string>(() =>
    String(defaultSpread(symbol)),
  );
  const [commissionR, setCommissionR] = useState<string>('0.05');
  const [partialTp, setPartialTp] = useState<boolean>(true);
  const [breakEven, setBreakEven] = useState<boolean>(true);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const sp = Math.max(0, Number(spread) || 0);
      const cm = Math.max(0, Number(commissionR) || 0);
      const params = new URLSearchParams({
        symbol,
        tf,
        spread: String(sp),
        commissionR: String(cm),
        partialTp: String(partialTp),
        breakEven: String(breakEven),
      });
      const r = await api<BacktestResult>(`/api/backtest?${params.toString()}`);
      setResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[960px]">
      <h1 className="text-[28px] font-semibold tracking-tight">
        {t('bt.title')}
      </h1>
      <p className="mt-1 max-w-[62ch] text-mute">{t('bt.lede')}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="font-semibold">{symbol}</span>
        <Segmented
          label={t('label.timeframe')}
          value={tf}
          onChange={(v: TF) => setTf(v)}
          options={TIMEFRAMES.map((x) => ({ value: x, label: x }))}
        />
        <button
          type="button"
          className={primaryClass}
          onClick={run}
          disabled={busy}
        >
          {busy ? t('bt.running') : t('bt.run')}
        </button>
        {result && result.trades.length > 0 && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => exportBacktestCsv(result, localTime)}
          >
            {t('bt.exportCsv')}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-hull px-3 py-2.5 text-[13px]">
        <label className="flex items-center gap-2 text-mute">
          <span>{t('bt.spread')}</span>
          <input
            type="number"
            min="0"
            step="any"
            value={spread}
            onChange={(e) => setSpread(e.target.value)}
            className="w-20 rounded border border-line bg-water px-2 py-1 text-ink tabular-nums"
          />
        </label>
        <label className="flex items-center gap-2 text-mute">
          <span>{t('bt.commission')}</span>
          <input
            type="number"
            min="0"
            max="2"
            step="0.01"
            value={commissionR}
            onChange={(e) => setCommissionR(e.target.value)}
            className="w-20 rounded border border-line bg-water px-2 py-1 text-ink tabular-nums"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input
            type="checkbox"
            checked={partialTp}
            onChange={(e) => setPartialTp(e.target.checked)}
            className="accent-gold"
          />
          <span>{t('bt.partialTp')}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input
            type="checkbox"
            checked={breakEven}
            onChange={(e) => setBreakEven(e.target.checked)}
            className="accent-gold"
          />
          <span>{t('bt.breakEven')}</span>
        </label>
      </div>

      {error && <p className="mt-4 text-coral">{error}</p>}

      {result && (
        <>
          <p className="mt-6 text-[13px] text-mute">
            {t('bt.period', {
              symbol: result.symbol,
              tf: result.tf,
              n: result.candles,
              from: fmtTime(result.from, localTime),
              to: fmtTime(result.to, localTime),
            })}
          </p>
          <BacktestReport result={result} localTime={localTime} />
        </>
      )}

      <ReactionReportPanel symbol={symbol} tf={tf} localTime={localTime} />

      <h2 className="mb-2 mt-8 text-[13px] font-semibold text-mute">
        {t('bt.howTitle')}
      </h2>
      <p className="max-w-[66ch] text-[14px] text-mute">{t('bt.how')}</p>
    </div>
  );
}

export default function BacktestView() {
  const { s } = useSettings();
  return (
    <div className="brief-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
      <BacktestPanel
        key={s.symbol}
        symbol={s.symbol}
        initialTf={s.tf}
        localTime={s.localTime}
      />
    </div>
  );
}
