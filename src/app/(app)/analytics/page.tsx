import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Analytics" };

export default function Page() {
  return (
    <>
      <PageHeader title="Analytics" description="Find where your edge is — and where it leaks." />
      <ComingSoon
        phase="Phase 6"
        features={[
          "Win rate, profit factor, expectancy, payoff ratio",
          "Equity curve and drawdown",
          "By symbol, session, hour, weekday, duration, lot size",
          "Long vs short, setup and tag performance",
          "R-multiple distribution, streaks",
          "Sharpe, Sortino, Calmar, recovery factor"
        ]}
      />
    </>
  );
}
