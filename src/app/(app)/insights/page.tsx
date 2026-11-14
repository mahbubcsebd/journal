import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "AI insights" };

export default function Page() {
  return (
    <>
      <PageHeader title="AI insights" description="Gemini-powered review of your trading." />
      <ComingSoon
        phase="Phase 9"
        features={[
          "Pattern detection across your trades",
          "Weekly AI review",
          "Feedback on individual trades",
          "Runs on the Gemini free API"
        ]}
      />
    </>
  );
}
