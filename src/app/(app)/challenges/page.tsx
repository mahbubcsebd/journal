import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Challenges" };

export default function Page() {
  return (
    <>
      <PageHeader title="Challenges" description="Track prop-firm style challenges." />
      <ComingSoon
        phase="Phase 8"
        features={[
          "Profit target, max drawdown, daily drawdown",
          "Days traded and time remaining",
          "Pass / fail status"
        ]}
      />
    </>
  );
}
