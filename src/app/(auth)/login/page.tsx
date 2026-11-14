import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";
import { CalendarPreview } from "./calendar-preview";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Journal home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          No password needed. We email you a one-time code every time you sign in.
        </p>
      </div>
      <aside className="relative hidden overflow-hidden border-l bg-sidebar lg:block">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center gap-10 p-14">
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Every Exness trade, journaled for you.
            </h2>
            <p className="mt-3 text-muted-foreground text-pretty">
              Auto-sync from MT5, a profit &amp; loss calendar for every day, and analytics that show you exactly where your edge is.
            </p>
          </div>
          <CalendarPreview />
        </div>
      </aside>
    </div>
  );
}
