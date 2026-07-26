import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { inventory, currency, compact } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [
    { title: "Inventory — Company OS" },
    { name: "description", content: "Raw materials, finished goods, batches, reorder alerts and dead stock." },
    { property: "og:title", content: "Inventory — Company OS" },
    { property: "og:description", content: "Complete inventory visibility across the warehouse." },
  ]}),
  component: Inventory,
});

function Inventory() {
  return (
    <div>
      <PageHeader title="Inventory" description="Stock, batches, expiry and reorder alerts." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Inventory value" value={currency(12800000)} delta={-1.2} />
        <KpiCard label="SKUs"            value={compact(342)} />
        <KpiCard label="Low stock"       value="14" delta={2.4} />
        <KpiCard label="Dead stock"      value={currency(320000)} delta={-8.1} />
        <KpiCard label="Raw materials"   value={currency(3800000)} />
        <KpiCard label="Finished goods"  value={currency(7900000)} />
        <KpiCard label="Packaging"       value={currency(1100000)} />
        <KpiCard label="Fast movers"     value="86 SKUs" delta={4.1} />
      </div>

      <div className="mt-6">
        <SectionCard title="Stock levels">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="w-40">Level</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((i) => {
                const pct = Math.min(100, Math.round((i.stock / (i.min * 3)) * 100));
                return (
                  <TableRow key={i.sku}>
                    <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="text-muted-foreground">{i.type}</TableCell>
                    <TableCell className="text-right">{i.stock.toLocaleString()}</TableCell>
                    <TableCell><Progress value={pct} className="h-1.5" /></TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={i.status === "critical" ? "destructive" : i.status === "low" ? "secondary" : "default"}
                        className="rounded-full"
                      >
                        {i.status === "critical" ? "Critical" : i.status === "low" ? "Low" : "OK"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </div>
  );
}
