import type { Metadata } from "next";
import { ArrowRight, CalendarDays, FolderInput, PlugZap, Wallet } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSelectedAccountIds, getUserAccounts, requireUser } from "@/lib/session";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { getSummary } from "@/server/queries/stats";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<PageHeader title="Dashboard" />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<KpiSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Greeting() {
  const user = await requireUser();
  const first = user.name.split(" ")[0] || "trader";
  return <PageHeader title={`Hi, ${first}`} description="Here's how your trading is going." />;
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

async function Overview() {
  const user = await requireUser();
  const [accounts, selection] = await Promise.all([getUserAccounts(user.id), getSelectedAccountIds(user.id)]);
  const s = await getSummary(selection.ids);
  const currency = s.currency;
  const winRate = s.trades ? s.wins / s.trades : 0;
  const profitFactor = s.grossLoss ? s.grossProfit / Math.abs(s.grossLoss) : 0;

  const kpis = [
    {
      label: "Net P&L",
      value: formatMoney(s.netPnl, currency, { sign: true }),
      tone: s.netPnl > 0 ? "profit" : s.netPnl < 0 ? "loss" : undefined,
      sub: `${s.tradingDays} trading days`,
    },
    { label: "Win rate", value: s.trades ? formatPercent(winRate) : "—", sub: `${s.wins}W · ${s.losses}L` },
    { label: "Profit factor", value: s.grossLoss ? profitFactor.toFixed(2) : "—", sub: "Gross profit ÷ gross loss" },
    {
      label: "Green days",
      value: s.tradingDays ? formatPercent(s.greenDays / s.tradingDays) : "—",
      sub: `${s.greenDays} of ${s.tradingDays} days`,
    },
  ];

  return (
    <div className="grid gap-6">
      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <StaggerItem key={k.label}>
            <Card className="p-5">
              <p className="text-[13px] text-muted-foreground">{k.label}</p>
              <p
                className={cn(
                  "mt-2 font-mono text-2xl font-semibold tracking-tight tabular",
                  k.tone === "profit" && "text-profit",
                  k.tone === "loss" && "text-loss",
                )}
              >
                {k.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      {s.trades === 0 && <GettingStarted hasAccount={accounts.length > 0} />}
    </div>
  );
}

function GettingStarted({ hasAccount }: { hasAccount: boolean }) {
  const steps = [
    {
      icon: Wallet,
      title: "Add your Exness accounts",
      body: "Add every MT5 login — Standard, Cent, Pro, Raw, Zero. Each one is tracked and filterable separately.",
      href: "/accounts",
      cta: hasAccount ? "Manage accounts" : "Add account",
      done: hasAccount,
    },
    {
      icon: FolderInput,
      title: "Import your history",
      body: "Upload your MT5 history report once to bring in every past trade.",
      href: "/import",
      cta: "Import",
      done: false,
    },
    {
      icon: PlugZap,
      title: "Turn on auto-sync",
      body: "Connect through MetaApi (works with your PC off) or our MT5 Expert Advisor.",
      href: "/accounts",
      cta: "Connect",
      done: false,
    },
    {
      icon: CalendarDays,
      title: "Review on the calendar",
      body: "Every day turns green or red. Click any day to journal it.",
      href: "/calendar",
      cta: "Open calendar",
      done: false,
    },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">Get started</h2>
        <p className="text-[13px] text-muted-foreground">Four steps to a fully automatic journal.</p>
      </div>
      <Stagger className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {steps.map((step, i) => (
          <StaggerItem key={step.title} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  step.done ? "bg-profit-soft text-profit" : "bg-secondary text-muted-foreground",
                )}
              >
                <step.icon className="size-4" />
              </span>
              <span className="text-xs text-muted-foreground">Step {i + 1}</span>
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-[13px] text-muted-foreground">{step.body}</p>
            </div>
            <Link
              href={step.href}
              className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
            >
              {step.cta} <ArrowRight className="size-3.5" />
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </Card>
  );
}
