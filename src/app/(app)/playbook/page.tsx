import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Playbook" };

export default function Page() {
  return (
    <>
      <PageHeader title="Playbook" description="Your setups and the rules behind them." />
      <ComingSoon
        phase="Phase 7"
        features={[
          "Setup library with rules and checklists",
          "Per-setup performance stats",
          "Example trades for each setup"
        ]}
      />
    </>
  );
}
