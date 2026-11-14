import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Psychology" };

export default function Page() {
  return (
    <>
      <PageHeader title="Psychology" description="How your emotions affect your P&L." />
      <ComingSoon
        phase="Phase 7"
        features={[
          "Emotion vs result tracking",
          "Discipline score",
          "Tilt detection",
          "Cost of broken rules"
        ]}
      />
    </>
  );
}
