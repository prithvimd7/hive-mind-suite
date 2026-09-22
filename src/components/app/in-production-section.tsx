import { toast } from "sonner";
import { Plus, ArrowRight } from "lucide-react";
import { SectionCard } from "./section-card";
import { EmptyState } from "./empty-state";
import { RecordDialog, RowActions, EditButton, type Field } from "./record-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { batches, PRODUCTION_STAGES, today, type Batch } from "@/hooks/use-modules";
import type { Product } from "@/hooks/use-products";
import type { ProductionLine } from "@/hooks/use-production-lines";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STAGE_OPTIONS = PRODUCTION_STAGES.map((s) => ({ value: s, label: cap(s) }));

/** Batches still on the floor (everything except "done"). */
export const isInProduction = (b: Batch) => b.stage !== "done";

export function runFields(products: Product[], lines: ProductionLine[]): Field[] {
  return [
    { name: "batch_code", label: "Batch code", required: true },
    { name: "batch_date", label: "Start date", type: "date", required: true },
    { name: "product_id", label: "Product", type: "select", required: true, options: products.map((p) => ({ value: p.id, label: p.name })) },
    { name: "stage", label: "Stage", type: "select", required: true, options: STAGE_OPTIONS },
    { name: "units_planned", label: "Units planned", type: "number", min: 0, required: true },
    ...(lines.length
      ? [{ name: "line_id", label: "Line", type: "select", options: [{ value: "", label: "None" }, ...lines.map((l) => ({ value: l.id, label: l.name }))] } as Field]
      : []),
    { name: "notes", label: "Notes", type: "textarea" },
  ];
}

/**
 * The factory floor board: one row per batch in progress, moving through
 * cooking → filling → sealing → retort → done. Setting a batch to "done" removes it
 * from here and it appears under "Batches, yield & quality" for its output and QC result.
 */
export function InProductionSection({ products, lines }: { products: Product[]; lines: ProductionLine[] }) {
  const { data, isLoading } = batches.useList();
  const create = batches.useCreate();
  const update = batches.useUpdate();
  const remove = batches.useDelete();

  const running = (data ?? []).filter(isInProduction);
  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  const fields = runFields(products, lines);

  const save = (payload: Record<string, unknown>, id?: string) =>
    id ? update.mutateAsync({ id, ...payload }) : create.mutateAsync(payload as never);

  const setStage = (b: Batch, stage: string) =>
    update.mutate({ id: b.id, stage }, {
      onSuccess: () =>
        stage === "done"
          ? toast.success(`${b.batch_code} finished — add units produced and QC result under Batches, yield & quality.`)
          : toast.success(`${b.batch_code} → ${cap(stage)}`),
      onError: (e) => toast.error(e.message),
    });

  return (
    <SectionCard
      title="In production"
      description="Batches on the floor right now"
      action={
        <RecordDialog<Batch>
          title="Production run"
          fields={fields}
          defaults={{ batch_date: today(), stage: "cooking", units_planned: 0, units_produced: 0, rejects: 0, downtime_minutes: 0, qc_status: "pending" }}
          onSave={save}
          trigger={<Button size="sm" className="gap-1.5" disabled={!products.length}><Plus className="h-3.5 w-3.5" />Start run</Button>}
        />
      }
    >
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : !products.length ? (
        <EmptyState title="Add a product first" description="Production runs are tracked per product." />
      ) : running.length === 0 ? (
        <EmptyState title="Nothing in production" description="Start a run to track it through cooking, filling, sealing and retort." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">Batch</TableHead>
                <TableHead className="hidden md:table-cell">Started</TableHead>
                <TableHead className="text-right hidden md:table-cell">Planned</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {running.map((b) => {
                const step = PRODUCTION_STAGES.indexOf(b.stage as (typeof PRODUCTION_STAGES)[number]);
                const next = PRODUCTION_STAGES[step + 1];
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{productName(b.product_id)}</TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">{b.batch_code}</TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap">{shortDate(b.batch_date)}</TableCell>
                    <TableCell className="text-right hidden md:table-cell">{b.units_planned ? b.units_planned.toLocaleString("en-IN") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Select value={b.stage} onValueChange={(v) => setStage(b, v)}>
                          <SelectTrigger className="h-7 w-[104px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STAGE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {next && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 hidden sm:inline-flex"
                            title={`Move to ${cap(next)}`} aria-label={`Move to ${cap(next)}`}
                            onClick={() => setStage(b, next)}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <RowActions
                        label={`${productName(b.product_id)} · ${b.batch_code}`}
                        editTrigger={<RecordDialog<Batch> title="Production run" fields={fields} record={b} onSave={save} trigger={<EditButton />} />}
                        onDelete={() => remove.mutate(b.id, { onError: (e) => toast.error(e.message) })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Stage legend, so the order is obvious at a glance */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {PRODUCTION_STAGES.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5">
                <Badge variant="secondary" className={cn("rounded-full font-normal", s === "done" && "opacity-70")}>{cap(s)}</Badge>
                {i < PRODUCTION_STAGES.length - 1 && <ArrowRight className="h-3 w-3" />}
              </span>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
