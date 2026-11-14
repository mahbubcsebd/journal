import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Notebook" };

export default function Page() {
  return (
    <>
      <PageHeader title="Notebook" description="Free-form notes, ideas and research." />
      <ComingSoon
        phase="Phase 7"
        features={[
          "Folders and pinned notes",
          "Rich-text editor",
          "Templates"
        ]}
      />
    </>
  );
}
