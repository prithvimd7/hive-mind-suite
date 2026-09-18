import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { EmptyState } from "@/components/app/empty-state";
import { AdSpendDialog } from "@/components/app/ad-spend-dialog";
import { Donut } from "@/components/app/charts";
import { currency } from "@/lib/format";
import { useMarketingData } from "@/hooks/use-marketing-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({ meta: [
    { title: "Marketing — Company OS" },
    { name: "description", content: "Meta, Google and Amazon ads: spend, ROAS, CAC, top campaigns and creatives." },
    { property: "og:title", content: "Marketing — Company OS" },
    { property: "og:description", content: "Cross-platform ad performance in one view." },
  ]}),
  component: Marketing,
});

function Marketing() {
  const { data, isLoading } = useMarketingData(30);

  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Every rupee, every campaign, every platform."
        actions={<AdSpendDialog />}
      />

      {isLoading ? (
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}
        </div>
      ) : !data?.hasData ? (
        <SectionCard title="No ad spend data yet">
          <EmptyState
            title="No ad spend recorded in the last 30 days"
            description="Add an entry manually, or connect Meta / Amazon Ads from Integrations to pull it in automatically."
            ctaLabel="Add ad spend"
            ctaTo="/integrations"
          />
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
            <KpiCard label="Spend"       value={currency(data.totalSpend)} />
            <KpiCard label="Revenue"     value={currency(data.totalRevenue)} />
            <KpiCard label="ROAS"        value={data.roas.toFixed(2) + "x"} />
            <KpiCard label="CAC"         value={data.cac != null ? currency(Math.round(data.cac)) : "—"} />
            <KpiCard label="CTR"         value={data.ctr.toFixed(2) + "%"} />
            <KpiCard label="CPC"         value={currency(Math.round(data.cpc))} />
            <KpiCard label="CPM"         value={currency(Math.round(data.cpm))} />
            <KpiCard label="Conversions" value={String(data.conversions)} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <SectionCard title="Spend distribution" className="lg:col-span-1">
              <Donut data={data.byPlatform} />
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
                  {data.campaigns.map((c) => (
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
        </>
      )}

      <div className="mt-4">
        <SectionCard title="Connect live ad accounts">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground max-w-md">
              Meta Ads and Amazon Ads can sync spend automatically once connected — no manual entry needed.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/integrations">Go to Integrations</Link>
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
