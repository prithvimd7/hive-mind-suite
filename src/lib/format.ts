export const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const compact = (n: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const pct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}%`;

/** Percent change from `prev` to `cur`; undefined when there's no baseline to compare against. */
export const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : undefined);

/** Local calendar date as YYYY-MM-DD (toISOString would give the UTC date, off by one in IST before 5:30am). */
export const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localIso(d);
};

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

export const today = () => localIso(new Date());
