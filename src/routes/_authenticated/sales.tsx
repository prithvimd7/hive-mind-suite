import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { EmptyState } from "@/components/app/empty-state";
import { BarsChart, RevenueArea } from "@/components/app/charts";
import { currency, compact } from "@/lib/mock-data";
import { useSalesData } from "@/hooks/use-sales-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [
    { title: "Sales — Company OS" },
    { name: "description", content: "Sales across every channel: website, marketplaces, wholesale, distributors." },
    { property: "og:title", content: "Sales — Company OS" },
    { property: "og:description", content: "Sales performance across every channel." },
  ]}),
  component: Sales,
});

function Sales() {
  const { data, isLoading } = useSalesData(30);

  return (
    <div>
      <PageHeader title="Sales & Revenue" description="Track every channel in one place." />

      {isLoading ? (
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}
        </div>
      ) : !data?.hasData ? (
        <SectionCard title="No sales data yet">
          <EmptyState
            title="No sales recorded in the last 30 days"
            description="Add entries manually or connect Shopify / Amazon / Blinkit from Integrations to see real revenue here."
            ctaLabel="Add a sale"
            ctaTo="/entry"
          />
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
            <KpiCard label="Revenue"  value={currency(data.totalRevenue)} to="/finance" />
            <KpiCard label="Orders"   value={compact(data.totalOrders)} />
            <KpiCard label="AOV"      value={currency(Math.round(data.aov))} />
            <KpiCard label="Channels" value={String(data.byChannel.length)} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <SectionCard title="Revenue by channel" className="lg:col-span-2">
              <BarsChart data={data.byChannel} />
            </SectionCard>
            <SectionCard title="Trend (30d)"><RevenueArea data={data.revenueTrend} /></SectionCard>
          </div>

          <div className="mt-4">
            <SectionCard title="Channel breakdown">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byChannel.map((c) => (
                    <TableRow key={c.channel}>
                      <TableCell className="font-medium">{c.channel}</TableCell>
                      <TableCell className="text-right">{currency(c.revenue)}</TableCell>
                      <TableCell className="text-right">{compact(c.orders)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
