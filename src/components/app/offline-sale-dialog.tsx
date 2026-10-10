import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { RecordDialog, type Field } from "./record-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/use-products";
import { today } from "@/lib/format";

/**
 * Logs an offline sale with its product, so it lands in both places it belongs: the channel's
 * revenue (sales_imports, what the KPIs read) and the per-product detail (sales_items, which
 * a database trigger uses to take the units out of finished-goods stock).
 *
 * Units here are real units, not packs — the product is named outright, so there is no pack
 * size to unpick as there is with a marketplace listing title.
 *
 * This replaces the Manual Sales Entry page for offline sales; logging the same sale in both
 * would count its revenue twice.
 */
export function OfflineSaleDialog() {
  const qc = useQueryClient();
  const { data: products } = useProducts();

  const fields: Field[] = [
    { name: "order_date", label: "Date", type: "date", required: true },
    { name: "channel", label: "Channel", required: true, placeholder: "Offline, Distributor, Retail…" },
    {
      name: "product_name", label: "Product", type: "select", required: true, full: true,
      options: (products ?? []).map((p) => ({ value: p.name, label: p.name })),
    },
    { name: "quantity", label: "Units sold", type: "number", min: 0, required: true },
    { name: "revenue", label: "Revenue (₹)", type: "number", min: 0, required: true },
  ];

  async function save(payload: Record<string, unknown>) {
    // One reference on both rows, so the Offline sales list can edit or delete them together.
    const ref = `manual:${crypto.randomUUID()}`;
    const row = {
      order_date: String(payload.order_date),
      channel: String(payload.channel || "Offline"),
      source: "manual",
      revenue: Number(payload.revenue ?? 0),
      currency: "INR",
    };

    const item = await supabase.from("sales_items").insert({
      ...row,
      product_name: String(payload.product_name),
      quantity: Number(payload.quantity ?? 0),
      import_ref: ref,
    });
    if (item.error) throw new Error(item.error.message);

    // The revenue side. If this fails the sale is still recorded against the product, so say
    // exactly what is missing rather than implying nothing was saved.
    const total = await supabase.from("sales_imports").insert({
      ...row, orders: 1, external_id: ref,
    });
    if (total.error) {
      throw new Error(`Saved the product line, but adding it to ${row.channel} revenue failed: ${total.error.message}`);
    }

    await Promise.all(
      ["sales_items", "sales_imports", "business_snapshot", "inventory_items", "stock_movements"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
  }

  return (
    <RecordDialog<{ id: string }>
      title="Offline sale"
      fields={fields}
      defaults={{ order_date: today(), channel: "Offline", quantity: 0, revenue: 0 }}
      onSave={save}
      trigger={
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!products?.length}>
          <Plus className="h-3.5 w-3.5" />Offline sale
        </Button>
      }
    />
  );
}
