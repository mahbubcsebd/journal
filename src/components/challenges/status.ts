import type { ChallengeStatus } from "@/lib/challenge";

export const CHALLENGE_STATUS: Record<ChallengeStatus, { label: string; variant: "brand" | "profit" | "loss" | "default" }> = {
  ACTIVE: { label: "In progress", variant: "brand" },
  PASSED: { label: "Passed", variant: "profit" },
  FAILED: { label: "Failed", variant: "loss" },
  EXPIRED: { label: "Expired", variant: "default" },
};
