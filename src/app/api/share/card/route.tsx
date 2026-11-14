import { ImageResponse } from "next/og";
import { performance } from "@/lib/analytics";
import { getCurrentUser, getSelectedAccountIds } from "@/lib/session";
import { formatMoney, formatPercent } from "@/lib/utils";
import { loadReport } from "@/server/queries/reports";

// Satori only understands hex/rgb colours, so these mirror the dark theme tokens.
const C = {
  bg: "#090a0d",
  card: "#101215",
  border: "#1f2228",
  text: "#f2f3f5",
  muted: "#9598a0",
  brand: "#24c187",
  profit: "#56c9a2",
  loss: "#f6825f",
  up: "#007454",
  down: "#e56a3c",
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const hide = url.searchParams.get("hide") === "1";
  const { ids } = await getSelectedAccountIds(user.id);
  const { resolved, currency, trades } = await loadReport(user, ids, Object.fromEntries(url.searchParams));
  const p = performance(trades);

  const byDay = new Map<string, number>();
  for (const t of trades) byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.net);
  const bars = [...byDay].sort(([a], [b]) => a.localeCompare(b)).slice(-40);
  const maxAbs = Math.max(1, ...bars.map(([, v]) => Math.abs(v)));

  const headline = hide
    ? p.winRate == null
      ? "—"
      : formatPercent(p.winRate, 0)
    : formatMoney(p.net, currency, { sign: true });
  const headlineLabel = hide ? "Win rate" : "Net P&L";
  const tone = hide ? C.text : p.net >= 0 ? C.profit : C.loss;

  const stats = hide
    ? [
        ["Trades", String(p.trades)],
        ["Profit factor", p.profitFactor == null ? "—" : p.profitFactor.toFixed(2)],
        ["Average R", p.avgR == null ? "—" : `${p.avgR.toFixed(2)}R`],
        ["Green days", `${[...byDay.values()].filter((v) => v > 0).length}/${byDay.size}`],
      ]
    : [
        ["Trades", String(p.trades)],
        ["Win rate", p.winRate == null ? "—" : formatPercent(p.winRate, 0)],
        ["Profit factor", p.profitFactor == null ? "—" : p.profitFactor.toFixed(2)],
        ["Best trade", p.largestWin == null ? "—" : formatMoney(p.largestWin, currency, { sign: true })],
      ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.text, padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 16.5 9 11l3.5 3.5L20 7" />
                <path d="M15 7h5v5" />
              </svg>
            </div>
            <span style={{ fontSize: 30, fontWeight: 700 }}>Journal</span>
          </div>
          <span style={{ fontSize: 26, color: C.muted }}>{resolved.label}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
          <span style={{ fontSize: 26, color: C.muted }}>{headlineLabel}</span>
          <span style={{ fontSize: 104, fontWeight: 800, color: tone, letterSpacing: -3, lineHeight: 1.05 }}>{headline}</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90, marginTop: 28 }}>
          {bars.map(([day, v]) => (
            <div
              key={day}
              style={{
                flex: 1,
                height: Math.max(4, (Math.abs(v) / maxAbs) * 90),
                background: v >= 0 ? C.up : C.down,
                borderRadius: 4,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: "auto" }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "18px 22px" }}>
              <span style={{ fontSize: 20, color: C.muted }}>{k}</span>
              <span style={{ fontSize: 34, fontWeight: 700, marginTop: 4 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "private, no-store" } },
  );
}
