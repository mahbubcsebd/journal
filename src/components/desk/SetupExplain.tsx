"use client";

import { useState } from "react";
import { apiBase, apiHeaders } from "@/lib/desk/format";
import { useSettings, useT } from "@/lib/desk/settings";
import type { ExplainResponse, TF } from "@/lib/desk/types";

interface Props {
  symbol: string;
  tf: TF;
  until?: number;
}

export default function SetupExplain({ symbol, tf, until }: Props) {
  const t = useT();
  const { s: settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestExplain() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const payload = until !== undefined ? { symbol, tf, lang: settings.lang, until } : { symbol, tf, lang: settings.lang };
      const res = await fetch(`${apiBase()}/api/explain`, {
        method: "POST",
        headers: apiHeaders(true),
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ExplainResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? t("explain.error"));
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("explain.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={requestExplain}
          disabled={loading}
          className="cursor-pointer rounded-md border border-line bg-deck px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-ink/40 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? t("explain.loading") : data?.configured ? t("explain.refresh") : t("explain.button")}
        </button>
        {data?.model && <span className="text-[11px] text-mute">{data.model}</span>}
      </div>

      {error && <p className="mt-2.5 text-[13px] text-coral">{error}</p>}

      {data && !data.configured && (
        <p className="mt-2.5 rounded-md border border-line bg-deck px-3 py-2 text-[13px] text-mute">{t("explain.unconfigured")}</p>
      )}

      {data?.configured && data.text && (
        <div className="mt-2.5 rounded-md border border-line bg-deck px-3 py-2.5 text-[13px]">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gold">{t("explain.title")}</p>
          <p className="whitespace-pre-line leading-relaxed text-ink">{data.text}</p>
        </div>
      )}
    </div>
  );
}

