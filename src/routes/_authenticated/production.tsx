import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { EmptyState } from "@/components/app/empty-state";
import { ProductDialog } from "@/components/app/product-dialog";
import { ProductionLineDialog } from "@/components/app/production-line-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProducts, useDeleteProduct } from "@/hooks/use-products";
import { useProductionLines, useDeleteProductionLine } from "@/hooks/use-production-lines";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { BatchesSection, useBatchKpis } from "@/components/app/batches-section";
import { InProductionSection } from "@/components/app/in-production-section";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({ meta: [
    { title: "Production — Company OS" },
    { name: "description", content: "Products, production lines, batches, yield and quality." },
    { property: "og:title", content: "Production — Company OS" },
    { property: "og:description", content: "Factory floor performance and quality." },
  ]}),
  component: Production,
});

function Production() {
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: lines, isLoading: linesLoading } = useProductionLines();
  const deleteProduct = useDeleteProduct();
  const deleteLine = useDeleteProductionLine();
  const kpis = useBatchKpis(lines ?? []);

  return (
    <div>
      <PageHeader title="Production" description="Track each batch from cooking to done, then its yield and quality." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Products"        value={productsLoading ? "…" : String(products?.length ?? 0)} />
        <KpiCard label="In production"   value={String(kpis.inProduction)} hint="Batches on the floor" />
        <KpiCard label="Today's production"  value={kpis.today.toLocaleString("en-IN")} hint="Units, all lines" />
        <KpiCard label="Capacity util. (7d)" value={kpis.utilization === null ? "—" : `${kpis.utilization.toFixed(0)}%`} hint="Produced ÷ line capacity" />
        <KpiCard label="Units (30d)"         value={kpis.units30.toLocaleString("en-IN")} />
        <KpiCard label="Yield (30d)"         value={kpis.yieldPct === null ? "—" : `${kpis.yieldPct.toFixed(1)}%`} hint="Good units ÷ (good + rejects)" />
        <KpiCard label="Downtime (30d)"      value={`${(kpis.downtime30 / 60).toFixed(1)} h`} />
        <KpiCard label="QC pass rate (30d)"  value={kpis.qcPass === null ? "—" : `${kpis.qcPass.toFixed(0)}%`} hint="Of batches with a QC result" />
      </div>

      <div className="mt-6">
        <InProductionSection products={products ?? []} lines={lines ?? []} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Products"
          description="Your SKUs"
          action={
            <ProductDialog trigger={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add product</Button>} />
          }
        >
          {productsLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : !products || products.length === 0 ? (
            <EmptyState title="No products yet" description="Add your first SKU to get started." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"} className="rounded-full">
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ProductDialog
                          product={p}
                          trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${p.name}"?`)) {
                              deleteProduct.mutate(p.id, {
                                onSuccess: () => toast.success("Product deleted"),
                                onError: (e) => toast.error(e.message),
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          title="Factory lines"
          description="Equipment lines, used for capacity"
          action={
            <ProductionLineDialog trigger={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add line</Button>} />
          }
        >
          {linesLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : !lines || lines.length === 0 ? (
            <EmptyState title="No production lines yet" description="Add your first line to get started." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Capacity/day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.capacity_per_day ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={l.status === "active" ? "default" : "secondary"}
                        className="rounded-full capitalize"
                      >
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ProductionLineDialog
                          line={l}
                          trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${l.name}"?`)) {
                              deleteLine.mutate(l.id, {
                                onSuccess: () => toast.success("Production line deleted"),
                                onError: (e) => toast.error(e.message),
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <BatchesSection products={products ?? []} lines={lines ?? []} />
      </div>
    </div>
  );
}
