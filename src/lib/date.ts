// All seeded dates are relative to the moment the app loads, so the demo always feels current.
const DAY = 86_400_000;

export const now = () => new Date();

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(n: number, hour = 10, minute = 0) {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function daysFromNow(n: number) {
  const d = startOfToday();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Days until the next occurrence of a weekday (0 Sun .. 6 Sat). Returns 0..6, never negative. */
export function daysUntilWeekday(weekday: number) {
  const today = startOfToday().getDay();
  return (weekday - today + 7) % 7;
}

export function diffDays(iso: string) {
  return Math.round((startOfToday().getTime() - new Date(iso).setHours(0, 0, 0, 0)) / DAY);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-US", opts);
}

export function fmtLongDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relDays(n: number) {
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 7) return `${n} days ago`;
  if (n < 14) return "1 week ago";
  if (n < 30) return `${Math.floor(n / 7)} weeks ago`;
  if (n < 60) return "1 month ago";
  return `${Math.floor(n / 30)} months ago`;
}

export function relFromIso(iso: string) {
  return relDays(diffDays(iso));
}

export function weekdayName(offsetDays: number) {
  const d = startOfToday();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-US", { weekday: "long" });
}
