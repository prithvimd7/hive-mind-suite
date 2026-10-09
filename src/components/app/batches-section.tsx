import { useMemo } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { SectionCard } from "./section-card";
import { EmptyState } from "./empty-state";
import { RecordDialog, RowActions, EditButton, type Field } from "./record-dialog";
import { BarsChart } from "./charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { batches, PRODUCTION_STAGES, type Batch } from "@/hooks/use-modules";
import type { Product } from "@/hooks/use-products";
import { isoDaysAgo, shortDate, today } from "@/lib/format";
import type { DateRange } from "@/lib/date-range";

export function useBatchKpis(range: DateRange) {
  const { data } = batches.useList();
  return useMemo(() => {
    // Only finished batches have real output numbers; in-progress runs are counted separately.
    const rows = (data ?? []).filter((b) => b.stage === "done");
    const inProduction = (data ?? []).length - rows.length;
    const t = today();
    const r30 = rows.filter((b) => b.batch_date >= range.since && b.batch_date <= range.until);
    const units30 = r30.reduce((a, b) => a + b.units_produced, 0);
    const rejects30 = r30.reduce((a, b) => a + b.rejects, 0);
    const qcDone = r30.filter((b) => b.qc_status !== "pending");
    return {
      inProduction,
      today: rows.filter((b) => b.batch_date === t).reduce((a, b) => a + b.units_produced, 0),
      units30,
      yieldPct: units30 + rejects30 > 0 ? (units30 / (units30 + rejects30)) * 100 : null,
      downtime30: r30.reduce((a, b) => a + b.downtime_minutes, 0),
      qcPass: qcDone.length ? (qcDone.filter((b) => b.qc_status === "passed").length / qcDone.length) * 100 : null,
    };
  }, [data, range.since, range.until]);
}

/** Finished batches only — runs still on the floor live in the "In production" board. */
export function BatchesSection({ products, range }: { products: Product[]; range: DateRange }) {
  const { data: allBatches, isLoading } = batches.useList();
  const data = (allBatches ?? []).filter(
    (b) => b.stage === "done" && b.batch_date >= range.since && b.batch_date <= range.until,
  );
  const create = batches.useCreate();
  const update = batches.useUpdate();
  const remove = batches.useDelete();

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";

  const fields: Field[] = [
    { name: "batch_code", label: "Batch code", required: true },
    { name: "batch_date", label: "Date", type: "date", required: true },
    { name: "product_id", label: "Product", type: "select", options: products.map((p) => ({ value: p.id, label: p.name })) },
    { name: "units_planned", label: "Units planned", type: "number", min: 0, required: true },
    { name: "units_produced", label: "Good units produced", type: "number", min: 0, required: true },
    { name: "rejects", label: "Rejects", type: "number", min: 0, required: true },
    { name: "downtime_minutes", label: "Downtime (min)", type: "number", min: 0, required: true },
    { name: "protein_pct", label: "Protein %", type: "number", min: 0, max: 100 },
    {
      name: "qc_status", label: "QC status", type: "select", required: true,
      options: [{ value: "pending", label: "Pending" }, { value: "passed", label: "Passed" }, { value: "failed", label: "Failed" }],
    },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const defaults = { batch_date: today(), units_planned: 0, units_produced: 0, rejects: 0, downtime_minutes: 0, qc_status: "pending", stage: "done" };
  const save = (payload: Record<string, unknown>, id?: string) =>
    id ? update.mutateAsync({ id, ...payload }) : create.mutateAsync(payload as never);

  // Daily units for the last 14 days
  const chart = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const b of data ?? []) byDay.set(b.batch_date, (byDay.get(b.batch_date) ?? 0) + b.units_produced);
    return Array.from({ length: 14 }, (_, i) => {
      const d = isoDaysAgo(13 - i);
      return { label: d.slice(5), units: byDay.get(d) ?? 0 };
    });
  }, [data]);

  return (
    <SectionCard
      title="Batches, yield & quality"
      description="Log every production run · good units join stock when QC passes"
      action={
        <RecordDialog<Batch>
          title="Batch"
          fields={fields}
          defaults={defaults}
          onSave={save}
          trigger={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Log batch</Button>}
        />
      }
    >
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !data?.length ? (
        <EmptyState title="No batches logged yet" description="Log a production run to track output, yield, downtime and QC." />
      ) : (
        <>
          <BarsChart data={chart} xKey="label" yKey="units" />
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Yield</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Protein</TableHead>
                  <TableHead>QC</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 50).map((b) => {
                  const total = b.units_produced + b.rejects;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">{shortDate(b.batch_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{b.batch_code}</TableCell>
                      <TableCell>{productName(b.product_id)}</TableCell>
                      <TableCell className="text-right">
                        {b.units_produced.toLocaleString("en-IN")}
                        {b.units_planned > 0 && <span className="text-muted-foreground text-xs"> / {b.units_planned}</span>}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{total > 0 ? `${((b.units_produced / total) * 100).toFixed(1)}%` : "—"}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">{b.protein_pct !== null ? `${b.protein_pct}%` : "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={b.qc_status === "failed" ? "destructive" : b.qc_status === "passed" ? "default" : "secondary"}
                          className="rounded-full capitalize"
                        >
                          {b.qc_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RowActions
                          label={b.batch_code}
                          editTrigger={<RecordDialog<Batch> title="Batch" fields={fields} record={b} onSave={save} trigger={<EditButton />} />}
                          onDelete={() => remove.mutate(b.id, { onSuccess: () => toast.success("Batch deleted"), onError: (e) => toast.error(e.message) })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </SectionCard>
  );
}
