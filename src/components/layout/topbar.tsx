import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, getSelectedAccountIds, getUserAccounts } from "@/lib/session";
import { AccountSwitcher } from "./account-switcher";
import { MobileNav } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/75 px-4 backdrop-blur-xl sm:px-6">
      <MobileNav />
      <Suspense fallback={<Skeleton className="h-9 w-40 rounded-lg" />}>
        <AccountSwitcherSlot />
      </Suspense>
      <div className="flex-1" />
      <ThemeToggle />
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
