export const CURRENCIES = ["USD", "EUR", "GBP", "BDT", "INR", "AED", "JPY"] as const;

export const COMMON_TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

/** Exness MT5 account types. Cent accounts report balances in USC (1/100 USD). */
export const EXNESS_ACCOUNT_TYPES = [
  { value: "Standard", label: "Standard" },
  { value: "Standard Cent", label: "Standard Cent (USC)" },
  { value: "Pro", label: "Pro" },
  { value: "Raw Spread", label: "Raw Spread" },
  { value: "Zero", label: "Zero" },
] as const;

export const ACCOUNT_COLORS = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#84cc16",
];
