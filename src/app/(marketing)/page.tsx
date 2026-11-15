import { ArrowRight, Bot, CalendarDays, ChartNoAxesCombined, Layers, PlugZap, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CalendarPreview } from "@/app/(auth)/login/calendar-preview";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: PlugZap, title: "Exness MT5 auto-sync", body: "Trades arrive by themselves through MetaApi or our MT5 Expert Advisor. Old history imports in one upload." },
  { icon: Layers, title: "Every sub-account", body: "Standard, Cent, Pro, Raw, Zero, real and demo — each tracked separately, filter one or combine many." },
  { icon: CalendarDays, title: "P&L calendar", body: "Daily, weekly, monthly and yearly views. Green days, red days, and the story behind each one." },
  { icon: ChartNoAxesCombined, title: "Deep analytics", body: "Win rate, profit factor, expectancy, drawdown, R-multiples — by symbol, session, hour and setup." },
  { icon: Bot, title: "AI insights", body: "Gemini reviews your week and points out the patterns that cost you money." },
  { icon: ShieldCheck, title: "Read-only and private", body: "Only an investor (read-only) password is ever used. Nobody can place a trade from your journal." },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[720px] [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_65%)]" />
      <div className="pointer-events-none absolute top-[-200px] left-1/2 size-[700px] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />

      <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/guide/mt5">Setup guide</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 pt-16 pb-24 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <FadeIn className="grid gap-6">
            <span className="w-fit rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              Built for Exness MT5 traders
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Your trading journal,{" "}
              <span className="bg-gradient-to-r from-brand to-[oklch(0.6_0.14_220)] bg-clip-text text-transparent">
                written for you.
              </span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground text-pretty">
              Every order you place on Exness lands in your journal automatically. See each day go green or red, find
              your edge, and fix your leaks.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="brand">
                <Link href="/login">
                  Start journaling <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#features">See features</Link>
              </Button>
            </div>
          </FadeIn>
          <FadeIn delay={0.15} className="flex justify-center lg:justify-end">
            <CalendarPreview />
          </FadeIn>
        </section>

        <section id="features" className="pb-28">
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <StaggerItem key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft transition hover:shadow-pop">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </main>

      <footer className="relative border-t py-8 text-center text-xs text-muted-foreground">
        © Journal
      </footer>
    </div>
  );
}
