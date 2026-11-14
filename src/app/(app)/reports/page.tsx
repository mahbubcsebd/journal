import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <>
      <PageHeader title="Reports" description="Daily, weekly, monthly and custom reports." />
      <ComingSoon
        phase="Phase 6"
        features={[
          "Period reports with comparisons",
          "PDF and CSV export",
          "Shareable P&L card (amounts can be hidden)",
          "Weekly summary email"
        ]}
      />
    </>
  );
}
