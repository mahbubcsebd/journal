import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Trades" };

export default function Page() {
  return (
    <>
      <PageHeader title="Trades" description="Every position from every account." />
      <ComingSoon
        phase="Phase 2"
        features={[
          "Sortable, filterable table with saved views",
          "Filter by account, symbol, side, session, tag, setup, result",
          "Bulk tag and edit",
          "Trade detail with chart replay, R-multiple, MAE/MFE",
          "Screenshots, notes, emotions and rating",
          "CSV export"
        ]}
      />
    </>
  );
}
