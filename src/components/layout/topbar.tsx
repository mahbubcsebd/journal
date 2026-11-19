import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, getDataMode, getSelectedAccountIds, getUserAccounts } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { AccountSwitcher } from "./account-switcher";
import { ModeSwitcher } from "./mode-switcher";
import { NewsCountdown } from "@/components/news/news-countdown";
import { getUpcomingRelevant } from "@/server/queries/news";
import { ensureFreshCalendar } from "@/server/services/news";
import { after } from "next/server";
import { CommandMenu } from "./command-menu";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-1.5 border-b bg-background/75 px-4 sm:gap-2 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-6 lg:h-16 print:hidden">
      <Suspense fallback={<Skeleton className="h-9 w-40 rounded-lg" />}>
        <AccountSwitcherSlot />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-9 w-9 rounded-lg sm:w-24" />}>
        <ModeSlot />
      </Suspense>
      <div className="flex-1" />
      <Suspense fallback={null}>
        <NewsSlot />
      </Suspense>
      <Suspense fallback={<Skeleton className="hidden h-9 w-56 rounded-lg md:block" />}>
        <CommandSlot />
      </Suspense>
      {/* Phones get the theme switch in the account menu to keep the bar on one line. */}
      <div className="hidden sm:block">
        <ThemeToggle />
      </div>
      <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
        <UserSlot />
      </Suspense>
    </header>
  );
}

async function AccountSwitcherSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [accounts, selection] = await Promise.all([getUserAccounts(user.id), getSelectedAccountIds(user.id)]);
  return (
    <AccountSwitcher
      accounts={accounts.map((a) => ({
        id: a.id,
        nickname: a.nickname,
        login: a.login,
        accountType: a.accountType,
        environment: a.environment,
        color: a.color,
      }))}
      selected={selection.ids}
      isAll={selection.isAll}
    />
  );
}

async function UserSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenu name={user.name} email={user.email} />;
}

async function CommandSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  const accounts = await getUserAccounts(user.id);
  return (
    <CommandMenu
      today={todayIn(user.timezone)}
      accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname, login: a.login, color: a.color }))}
    />
  );
}

async function ModeSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <ModeSwitcher mode={await getDataMode()} />;
}

async function NewsSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  // Keep the shared calendar fresh without slowing this page down.
  after(() => ensureFreshCalendar().catch(() => undefined));
  const { events, prefs, fallback } = await getUpcomingRelevant(user).catch(() => ({ events: [], prefs: null, fallback: [] }));
  if (!prefs) return null;
  // Nothing for the trader's own filter: still count down to the next big release anywhere.
  const shown = events.length ? events : fallback;
  return (
    <NewsCountdown
      window={prefs.window}
      events={shown.map((e) => ({
        id: e.id,
        title: e.title,
        currency: e.currency,
        impact: e.impact,
        time: e.time.toISOString(),
        forecast: e.forecast,
        previous: e.previous,
        actual: e.actual,
      }))}
    />
  );
}
