/**
 * Rules the MT5 EA enforces, as a tiny line format MQL5 can read without a
 * JSON parser:  key=value  (times are unix seconds, UTC). Pure.
 */
export type GuardRules = {
  alerts: boolean;
  autoClose: boolean;
  /** Warn when a position has no stop loss after this many seconds (0 = off). */
  noSlSeconds: number;
  cooldownUntil: number | null;
  cooldownReason: string | null;
  /** Limits already reached (e.g. daily max loss): any new trade breaks them. */
  blocked: string[];
  news: { start: number; end: number; currency: string; title: string }[];
};

const clean = (s: string) => s.replace(/[\r\n|=]/g, " ").slice(0, 120);

export function guardText(g: GuardRules, now: number) {
  const lines = [
    "v=1",
    `now=${Math.floor(now / 1000)}`,
    `alerts=${g.alerts ? 1 : 0}`,
    `autoclose=${g.autoClose ? 1 : 0}`,
    `nosl=${g.noSlSeconds}`,
    `cooldown=${g.cooldownUntil ? Math.floor(g.cooldownUntil / 1000) : 0}|${clean(g.cooldownReason ?? "")}`,
    ...g.blocked.map((b) => `blocked=${clean(b)}`),
    ...g.news.map((n) => `news=${Math.floor(n.start / 1000)}|${Math.floor(n.end / 1000)}|${n.currency}|${clean(n.title)}`),
    "end=1",
  ];
  return lines.join("\n") + "\n";
}
