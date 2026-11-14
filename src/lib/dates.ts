/**
 * Calendar math on plain "YYYY-MM-DD" day strings. Days are already bucketed in
 * the user's timezone, so everything here works in UTC to stay timezone-free.
 */
export type Day = string;
export type WeekStart = 0 | 1 | 6;

const pad = (n: number) => String(n).padStart(2, "0");

export const isDay = (s: string | undefined): s is Day => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function toDate(day: Day) {
  return new Date(`${day}T00:00:00Z`);
}

export function fromDate(d: Date): Day {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(day: Day, n: number): Day {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

export function addMonths(day: Day, n: number): Day {
  const d = toDate(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return fromDate(target);
}

export function weekday(day: Day) {
  return toDate(day).getUTCDay();
}

export function startOfWeek(day: Day, weekStartsOn: WeekStart): Day {
  return addDays(day, -((weekday(day) - weekStartsOn + 7) % 7));
}

export function startOfMonth(day: Day): Day {
  return `${day.slice(0, 7)}-01`;
}

export function endOfMonth(day: Day): Day {
  const d = toDate(day);
  return fromDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Weeks (arrays of 7 days) covering the month, padded with neighbouring days. */
export function monthGrid(anchor: Day, weekStartsOn: WeekStart): Day[][] {
  const first = startOfWeek(startOfMonth(anchor), weekStartsOn);
  const last = endOfMonth(anchor);
  const weeks: Day[][] = [];
  let cur = first;
  while (cur <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)));
    cur = addDays(cur, 7);
  }
  return weeks;
}

export function weekdayLabels(weekStartsOn: WeekStart, style: "short" | "narrow" = "short") {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat("en-US", { weekday: style, timeZone: "UTC" }).format(toDate(`2023-01-0${1 + ((weekStartsOn + i) % 7)}`)),
  );
}

export function todayIn(timeZone: string): Day {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function formatDay(day: Day, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(toDate(day));
}
