import { isoDaysAgo, localIso, today } from "./format";

/** Inclusive calendar-date range (YYYY-MM-DD, local time). */
export interface DateRange {
  since: string;
  until: string;
}

export const RANGE_PRESETS = {
  today:   { label: "Today",         short: "today" },
  "7d":    { label: "Last 7 days",   short: "7d" },
  "14d":   { label: "Last 14 days",  short: "14d" },
  "30d":   { label: "Last 30 days",  short: "30d" },
  lastMonth:   { label: "Last month",    short: "last month" },
  last3Months: { label: "Last 3 months", short: "last 3 months" },
} as const;

export type RangeKey = keyof typeof RANGE_PRESETS;
export const RANGE_KEYS = Object.keys(RANGE_PRESETS) as RangeKey[];
export const DEFAULT_RANGE: RangeKey = "30d";

/**
 * "Last N days" includes today. "Last month" / "Last 3 months" are whole calendar months
 * before the current one (e.g. on 18 Sep: Aug 1–31, and Jun 1–Aug 31).
 */
export function resolveRange(key: RangeKey): DateRange {
  const now = new Date();
  switch (key) {
    case "today": return { since: today(), until: today() };
    case "7d":    return { since: isoDaysAgo(6), until: today() };
    case "14d":   return { since: isoDaysAgo(13), until: today() };
    case "30d":   return { since: isoDaysAgo(29), until: today() };
    case "lastMonth":
      return { since: localIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), until: localIso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "last3Months":
      return { since: localIso(new Date(now.getFullYear(), now.getMonth() - 3, 1)), until: localIso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
}

const toDate = (iso: string) => new Date(iso + "T00:00:00");

/** Number of days in the range, inclusive. */
export function rangeDays(r: DateRange): number {
  return Math.round((toDate(r.until).getTime() - toDate(r.since).getTime()) / 86400000) + 1;
}

/** The equally long period immediately before `r`, for "vs previous period" comparisons. */
export function previousRange(r: DateRange): DateRange {
  const n = rangeDays(r);
  const until = toDate(r.since);
  until.setDate(until.getDate() - 1);
  const since = new Date(until);
  since.setDate(since.getDate() - (n - 1));
  return { since: localIso(since), until: localIso(until) };
}

/** Every date in the range, oldest first. */
export function eachDay(r: DateRange): string[] {
  const out: string[] = [];
  for (let d = toDate(r.since); localIso(d) <= r.until; d.setDate(d.getDate() + 1)) out.push(localIso(d));
  return out;
}

export function formatRange(r: DateRange): string {
  const fmt = (iso: string, withYear: boolean) =>
    toDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  if (r.since === r.until) return fmt(r.since, true);
  return `${fmt(r.since, false)} – ${fmt(r.until, true)}`;
}
