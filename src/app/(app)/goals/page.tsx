import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Goals" };

export default function Page() {
  return (
    <>
      <PageHeader title="Goals" description="Targets and limits that keep you disciplined." />
      <ComingSoon
        phase="Phase 8"
        features={[
          "Daily / weekly / monthly profit targets",
          "Max daily loss and max trades per day",
          "Progress rings and breach alerts"
        ]}
      />
    </>
  );
}
