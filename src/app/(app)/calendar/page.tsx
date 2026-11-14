import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return (
    <>
      <PageHeader title="Calendar" description="Daily, weekly, monthly and yearly profit & loss." />
      <ComingSoon
        phase="Phase 4"
        features={[
          "Monthly grid — green profit days, red loss days, colour intensity by size",
          "Weekly view with weekly totals",
          "Yearly heatmap",
          "Click any day to see its trades, equity curve and journal",
          "Best / worst day highlights",
          "Filter by account, symbol and setup"
        ]}
      />
    </>
  );
}
