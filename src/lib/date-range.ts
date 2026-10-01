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

/** True when the range is exactly one calendar month (1st to last day). */
function isWholeMonth(r: DateRange): boolean {
  const start = toDate(r.since);
  const end = toDate(r.until);
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  return start.getDate() === 1 && end.getDate() === lastDay
    && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
}

/**
 * The comparison period: the previous calendar month when a whole month is selected
 * (April 2026 vs March 2026), otherwise the equally long stretch immediately before.
 */
export function previousRange(r: DateRange): DateRange {
  if (isWholeMonth(r)) {
    const start = toDate(r.since);
    return {
      since: localIso(new Date(start.getFullYear(), start.getMonth() - 1, 1)),
      until: localIso(new Date(start.getFullYear(), start.getMonth(), 0)),
    };
  }
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

/**
 * What a page is showing: a preset, a specific calendar month ("2026-04"), or an explicit
 * from/to. Held in the URL so any view can be bookmarked or shared.
 */
export interface RangeSearch {
  range?: RangeKey;
  month?: string;
  from?: string;
  to?: string;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** First to last day of a calendar month given as "YYYY-MM". */
export function monthRange(month: string): DateRange {
  const [y, m] = month.split("-").map(Number);
  return { since: localIso(new Date(y, m - 1, 1)), until: localIso(new Date(y, m, 0)) };
}

export const monthLabel = (month: string) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
    .toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** The last `count` calendar months, newest first. */
export function recentMonths(count = 24): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: monthLabel(value) };
  });
}

/** Resolves whatever the URL holds into a concrete range, with a label for the page header. */
export function resolveSelection(sel: RangeSearch): { range: DateRange; label: string; short: string } {
  if (sel.month && MONTH_RE.test(sel.month)) {
    const label = monthLabel(sel.month);
    return { range: monthRange(sel.month), label, short: label };
  }
  if (sel.from && sel.to && ISO_RE.test(sel.from) && ISO_RE.test(sel.to) && sel.from <= sel.to) {
    return { range: { since: sel.from, until: sel.to }, label: "Custom range", short: "custom range" };
  }
  const key = sel.range && RANGE_KEYS.includes(sel.range) ? sel.range : DEFAULT_RANGE;
  return { range: resolveRange(key), label: RANGE_PRESETS[key].label, short: RANGE_PRESETS[key].short };
}

/** Route search validation: keeps a recognised preset, a month, or a from/to pair. */
export function validateRangeSearch(search: Record<string, unknown>): RangeSearch {
  const { range, month, from, to } = search as Record<string, string | undefined>;
  if (month && MONTH_RE.test(month)) return { month };
  if (from && to && ISO_RE.test(from) && ISO_RE.test(to) && from <= to) return { from, to };
  return RANGE_KEYS.includes(range as RangeKey) ? { range: range as RangeKey } : {};
}
