import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { Donut } from "@/components/app/charts";
import { campaigns, currency } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/marketing")({
  head: () => ({ meta: [
    { title: "Marketing — Company OS" },
    { name: "description", content: "Meta, Google and Amazon ads: spend, ROAS, CAC, top campaigns and creatives." },
    { property: "og:title", content: "Marketing — Company OS" },
    { property: "og:description", content: "Cross-platform ad performance in one view." },
  ]}),
  component: Marketing,
});

function Marketing() {
  const spend = campaigns.reduce((a, c) => a + c.spend, 0);
  const revenue = campaigns.reduce((a, c) => a + c.revenue, 0);
  const donut = campaigns.map((c) => ({ label: c.name.split("—")[0].trim(), value: c.spend }));

  return (
    <div>
      <PageHeader title="Marketing" description="Every rupee, every campaign, every platform." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Spend"        value={currency(spend)}   delta={6.2} />
        <KpiCard label="Revenue"      value={currency(revenue)} delta={12.8} />
        <KpiCard label="ROAS"         value={(revenue / spend).toFixed(2) + "x"} delta={3.1} />
        <KpiCard label="CAC"          value={currency(412)}     delta={-4.6} />
        <KpiCard label="CTR"          value="2.8%"              delta={0.3} />
        <KpiCard label="CPC"          value={currency(9.4)}     delta={-1.1} />
        <KpiCard label="CPM"          value={currency(184)}     delta={0.8} />
        <KpiCard label="Conversions"  value="4,218"             delta={9.4} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Spend distribution" className="lg:col-span-1">
          <Donut data={donut} />
        </SectionCard>

        <SectionCard title="Campaigns" className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{currency(c.spend)}</TableCell>
                  <TableCell className="text-right">{currency(c.revenue)}</TableCell>
                  <TableCell className="text-right">{c.roas.toFixed(1)}x</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={c.roas >= 4 ? "default" : c.roas >= 2.5 ? "secondary" : "destructive"}
                      className="rounded-full"
                    >
                      {c.roas >= 4 ? "Winner" : c.roas >= 2.5 ? "OK" : "Cut"}
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
