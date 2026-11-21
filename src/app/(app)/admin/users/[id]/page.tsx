import { ArrowLeft, KeyRound, Monitor, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RevokeKeyButton } from "@/components/admin/revoke-key";
import { StatusBadge } from "@/components/admin/status-badge";
import { UserActions } from "@/components/admin/user-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { blockedStatus, isSuperAdmin } from "@/lib/admin";
import { cn, formatMoney } from "@/lib/utils";
import { requireSuperAdmin } from "@/server/admin/guard";
import { userDetail } from "@/server/admin/queries";

export const metadata: Metadata = { title: "User · Admin", robots: { index: false } };

export default function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[700px] rounded-xl" />}>
      <UserView params={params} />
    </Suspense>
  );
}

const when = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");
const device = (ua: string | null) => {
  if (!ua) return { name: "Unknown device", mobile: false };
  const mobile = /iphone|android|mobile/i.test(ua);
  const os = /iphone|ipad/i.test(ua) ? "iPhone/iPad" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "Mac" : /linux/i.test(ua) ? "Linux" : "Other";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome\//i.test(ua) ? "Chrome" : /firefox\//i.test(ua) ? "Firefox" : /safari\//i.test(ua) ? "Safari" : "Browser";
  return { name: `${browser} on ${os}`, mobile };
};

async function UserView({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  const [me, { id }] = await Promise.all([requireSuperAdmin(), params]);
  const d = await userDetail(id);
  if (!d) notFound();
  const u = d.user;
  const blocked = blockedStatus(u);
  const protectedUser = u.id === me.id || isSuperAdmin(u.email);
  const totalTrades = d.accounts.reduce((s, a) => s + (a.stats?.trades ?? 0), 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link href="/admin" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All users
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {u.name || u.email}
              <StatusBadge status={u.status} statusUntil={u.statusUntil} />
              {isSuperAdmin(u.email) && <Badge variant="brand">Super admin</Badge>}
            </h1>
            <p className="text-sm text-muted-foreground">
              {u.email} · joined {when(u.createdAt).slice(0, 10)} · last seen {when(u.lastSeenAt)}
            </p>
          </div>
          <UserActions userId={u.id} email={u.email} blocked={blocked} isSelf={protectedUser} />
        </div>
        {blocked && (
          <div className={cn("rounded-xl border p-3 text-sm", blocked === "banned" ? "border-loss/40 bg-loss-soft/50" : "border-warning/50 bg-warning/10")}>
            <p className="font-medium">{blocked === "banned" ? "Banned" : `Paused${u.statusUntil ? ` until ${when(u.statusUntil)}` : " until reopened"}`}</p>
            <p className="text-muted-foreground">
              {u.statusReason ? `Reason: ${u.statusReason}` : "No reason given"} · since {when(u.statusChangedAt)}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Accounts", d.accounts.length],
          ["Trades", totalTrades],
          ["AI messages (30d)", d.usage.coachMessages30d],
          ["Pre-trade checks (30d)", d.usage.preTradeChecks30d],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular">{Number(v).toLocaleString("en-US")}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <p className="border-b px-4 py-3 font-medium">Trading accounts</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                {["Account", "Type", "Sync", "Last sync", "Balance", "Equity", "Trades", "Net P&L (closed, live)", "Open"].map((h, i) => (
                  <th key={h} className={cn("px-3 py-2 font-medium whitespace-nowrap", i >= 4 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.accounts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    No accounts yet.
                  </td>
                </tr>
              )}
              {d.accounts.map((a) => (
                <tr key={a.id} className={cn("border-t", a.archived && "text-muted-foreground")}>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{a.nickname}</span>
                    <span className="block text-xs text-muted-foreground">
                      #{a.login} · {a.server}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {a.accountType} · {a.environment === "DEMO" ? "Demo" : "Real"}
                    {a.archived && " · archived"}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {a.syncMethod} · {a.status.toLowerCase()}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{when(a.lastSyncAt)}</td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap tabular">{a.balance == null ? "—" : formatMoney(a.balance, a.currency)}</td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap tabular">{a.equity == null ? "—" : formatMoney(a.equity, a.currency)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular">{a.stats?.trades ?? 0}</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-mono whitespace-nowrap tabular",
                      (a.stats?.net ?? 0) > 0 ? "text-profit" : (a.stats?.net ?? 0) < 0 ? "text-loss" : "",
                    )}
                  >
                    {formatMoney(a.stats?.net ?? 0, a.currency, { sign: true })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular">{a.openPositions?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <p className="mb-2 font-medium">Signed-in devices</p>
          {d.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not signed in anywhere.</p>
          ) : (
            <ul className="grid divide-y text-sm">
              {d.sessions.map((s) => {
                const dev = device(s.ua);
                const Icon = dev.mobile ? Smartphone : Monitor;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{dev.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.ip ?? "unknown IP"} · active {when(s.updatedAt)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="mb-2 font-medium">MT5 sync keys</p>
          {d.keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys.</p>
          ) : (
            <ul className="grid divide-y text-sm">
              {d.keys.map((k) => (
                <li key={k.id} className="flex items-center gap-3 py-2">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs">{k.prefix}…</span>
                    <span className="block text-xs text-muted-foreground">
                      {k.name} · used {when(k.lastUsedAt)}
                    </span>
                  </span>
                  {k.revokedAt ? <Badge variant="outline">Revoked</Badge> : <RevokeKeyButton userId={u.id} keyId={k.id} />}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Alerts: {d.usage.pushDevices} push device{d.usage.pushDevices === 1 ? "" : "s"} · Telegram {d.usage.telegram ? "connected" : "not connected"} · {d.usage.reviews} AI reviews
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <p className="mb-2 font-medium">Recent trades</p>
          {d.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trades.</p>
          ) : (
            <ul className="grid divide-y text-sm">
              {d.recent.map((t) => {
                const acc = d.accounts.find((a) => a.id === t.accountId);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2">
                    <span className="w-36 font-mono text-xs text-muted-foreground tabular">{when(t.openTime).slice(0, 16)}</span>
                    <span className="font-medium">
                      {t.symbol} {t.side === "LONG" ? "▲" : "▼"}
                    </span>
                    <span className="text-xs text-muted-foreground">{acc?.nickname}</span>
                    <span className={cn("ml-auto font-mono text-xs tabular", t.status === "OPEN" ? "" : t.net > 0 ? "text-profit" : t.net < 0 ? "text-loss" : "")}>
                      {t.status === "OPEN" ? "open" : formatMoney(t.net, acc?.currency ?? "USD", { sign: true })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="mb-2 font-medium">Admin history for this user</p>
          {d.audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin actions.</p>
          ) : (
            <ul className="grid divide-y text-sm">
              {d.audit.map((a) => (
                <li key={a.id} className="grid gap-0.5 py-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.action.replaceAll("_", " ")}</span>
                    <span className="text-xs text-muted-foreground">
                      {when(a.createdAt)} · by {a.adminEmail}
                    </span>
                  </span>
                  {a.details && Object.keys(a.details).length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Object.entries(a.details)
                        .filter(([, v]) => v != null && v !== "")
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
