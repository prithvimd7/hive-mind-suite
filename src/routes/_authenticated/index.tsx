import { createFileRoute, Link } from "@tanstack/react-router";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { RevenueArea, BarsChart, LineDual } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { currency, compact, pct, delta } from "@/lib/format";
import { useSalesData } from "@/hooks/use-sales-data";
import { useBusinessSnapshot } from "@/hooks/use-business-snapshot";
import { exportSalesCsv } from "@/lib/csv-export";
import { Download, AlertTriangle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const snap = useBusinessSnapshot();
  const s = snap.data;
  const loading = isLoading || snap.isLoading;

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        description="Last 30 days across sales, marketing, production, inventory and finance."
        actions={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => exportSalesCsv(90).catch((e) => toast.error(e.message))}
          >
            <Download className="h-3.5 w-3.5" />Export sales
          </Button>
        }
      />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {loading || !s ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)
        ) : (
          <>
            <KpiCard label="Revenue (30d)"   value={currency(s.revenue)} delta={delta(s.revenue, s.prevRevenue)} to="/sales" hint="vs previous 30d" />
            <KpiCard label="Orders (30d)"    value={compact(s.orders)} to="/sales" />
            <KpiCard label="Avg Order Value" value={currency(Math.round(data?.aov ?? 0))} to="/sales" />
            <KpiCard label="Net Profit"      value={currency(s.netProfit)} to="/finance" hint="Revenue − expenses − ad spend" />
            <KpiCard label="Gross Margin"    value={pct(s.grossMargin)} to="/finance" hint={s.cogs ? "After COGS expenses" : "Log COGS expenses to refine"} />
            <KpiCard label="Net Margin"      value={pct(s.netMargin)} to="/finance" />
            <KpiCard label="Cash Flow (30d)" value={currency(s.cashFlow)} to="/finance" hint="Sales − paid bills − ads" />
            <KpiCard label="Ad Spend (30d)"  value={currency(s.adSpend)} to="/marketing" />
            <KpiCard label="Inventory Value" value={currency(s.inventoryValue)} to="/inventory" hint="Stock × unit cost" />
            <KpiCard label="Units Produced"  value={compact(s.unitsProduced)} delta={delta(s.unitsProduced, s.prevUnitsProduced)} to="/production" hint="Last 30 days" />
            <KpiCard label="Receivables"     value={currency(s.receivables)} to="/finance" hint="Unpaid invoices" />
            <KpiCard label="Payables"        value={currency(s.payables)} to="/finance" hint="Unpaid bills" />
          </>
        )}
      </div>

      {s && s.alerts.length > 0 && (
        <div className="mt-6">
          <SectionCard title="Needs attention" description={`${s.alerts.length} item${s.alerts.length === 1 ? "" : "s"} across the business`}>
            <div className="divide-y">
              {s.alerts.slice(0, 6).map((a) => (
                <Link key={a.id} to={a.to} className="flex items-center gap-3 py-2.5 group">
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4 shrink-0",
                      a.kind === "destructive" ? "text-destructive" : a.kind === "warning" ? "text-[color:var(--warning)]" : "text-muted-foreground",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    {a.detail && <div className="text-xs text-muted-foreground truncate">{a.detail}</div>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

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
        <SectionCard
          title="Sales forecast"
          description={s?.forecast ? `Next 30 days: ${currency(s.forecast.next30)}` : "Linear trend on daily revenue"}
        >
          {snap.isLoading ? (
            <Skeleton className="h-[280px] rounded-xl" />
          ) : s?.forecast ? (
            <>
              <LineDual data={s.forecast.series} />
              <div className="mt-2 text-xs text-muted-foreground">
                Trend from {s.forecast.daysOfHistory} days of history — revenue is {s.forecast.dailySlope >= 0 ? "rising" : "falling"} by about{" "}
                {currency(Math.abs(Math.round(s.forecast.dailySlope)))}/day. Dashed line is the fitted trend.
              </div>
            </>
          ) : (
            <EmptyState
              title="Forecast needs 2+ weeks of sales"
              description="Once 14 days of sales history are recorded, a 30-day projection appears here."
            />
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Revenue by channel" description="Last 30 days">
          {isLoading ? (
            <Skeleton className="h-[280px] rounded-xl" />
          ) : data?.hasData ? (
            <BarsChart data={data.byChannel} />
          ) : (
            <EmptyState title="No channel data yet" description="Revenue by channel will appear here once sales are recorded." ctaLabel="Add a sale" ctaTo="/entry" />
          )}
        </SectionCard>
        <SectionCard title="Cash in vs out" description="Daily: sales (solid) vs paid bills + ad spend (dashed)">
          {snap.isLoading ? <Skeleton className="h-[280px] rounded-xl" /> : <RevenueArea data={s?.cashTrend ?? []} />}
        </SectionCard>
      </div>
    </div>
  );
}
