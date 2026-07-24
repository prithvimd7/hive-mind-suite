import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { BarsChart, RevenueArea } from "@/components/app/charts";
import { channelSales, revenueTrend, currency, compact } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/sales")({
  head: () => ({ meta: [
    { title: "Sales — Company OS" },
    { name: "description", content: "Sales across every channel: website, marketplaces, wholesale, distributors." },
    { property: "og:title", content: "Sales — Company OS" },
    { property: "og:description", content: "Sales performance across every channel." },
  ]}),
  component: Sales,
});

function Sales() {
  const total = channelSales.reduce((a, c) => a + c.revenue, 0);
  return (
    <div>
      <PageHeader title="Sales & Revenue" description="Track every channel in one place." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Revenue"          value={currency(total)}    delta={11.2} />
        <KpiCard label="Orders"           value={compact(15386)}     delta={7.4} />
        <KpiCard label="Conversion"       value="4.2%"               delta={0.4} />
        <KpiCard label="AOV"              value={currency(1284)}     delta={2.9} />
        <KpiCard label="Refund rate"      value="2.1%"               delta={-0.3} />
        <KpiCard label="Cancelled"        value="1.4%"               delta={-0.2} />
        <KpiCard label="COD share"        value="38%"                delta={-1.8} />
        <KpiCard label="Payment success"  value="97.6%"              delta={0.5} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Revenue by channel" className="lg:col-span-2">
          <BarsChart data={channelSales} />
        </SectionCard>
        <SectionCard title="Trend (30d)"><RevenueArea data={revenueTrend} /></SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Channel breakdown">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channelSales.map((c) => (
                <TableRow key={c.channel}>
                  <TableCell className="font-medium">{c.channel}</TableCell>
                  <TableCell className="text-right">{currency(c.revenue)}</TableCell>
                  <TableCell className="text-right">{compact(c.orders)}</TableCell>
                  <TableCell className="text-right">{c.conv}%</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={c.conv > 10 ? "default" : "secondary"} className="rounded-full">
                      {c.conv > 10 ? "Growing" : "Steady"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </div>
  );
}
