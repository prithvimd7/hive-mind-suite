import { supabase } from "@/integrations/supabase/client";
import { isoDaysAgo, today } from "./format";
import type { DateRange } from "./date-range";

function escape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Triggers a browser download of `rows` as CSV, using the first row's keys as headers. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) throw new Error("Nothing to export yet");
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Downloads sales rows for the last `days` days or an explicit date range. */
export async function exportSalesCsv(period: number | DateRange = 90) {
  const r = typeof period === "number" ? { since: isoDaysAgo(period), until: today() } : period;
  const { data, error } = await supabase
    .from("sales_imports")
    .select("order_date, channel, source, orders, revenue, currency, external_id")
    .gte("order_date", r.since)
    .lte("order_date", r.until)
    .order("order_date", { ascending: true });
  if (error) throw error;
  downloadCsv(`sales_${r.since}_to_${r.until}.csv`, data ?? []);
}
