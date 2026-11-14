import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Risk tools" };

export default function Page() {
  return (
    <>
      <PageHeader title="Risk tools" description="Size every position correctly." />
      <ComingSoon
        phase="Phase 8"
        features={[
          "Position size calculator",
          "Pip value and risk-reward calculator",
          "Account risk rules"
        ]}
      />
    </>
  );
}
