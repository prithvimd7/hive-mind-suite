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
import { batches, type Batch } from "@/hooks/use-modules";
import type { Product } from "@/hooks/use-products";
import type { ProductionLine } from "@/hooks/use-production-lines";
import { isoDaysAgo, shortDate, today } from "@/lib/format";

export function useBatchKpis(lines: ProductionLine[]) {
  const { data } = batches.useList();
  return useMemo(() => {
    const rows = data ?? [];
    const t = today(), d7 = isoDaysAgo(6), d30 = isoDaysAgo(30);
    const r30 = rows.filter((b) => b.batch_date >= d30);
    const r7 = rows.filter((b) => b.batch_date >= d7);
    const units30 = r30.reduce((a, b) => a + b.units_produced, 0);
    const rejects30 = r30.reduce((a, b) => a + b.rejects, 0);
    const capacityPerDay = lines.filter((l) => l.status === "active").reduce((a, l) => a + (l.capacity_per_day ?? 0), 0);
    const units7 = r7.reduce((a, b) => a + b.units_produced, 0);
    const qcDone = r30.filter((b) => b.qc_status !== "pending");
    return {
      today: rows.filter((b) => b.batch_date === t).reduce((a, b) => a + b.units_produced, 0),
      units30,
      yieldPct: units30 + rejects30 > 0 ? (units30 / (units30 + rejects30)) * 100 : null,
      utilization: capacityPerDay > 0 ? (units7 / (capacityPerDay * 7)) * 100 : null,
      downtime30: r30.reduce((a, b) => a + b.downtime_minutes, 0),
      qcPass: qcDone.length ? (qcDone.filter((b) => b.qc_status === "passed").length / qcDone.length) * 100 : null,
    };
  }, [data, lines]);
}

export function BatchesSection({ products, lines }: { products: Product[]; lines: ProductionLine[] }) {
  const { data, isLoading } = batches.useList();
  const create = batches.useCreate();
  const update = batches.useUpdate();
  const remove = batches.useDelete();

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  const lineName = (id: string | null) => lines.find((l) => l.id === id)?.name ?? "—";

  const fields: Field[] = [
    { name: "batch_code", label: "Batch code", required: true },
    { name: "batch_date", label: "Date", type: "date", required: true },
    { name: "product_id", label: "Product", type: "select", options: products.map((p) => ({ value: p.id, label: p.name })) },
    { name: "line_id", label: "Line", type: "select", options: lines.map((l) => ({ value: l.id, label: l.name })) },
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

  const defaults = { batch_date: today(), units_planned: 0, units_produced: 0, rejects: 0, downtime_minutes: 0, qc_status: "pending", line_id: lines[0]?.id };
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
      description="Log every production run"
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
                  <TableHead className="hidden md:table-cell">Line</TableHead>
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
                      <TableCell className="hidden md:table-cell text-muted-foreground">{lineName(b.line_id)}</TableCell>
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
