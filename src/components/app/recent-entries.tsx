import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "./section-card";
import { EmptyState } from "./empty-state";
import { RowActions } from "./record-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { platformLabel } from "@/hooks/use-marketing-data";
import { currency, shortDate } from "@/lib/format";

const REFRESH = ["sales_imports", "ad_spend_imports", "business_snapshot", "integrations_summary"];

function useDelete(table: "sales_imports" | "ad_spend_imports") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Entry deleted"); REFRESH.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Latest sales rows (manual, CSV and synced) with delete — for removing test or wrong entries. CEO only (RLS). */
export function RecentSales() {
  const { data, isLoading } = useQuery({
    queryKey: ["sales_imports", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_imports")
        .select("id, order_date, channel, source, orders, revenue, external_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const del = useDelete("sales_imports");

  return (
    <SectionCard title="Recent sales entries" description="Latest 50 — delete test or wrong entries here. Synced rows come back on the next sync.">
      {isLoading ? <Skeleton className="h-32 rounded-xl" /> : !data?.length ? (
        <EmptyState title="No sales entries yet" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="hidden sm:table-cell">Source</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{shortDate(r.order_date)}</TableCell>
                  <TableCell>{r.channel ?? "—"}{r.external_id && <span className="text-xs text-muted-foreground"> · {r.external_id}</span>}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{r.source}</TableCell>
                  <TableCell className="text-right">{r.orders}</TableCell>
                  <TableCell className="text-right">{currency(Number(r.revenue))}</TableCell>
                  <TableCell>
                    <RowActions label={`${r.channel ?? r.source} ${r.order_date} ${currency(Number(r.revenue))}`} onDelete={() => del.mutate(r.id)} />
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

/** Latest ad-spend rows with delete. CEO only (RLS). */
export function RecentAdSpend() {
  const { data, isLoading } = useQuery({
    queryKey: ["ad_spend_imports", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_spend_imports")
        .select("id, spend_date, platform, campaign, spend, revenue")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const del = useDelete("ad_spend_imports");

  return (
    <SectionCard title="Recent ad-spend entries" description="Latest 50 — delete test or wrong entries here. Synced rows come back on the next sync.">
      {isLoading ? <Skeleton className="h-32 rounded-xl" /> : !data?.length ? (
        <EmptyState title="No ad-spend entries yet" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Revenue</TableHead>
                <TableHead className="text-right">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{shortDate(r.spend_date)}</TableCell>
                  <TableCell>{platformLabel(r.platform)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{r.campaign ?? "—"}</TableCell>
                  <TableCell className="text-right">{currency(Number(r.spend))}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{currency(Number(r.revenue))}</TableCell>
                  <TableCell>
                    <RowActions label={`${platformLabel(r.platform)} ${r.campaign ?? ""} ${r.spend_date}`} onDelete={() => del.mutate(r.id)} />
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
