import { getCurrentUser, getSelectedAccountIds } from "@/lib/session";
import { parseTradeFilters } from "@/lib/trade-filters";
import { listTrades } from "@/server/queries/trades";

const esc = (v: unknown) => {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Stop spreadsheet apps from running text (e.g. an account nickname) as a formula.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const filters = { ...parseTradeFilters(Object.fromEntries(url.searchParams)), page: 1 };
  const { ids } = await getSelectedAccountIds(user.id);
  const rows = await listTrades(user.id, ids, filters, user.timezone, 50_000);

  const header = [
    "account", "symbol", "side", "status", "open_time_utc", "close_time_utc", "volume", "open_price", "close_price",
    "pips", "r_multiple", "duration_sec", "session", "net_pnl", "currency", "setup", "tags",
  ];
  const lines = rows.map((r) =>
    [
      r.accountName, r.symbol, r.side, r.status, r.openTime, r.closeTime, r.volume, r.openPrice, r.closePrice,
      r.pips, r.rMultiple, r.durationSec, r.session, r.netPnl, r.currency, r.setupName,
      r.tags.map((t) => t.name).join("; "),
    ].map(esc).join(","),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response([header.join(","), ...lines].join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="journal-trades-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
