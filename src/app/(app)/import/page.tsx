import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Import" };

export default function Page() {
  return (
    <>
      <PageHeader title="Import" description="Bring in your MT5 history." />
      <ComingSoon
        phase="Phase 3"
        features={[
          "Upload MT5 history report (HTML / XLSX) or CSV",
          "Pick which account it belongs to",
          "Preview with duplicate detection",
          "Rebuilds the calendar and stats automatically"
        ]}
      />
    </>
  );
}
