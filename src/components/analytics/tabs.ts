export const ANALYTICS_TABS = [
  { key: "overview", label: "Overview" },
  { key: "time", label: "Time" },
  { key: "instruments", label: "Instruments" },
  { key: "journal", label: "Setups & tags" },
  { key: "risk", label: "Risk" },
] as const;

export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]["key"];
