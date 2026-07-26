import { createFileRoute } from "@tanstack/react-router";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { RevenueArea, BarsChart } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { currency, compact } from "@/lib/mock-data";
import { useSalesData } from "@/hooks/use-sales-data";
import { Download, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Executive — Company OS" },
    { name: "description", content: "Executive overview: revenue, profit, orders, cash flow, forecasts." },
    { property: "og:title", content: "Executive — Company OS" },
    { property: "og:description", content: "Executive overview across the business." },
  ]}),
  component: Executive,
});

function Executive() {
  const { data, isLoading } = useSalesData(30);

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        description="Everything happening in your company — right now."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />Last 30 days</Button>
            <Button size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button>
          </>
        }
      />

      {/* Live from Supabase (sales_imports) */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)
        ) : (
          <>
            <KpiCard label="Revenue (30d)" value={currency(data?.totalRevenue ?? 0)} to="/sales" hint="Live" />
            <KpiCard label="Orders (30d)"  value={compact(data?.totalOrders ?? 0)} to="/sales" hint="Live" />
            <KpiCard label="Avg Order Value" value={currency(Math.round(data?.aov ?? 0))} to="/sales" hint="Live" />
            <KpiCard label="Active Channels" value={String(data?.byChannel.length ?? 0)} to="/sales" hint="Live" />
          </>
        )}

        {/* Not backed by real tables yet — clearly flagged rather than shown as confident numbers */}
        <KpiCard label="Profit"          value="—" to="/finance" hint="Needs Finance module" />
        <KpiCard label="Gross Margin"    value="—" to="/finance" hint="Needs Finance module" />
        <KpiCard label="Net Margin"      value="—" to="/finance" hint="Needs Finance module" />
        <KpiCard label="Cash Flow"       value="—" to="/finance" hint="Needs Finance module" />
        <KpiCard label="Inventory Value" value="—" to="/inventory" hint="Needs Inventory module" />
        <KpiCard label="Units Sold"      value="—" to="/production" hint="Needs Production module" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Revenue trend" description="Last 30 days, from real sales entries" className="lg:col-span-2">
          {isLoading ? (
            <Skeleton className="h-[280px] rounded-xl" />
          ) : data?.hasData ? (
            <RevenueArea data={data.revenueTrend} />
          ) : (
            <EmptyState
              title="No sales data yet"
              description="Add a sale or connect a channel to see your revenue trend."
              ctaLabel="Add a sale"
              ctaTo="/entry"
            />
          )}
        </SectionCard>
        <SectionCard title="Sales forecast" description="Coming soon">
          <EmptyState
            title="Forecasting needs more history"
            description="Once a few weeks of real sales data are in, we can project the next 12 months."
          />
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Revenue by channel" description="Cross-channel performance, from real sales entries">
          {isLoading ? (
            <Skeleton className="h-[280px] rounded-xl" />
          ) : data?.hasData ? (
            <BarsChart data={data.byChannel} />
          ) : (
            <EmptyState
              title="No channel data yet"
              description="Revenue by channel will appear here once sales are recorded."
              ctaLabel="Add a sale"
              ctaTo="/entry"
            />
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Other modules">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">Production — not connected</Badge>
            <Badge variant="secondary" className="rounded-full">Inventory — not connected</Badge>
            <Badge variant="secondary" className="rounded-full">Finance — not connected</Badge>
            <Badge variant="secondary" className="rounded-full">CRM — not connected</Badge>
            <Badge variant="secondary" className="rounded-full">Team — not connected</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            These modules still show placeholder layouts until their data tables are built. Ask to have any of these wired up next.
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
