import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/lib/date-range";

/** One product's sales on one day for one channel. */
export interface SalesItemRow {
  date: string;
  channel: string;
  product: string;
  sku: string | null;
  quantity: number;
  revenue: number;
}

export interface ProductTotals {
  product: string;
  quantity: number;
  revenue: number;
}

/** Sums rows by product, biggest seller first. */
export function byProduct(rows: SalesItemRow[]): ProductTotals[] {
  const map = new Map<string, ProductTotals>();
  for (const r of rows) {
    const cur = map.get(r.product) ?? { product: r.product, quantity: 0, revenue: 0 };
    cur.quantity += r.quantity;
    cur.revenue += r.revenue;
    map.set(r.product, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

/**
 * Product-level sales lines for a period: which item sold and how many.
 * Separate from useSalesData (daily channel totals) so one can exist without the other —
 * manual entries have no product detail, and some channels only report totals.
 */
export function useSalesItems(range: DateRange) {
  return useQuery({
    queryKey: ["sales_items", range.since, range.until],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SalesItemRow[]> => {
      const { data, error } = await supabase
        .from("sales_items")
        .select("order_date, channel, product_name, sku, quantity, revenue")
        .gte("order_date", range.since)
        .lte("order_date", range.until)
        .order("order_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        date: r.order_date,
        channel: r.channel,
        product: r.product_name,
        sku: r.sku,
        quantity: Number(r.quantity),
        revenue: Number(r.revenue),
      }));
    },
  });
}
