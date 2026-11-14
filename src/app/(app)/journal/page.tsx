import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Daily journal" };

export default function Page() {
  return (
    <>
      <PageHeader title="Daily journal" description="Plan before the session, review after." />
      <ComingSoon
        phase="Phase 7"
        features={[
          "Pre-market plan and post-market review",
          "Mood and lessons learned",
          "Day stats attached automatically",
          "Linked from the calendar"
        ]}
      />
    </>
  );
}
