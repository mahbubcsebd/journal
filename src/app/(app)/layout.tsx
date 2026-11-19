import { Sidebar } from "@/components/layout/sidebar";
import { SessionBarSlot, Topbar } from "@/components/layout/topbar";
import { GoalAlerts } from "@/components/goals/goal-alerts";
import { MindsetAlerts } from "@/components/mindset/mindset-alerts";
import { AutoSync } from "@/components/layout/auto-sync";
import { BottomNav } from "@/components/layout/bottom-nav";

// Fail fast instead of hanging for Vercel's 300s default if the DB stalls.
export const maxDuration = 60;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <SessionBarSlot />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
          <GoalAlerts />
          <MindsetAlerts />
          <AutoSync />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
