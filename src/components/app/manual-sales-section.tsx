import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "./section-card";
import { EmptyState } from "./empty-state";
import { RecordDialog, RowActions, EditButton, type Field } from "./record-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/use-products";
import { currency, shortDate } from "@/lib/format";
import type { DateRange } from "@/lib/date-range";

const REFRESH = ["sales_items", "sales_imports", "business_snapshot", "inventory_items", "stock_movements"];

export interface ManualSale {
  id: string;
  order_date: string;
  channel: string;
  product_name: string;
  quantity: number;
  revenue: number;
  /** Links this line to its revenue row in sales_imports. Null on entries made before linking. */
  import_ref: string | null;
}

function useManualSales(range: DateRange) {
  return useQuery({
    queryKey: ["sales_items", "manual", range.since, range.until],
    queryFn: async (): Promise<ManualSale[]> => {
      const { data, error } = await supabase
        .from("sales_items")
        .select("id, order_date, channel, product_name, quantity, revenue, import_ref")
        .eq("source", "manual")
        .gte("order_date", range.since)
        .lte("order_date", range.until)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, quantity: Number(r.quantity), revenue: Number(r.revenue) }));
    },
  });
}

/**
 * The offline sales you've entered by hand, so they can be checked and corrected — in the
 * "Items sold" table above they are folded into their product, which is right for totals but
 * means an individual entry can't be found there.
 *
 * Each entry is two rows: the product line (sales_items, which moves stock) and the revenue
 * (sales_imports, which the KPIs read). They're linked by import_ref, so editing or deleting
 * here keeps both in step.
 */
export function ManualSalesSection({ range, rangeLabel }: { range: DateRange; rangeLabel: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useManualSales(range);
  const { data: products } = useProducts();
  const refresh = () => Promise.all(REFRESH.map((k) => qc.invalidateQueries({ queryKey: [k] })));

  const fields: Field[] = [
    { name: "order_date", label: "Date", type: "date", required: true },
    { name: "channel", label: "Channel", required: true },
    {
      name: "product_name", label: "Product", type: "select", required: true, full: true,
      options: (products ?? []).map((p) => ({ value: p.name, label: p.name })),
    },
    { name: "quantity", label: "Units sold", type: "number", min: 0, required: true },
    { name: "revenue", label: "Revenue (₹)", type: "number", min: 0, required: true },
  ];

  async function save(payload: Record<string, unknown>, id?: string) {
    if (!id) return;
    const row = data?.find((r) => r.id === id);
    const patch = {
      order_date: String(payload.order_date),
      channel: String(payload.channel),
      product_name: String(payload.product_name),
      quantity: Number(payload.quantity ?? 0),
      revenue: Number(payload.revenue ?? 0),
    };
    const item = await supabase.from("sales_items").update(patch).eq("id", id);
    if (item.error) throw new Error(item.error.message);

    // Keep the revenue row in step where the two are linked.
    if (row?.import_ref) {
      const total = await supabase.from("sales_imports")
        .update({ order_date: patch.order_date, channel: patch.channel, revenue: patch.revenue })
        .eq("external_id", row.import_ref);
      if (total.error) throw new Error(`Line updated, but its revenue row didn't: ${total.error.message}`);
    }
    await refresh();
  }

  const remove = useMutation({
    mutationFn: async (row: ManualSale) => {
      const item = await supabase.from("sales_items").delete().eq("id", row.id);
      if (item.error) throw new Error(item.error.message);
      if (row.import_ref) {
        const total = await supabase.from("sales_imports").delete().eq("external_id", row.import_ref);
        if (total.error) throw new Error(`Line deleted, but its revenue row didn't: ${total.error.message}`);
      }
    },
    onSuccess: async (_d, row) => {
      toast.success(
        row.import_ref
          ? "Offline sale deleted — units back in stock"
          : "Product line deleted. Its revenue row isn't linked, so remove that under Manual Sales Entry.",
        { duration: row.import_ref ? 4000 : 10_000 },
      );
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Offline sales"
      description={`Entered by hand · ${rangeLabel}`}
    >
      {isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : !data?.length ? (
        <EmptyState
          title="No offline sales in this period"
          description="Use the Offline sale button above to log one, and its units come out of stock."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{shortDate(r.order_date)}</TableCell>
                  <TableCell>{r.channel}</TableCell>
                  <TableCell className="font-medium">{r.product_name}</TableCell>
                  <TableCell className="text-right">{r.quantity.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">{currency(r.revenue)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <RowActions
                        label={`${r.product_name} · ${shortDate(r.order_date)}`}
                        editTrigger={
                          <RecordDialog<ManualSale>
                            title="Offline sale"
                            fields={fields}
                            record={r}
                            onSave={save}
                            trigger={<EditButton />}
                          />
                        }
                        onDelete={() => remove.mutate(r)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
