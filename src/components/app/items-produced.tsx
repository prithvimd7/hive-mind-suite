import { useMemo } from "react";
import { SectionCard } from "./section-card";
import { EmptyState } from "./empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { batches } from "@/hooks/use-modules";
import type { Product } from "@/hooks/use-products";
import type { DateRange } from "@/lib/date-range";

/** What was made in the period, per product: batches, good units, rejects and yield. */
export function ItemsProduced({
  products, range, rangeLabel,
}: { products: Product[]; range: DateRange; rangeLabel: string }) {
  const { data, isLoading } = batches.useList();

  const rows = useMemo(() => {
    const name = (id: string | null) => products.find((p) => p.id === id)?.name ?? "Unassigned";
    const map = new Map<string, { product: string; batches: number; produced: number; rejects: number; planned: number }>();
    for (const b of data ?? []) {
      if (b.stage !== "done") continue;
      if (b.batch_date < range.since || b.batch_date > range.until) continue;
      const key = name(b.product_id);
      const cur = map.get(key) ?? { product: key, batches: 0, produced: 0, rejects: 0, planned: 0 };
      cur.batches += 1;
      cur.produced += b.units_produced;
      cur.rejects += b.rejects;
      cur.planned += b.units_planned;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.produced - a.produced);
  }, [data, products, range.since, range.until]);

  const totalUnits = rows.reduce((a, r) => a + r.produced, 0);

  return (
    <SectionCard
      title="Items prepared"
      description={rows.length ? `${totalUnits.toLocaleString("en-IN")} units · ${rangeLabel}` : undefined}
    >
      {isLoading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing finished in this period"
          description="Batches appear here once their stage is set to done."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Batches</TableHead>
              <TableHead className="text-right">Units made</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Rejects</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Yield</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const total = r.produced + r.rejects;
              return (
                <TableRow key={r.product}>
                  <TableCell className="font-medium">{r.product}</TableCell>
                  <TableCell className="text-right">{r.batches}</TableCell>
                  <TableCell className="text-right">{r.produced.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{r.rejects.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {total > 0 ? `${((r.produced / total) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
