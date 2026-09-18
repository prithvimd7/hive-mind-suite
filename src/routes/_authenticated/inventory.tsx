import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Minus, Download } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { EmptyState } from "@/components/app/empty-state";
import { RecordDialog, RowActions, EditButton, type Field } from "@/components/app/record-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inventory, isCriticalStock, isLowStock, type InventoryItem } from "@/hooks/use-modules";
import { useProducts } from "@/hooks/use-products";
import { currency, isoDaysAgo, shortDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [
    { title: "Inventory — Company OS" },
    { name: "description", content: "Raw materials, finished goods, batches, reorder alerts and dead stock." },
    { property: "og:title", content: "Inventory — Company OS" },
    { property: "og:description", content: "Complete inventory visibility across the warehouse." },
  ]}),
  component: Inventory,
});

const TYPE_LABEL: Record<string, string> = { raw: "Raw material", finished: "Finished good", packaging: "Packaging" };

function Inventory() {
  const { data, isLoading } = inventory.useList();
  const { data: products } = useProducts();
  const create = inventory.useCreate();
  const update = inventory.useUpdate();
  const remove = inventory.useDelete();
  const [filter, setFilter] = useState<"all" | "raw" | "finished" | "packaging" | "low">("all");

  const items = useMemo(() => data ?? [], [data]);
  const value = (i: InventoryItem) => Number(i.stock) * Number(i.unit_cost ?? 0);
  const soon = isoDaysAgo(-30); // 30 days from now

  const stats = useMemo(() => {
    const byType = (t: string) => items.filter((i) => i.item_type === t).reduce((a, i) => a + value(i), 0);
    return {
      total: items.reduce((a, i) => a + value(i), 0),
      raw: byType("raw"),
      finished: byType("finished"),
      packaging: byType("packaging"),
      low: items.filter(isLowStock).length,
      expiring: items.filter((i) => i.expiry_date && i.expiry_date <= soon).length,
      missingCost: items.filter((i) => i.unit_cost === null && Number(i.stock) > 0).length,
    };
  }, [items, soon]);

  const visible = items.filter((i) => (filter === "all" ? true : filter === "low" ? isLowStock(i) : i.item_type === filter));

  const fields: Field[] = [
    { name: "sku", label: "SKU", required: true },
    {
      name: "item_type", label: "Type", type: "select", required: true,
      options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })),
    },
    { name: "name", label: "Name", required: true, full: true },
    { name: "stock", label: "Current stock", type: "number", required: true, min: 0 },
    { name: "unit", label: "Unit", required: true },
    { name: "reorder_level", label: "Reorder at", type: "number", required: true, min: 0 },
    { name: "unit_cost", label: "Unit cost (₹)", type: "number", min: 0 },
    { name: "expiry_date", label: "Expiry date", type: "date" },
    {
      name: "product_id", label: "Linked product", type: "select",
      options: [{ value: "", label: "None" }, ...(products ?? []).map((p) => ({ value: p.id, label: p.name }))],
    },
  ];
  const save = (payload: Record<string, unknown>, id?: string) =>
    id ? update.mutateAsync({ id, ...payload }) : create.mutateAsync(payload as never);

  function adjust(i: InventoryItem, sign: 1 | -1) {
    const raw = prompt(`${sign > 0 ? "Add" : "Remove"} how many ${i.unit} of ${i.name}?`);
    if (!raw) return;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a positive number");
    const next = Number(i.stock) + sign * qty;
    if (next < 0) return toast.error(`Only ${Number(i.stock)} ${i.unit} in stock`);
    update.mutate({ id: i.id, stock: next }, {
      onSuccess: () => toast.success(`${i.name}: ${next} ${i.unit}`),
      onError: (e) => toast.error(e.message),
    });
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock, reorder alerts and expiry across raw materials, packaging and finished goods."
        actions={
          <>
            <Button
              size="sm" variant="outline" className="gap-1.5"
              onClick={() => {
                try {
                  downloadCsv("inventory.csv", items.map((i) => ({
                    sku: i.sku, name: i.name, type: i.item_type, stock: i.stock, unit: i.unit,
                    reorder_level: i.reorder_level, unit_cost: i.unit_cost, value: value(i), expiry_date: i.expiry_date,
                  })));
                } catch (e) { toast.error((e as Error).message); }
              }}
            >
              <Download className="h-3.5 w-3.5" />Export
            </Button>
            <RecordDialog<InventoryItem>
              title="Item"
              fields={fields}
              defaults={{ item_type: "raw", unit: "kg", stock: 0, reorder_level: 0 }}
              onSave={save}
              trigger={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add item</Button>}
            />
          </>
        }
      />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Inventory value" value={currency(stats.total)} hint={stats.missingCost ? `${stats.missingCost} item(s) missing unit cost` : "Stock × unit cost"} />
        <KpiCard label="SKUs tracked"    value={String(items.length)} />
        <KpiCard label="Low stock"       value={String(stats.low)} hint="At or below reorder level" />
        <KpiCard label="Expiring ≤30d"   value={String(stats.expiring)} />
        <KpiCard label="Raw materials"   value={currency(stats.raw)} />
        <KpiCard label="Finished goods"  value={currency(stats.finished)} />
        <KpiCard label="Packaging"       value={currency(stats.packaging)} />
      </div>

      <div className="mt-6">
        <SectionCard
          title="Stock levels"
          action={
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="raw" className="text-xs">Raw</TabsTrigger>
                <TabsTrigger value="packaging" className="text-xs hidden sm:inline-flex">Packaging</TabsTrigger>
                <TabsTrigger value="finished" className="text-xs">Finished</TabsTrigger>
                <TabsTrigger value="low" className="text-xs">Low</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          {isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : visible.length === 0 ? (
            <EmptyState
              title={items.length ? "Nothing matches this filter" : "No inventory items yet"}
              description={items.length ? "Try another tab." : "Add raw materials, packaging and finished goods with reorder levels to get stock alerts."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="w-32 hidden sm:table-cell">Level</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Value</TableHead>
                    <TableHead className="hidden lg:table-cell">Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((i) => {
                    const level = Number(i.reorder_level) > 0 ? Math.min(100, (Number(i.stock) / (Number(i.reorder_level) * 3)) * 100) : 100;
                    const status = isCriticalStock(i) ? "critical" : isLowStock(i) ? "low" : "ok";
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{TYPE_LABEL[i.item_type] ?? i.item_type}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {Number(i.stock).toLocaleString("en-IN")} <span className="text-xs text-muted-foreground">{i.unit}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><Progress value={level} className="h-1.5" /></TableCell>
                        <TableCell className="text-right hidden md:table-cell">{i.unit_cost === null ? "—" : currency(value(i))}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {i.expiry_date ? (
                            <span className={i.expiry_date <= soon ? "text-destructive" : ""}>{shortDate(i.expiry_date)}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status === "critical" ? "destructive" : status === "low" ? "secondary" : "default"} className="rounded-full">
                            {status === "critical" ? "Critical" : status === "low" ? "Low" : "OK"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Stock in" onClick={() => adjust(i, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Stock out" onClick={() => adjust(i, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                            <RowActions
                              label={i.name}
                              editTrigger={<RecordDialog<InventoryItem> title="Item" fields={fields} record={i} onSave={save} trigger={<EditButton />} />}
                              onDelete={() => remove.mutate(i.id, { onSuccess: () => toast.success("Item deleted"), onError: (e) => toast.error(e.message) })}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
