import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Tags & mistakes" };

export default function Page() {
  return (
    <>
      <PageHeader title="Tags & mistakes" description="Organise trades your way." />
      <ComingSoon
        phase="Phase 2"
        features={[
          "Custom tags with colours",
          "Mistake and emotion lists",
          "Usage and P&L per tag"
        ]}
      />
    </>
  );
}
