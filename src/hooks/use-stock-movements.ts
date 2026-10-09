import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/lib/date-range";

/** Why stock moved: a finished batch, a sale, or someone correcting the figure. */
export type StockMovementKind = "production" | "sale" | "adjustment";

/** One change in stock: positive is stock in, negative is stock out. */
export interface StockMovement {
  id: string;
  itemId: string;
  date: string;
  qty: number;
  kind: StockMovementKind;
  /** e.g. "batch:<uuid>" or "sale:shopify:<date>:<product>"; null for a hand adjustment. */
  sourceRef: string | null;
}

export interface StockLedger {
  /** Movements inside the chosen period. */
  inRange: StockMovement[];
  /** Net movement per item *after* the period ended, so a past balance can be worked back. */
  afterEnd: Map<string, number>;
}

/**
 * The stock ledger from the start of the period onwards.
 *
 * Only the current stock figure is stored on the item, so a past balance is today's stock
 * minus everything that moved since: `stockAsOf` does that. Movements before this ledger
 * existed aren't recorded, which is why balances only go back as far as the ledger does.
 */
export function useStockMovements(range: DateRange) {
  return useQuery({
    queryKey: ["stock_movements", range.since, range.until],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<StockLedger> => {
      // The generated Supabase types are regenerated after this table's migration runs.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("stock_movements")
        .select("id, item_id, moved_on, qty, kind, source_ref")
        .gte("moved_on", range.since)
        .order("moved_on", { ascending: false });
      if (error) throw error;

      const rows: StockMovement[] = (data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        itemId: String(r.item_id),
        date: String(r.moved_on),
        qty: Number(r.qty),
        kind: r.kind === "production" || r.kind === "sale" ? r.kind : "adjustment",
        sourceRef: (r.source_ref as string | null) ?? null,
      }));

      const afterEnd = new Map<string, number>();
      const inRange: StockMovement[] = [];
      for (const m of rows) {
        if (m.date > range.until) afterEnd.set(m.itemId, (afterEnd.get(m.itemId) ?? 0) + m.qty);
        else inRange.push(m);
      }
      return { inRange, afterEnd };
    },
  });
}

/** What an item's stock was at the end of the period: today's figure, less everything since. */
export function stockAsOf(stockNow: number, itemId: string, ledger?: StockLedger) {
  return stockNow - (ledger?.afterEnd.get(itemId) ?? 0);
}

/**
 * The date sales started counting against stock. Sales before it are ignored, so syncing an
 * old month for its product detail doesn't take long-gone sales off today's stock.
 */
export function useDeductSalesFrom() {
  return useQuery({
    queryKey: ["stock_settings"],
    queryFn: async (): Promise<string | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("stock_settings")
        .select("deduct_sales_from")
        .maybeSingle();
      if (error) throw error;
      return (data?.deduct_sales_from as string | undefined) ?? null;
    },
  });
}
