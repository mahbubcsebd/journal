export const MOODS = [
  { value: 1, emoji: "😣", label: "Awful" },
  { value: 2, emoji: "😕", label: "Bad" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
] as const;

export const DEFAULT_CHECKLIST = [
  "Checked the economic calendar",
  "Marked key levels on the higher timeframe",
  "Defined max loss for the day",
  "Only A+ setups from my playbook",
  "Feeling calm and focused",
];

export const BIAS = [
  { value: "BULLISH", label: "Bullish" },
  { value: "NEUTRAL", label: "Neutral" },
  { value: "BEARISH", label: "Bearish" },
] as const;

export const moodEmoji = (m: number | null | undefined) => MOODS.find((x) => x.value === m)?.emoji ?? null;
