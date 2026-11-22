import { ChevronLeft, ChevronRight, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/admin/status-badge";
import { UserActions } from "@/components/admin/user-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { blockedStatus, isSuperAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { requireSuperAdmin } from "@/server/admin/guard";
import { adminStats, listUsers, recentAudit, type UserSort } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<Skeleton className="h-[700px] rounded-xl" />}>
      <Admin searchParams={searchParams} />
    </Suspense>
  );
}

const ago = (d: Date | null) => {
  if (!d) return "—";
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
const date = (d: Date) => d.toISOString().slice(0, 10);

async function Admin({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const [me, sp] = await Promise.all([requireSuperAdmin(), searchParams]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const q = one(sp.q) ?? "";
  const status = one(sp.status) ?? "all";
  const sort = (["joined", "seen", "trades", "name"].includes(one(sp.sort) ?? "") ? one(sp.sort) : "joined") as UserSort;
  const page = Number(one(sp.page) ?? 1) || 1;
  const [stats, users, audit] = await Promise.all([adminStats(), listUsers({ q, status, sort, page }), recentAudit(12)]);
  const link = (p: number) => `/admin?${new URLSearchParams({ ...(q && { q }), ...(status !== "all" && { status }), sort, page: String(p) })}`;

  const tiles: { label: string; value: number; sub: string; tone?: string }[] = [
    { label: "Users", value: stats.users.total, sub: `${stats.users.new7} new this week` },
    { label: "Active (7 days)", value: stats.users.active7, sub: "opened the app" },
    { label: "Accounts", value: stats.accounts.total, sub: `${stats.accounts.syncing} synced in the last hour` },
    { label: "Trades", value: stats.trades.total, sub: `${stats.trades.day} opened in 24h` },
    { label: "AI messages", value: stats.aiMessages24h, sub: "last 24 hours" },
    { label: "Paused / banned", value: stats.users.paused + stats.users.banned, sub: `${stats.users.paused} paused · ${stats.users.banned} banned`, tone: stats.users.banned ? "text-loss" : "" },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader title="Admin" description="Every user, their accounts and activity. Only super admins can see this page." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className={cn("mt-1 font-mono text-2xl font-semibold tabular", t.tone)}>{t.value.toLocaleString("en-US")}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.sub}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <form className="flex flex-wrap items-end gap-2 border-b p-3" action="/admin">
          <label className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search name or email" className="pl-9" aria-label="Search users" />
          </label>
          <div className="w-36">
            <Combobox
              name="status"
              defaultValue={status}
              searchable={false}
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
                { value: "banned", label: "Banned" },
              ]}
            />
          </div>
          <div className="w-40">
            <Combobox
              name="sort"
              defaultValue={sort}
              searchable={false}
              options={[
                { value: "joined", label: "Newest first" },
                { value: "seen", label: "Last seen" },
                { value: "trades", label: "Most trades" },
                { value: "name", label: "Email A–Z" },
              ]}
            />
          </div>
          <Button type="submit">Apply</Button>
        </form>

        {/* Phones: each user as a card. */}
        <ul className="divide-y sm:hidden">
          {users.rows.length === 0 && <li className="px-4 py-10 text-center text-muted-foreground">No users match.</li>}
          {users.rows.map((u) => (
            <li key={u.id} className="flex items-start gap-2 px-4 py-3">
              <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 font-medium">
                  {u.name || u.email.split("@")[0]}
                  {isSuperAdmin(u.email) && (
                    <Badge variant="brand" className="gap-1 text-[10px]">
                      <ShieldCheck className="size-3" /> Admin
                    </Badge>
                  )}
                  <StatusBadge status={u.status} statusUntil={u.statusUntil} />
                </span>
                <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular">
                  <span>{u.accounts} acct</span>
                  <span>{u.trades.toLocaleString("en-US")} trades</span>
                  <span>seen {ago(u.lastSeenAt)}</span>
                  <span>sync {ago(u.lastSync ? new Date(u.lastSync) : null)}</span>
                </span>
              </Link>
              <UserActions userId={u.id} email={u.email} blocked={blockedStatus(u)} isSelf={u.id === me.id || isSuperAdmin(u.email)} compact />
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                {["User", "Status", "Joined", "Last seen", "Accounts", "Trades", "Last trade", "Last sync", ""].map((h, i) => (
                  <th key={i} className={cn("px-3 py-2.5 font-medium whitespace-nowrap", (i === 4 || i === 5) && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    No users match.
                  </td>
                </tr>
              )}
              {users.rows.map((u) => (
                <tr key={u.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/users/${u.id}`} className="grid gap-0.5 hover:underline">
                      <span className="flex items-center gap-1.5 font-medium">
                        {u.name || "—"}
                        {isSuperAdmin(u.email) && (
                          <Badge variant="brand" className="gap-1 text-[10px]">
                            <ShieldCheck className="size-3" /> Admin
                          </Badge>
                        )}
                        {!u.onboarded && <Badge variant="outline" className="text-[10px]">Setup not finished</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={u.status} statusUntil={u.statusUntil} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap tabular">{date(u.createdAt)}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{ago(u.lastSeenAt)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular">{u.accounts}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular">{u.trades.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{ago(u.lastTrade ? new Date(u.lastTrade) : null)}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{ago(u.lastSync ? new Date(u.lastSync) : null)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <UserActions userId={u.id} email={u.email} blocked={blockedStatus(u)} isSelf={u.id === me.id || isSuperAdmin(u.email)} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            {users.total.toLocaleString("en-US")} user{users.total === 1 ? "" : "s"} · page {users.page} of {users.pages}
          </span>
          <span className="flex gap-1">
            <Button asChild={users.page > 1} variant="outline" size="icon-sm" disabled={users.page <= 1} aria-label="Previous page">
              {users.page > 1 ? (
                <Link href={link(users.page - 1)}>
                  <ChevronLeft />
                </Link>
              ) : (
                <ChevronLeft />
              )}
            </Button>
            <Button asChild={users.page < users.pages} variant="outline" size="icon-sm" disabled={users.page >= users.pages} aria-label="Next page">
              {users.page < users.pages ? (
                <Link href={link(users.page + 1)}>
                  <ChevronRight />
                </Link>
              ) : (
                <ChevronRight />
              )}
            </Button>
          </span>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <p className="mb-2 font-medium">Admin activity</p>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin actions yet.</p>
        ) : (
          <ul className="grid divide-y text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                <span className="w-24 text-xs text-muted-foreground">{ago(a.createdAt)}</span>
                <span className="font-medium">{a.action.replaceAll("_", " ")}</span>
                {a.targetUserId ? (
                  <Link href={`/admin/users/${a.targetUserId}`} className="hover:underline">
                    {a.targetEmail}
                  </Link>
                ) : (
                  <span>{a.targetEmail}</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">by {a.adminEmail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
