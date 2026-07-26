import { createFileRoute } from "@tanstack/react-router";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { PageHeader } from "@/components/app/page-header";
import { RevenueArea, LineDual, BarsChart } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { revenueTrend, salesForecast, channelSales, topProducts, currency, compact } from "@/lib/mock-data";
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

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Today's Sales"     value={currency(412000)}  delta={8.4}  hint="vs yesterday" />
        <KpiCard label="Yesterday"         value={currency(380000)}  delta={-2.1} />
        <KpiCard label="This Month"        value={currency(8940000)} delta={12.6} />
        <KpiCard label="Year to Date"      value={currency(94200000)} delta={18.3} />
        <KpiCard label="Profit"            value={currency(2340000)} delta={9.2} />
        <KpiCard label="Gross Margin"      value="38.4%" delta={1.4} />
        <KpiCard label="Net Margin"        value="16.8%" delta={0.6} />
        <KpiCard label="Orders"            value={compact(18420)}    delta={11.2} />
        <KpiCard label="Avg Order Value"   value={currency(1284)}    delta={3.1} />
        <KpiCard label="Units Sold"        value={compact(52310)}    delta={6.4} />
        <KpiCard label="Cash Flow"         value={currency(3120000)} delta={4.8} />
        <KpiCard label="Inventory Value"   value={currency(12800000)} delta={-1.2} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Revenue trend" description="Last 30 days vs previous period" className="lg:col-span-2">
          <RevenueArea data={revenueTrend} />
        </SectionCard>
        <SectionCard title="Sales forecast" description="Next 12 months (AI-projected)">
          <LineDual data={salesForecast} />
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Daily target vs actual" description="Today">
          <div className="space-y-4">
            {[
              { label: "Revenue",   pct: 82, val: currency(412000), goal: currency(500000) },
              { label: "Orders",    pct: 71, val: "312", goal: "440" },
              { label: "New leads", pct: 96, val: "48", goal: "50" },
            ].map((t) => (
              <div key={t.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{t.label}</span>
                  <span className="font-medium">{t.val} <span className="text-muted-foreground">/ {t.goal}</span></span>
                </div>
                <Progress value={t.pct} className="h-1.5" />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Weekly & Monthly targets">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Weekly</div>
              <div className="text-2xl font-semibold mt-1">68%</div>
              <Progress value={68} className="h-1.5 mt-2" />
              <div className="text-[11px] text-muted-foreground mt-1">₹28.4L / ₹42L</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Monthly</div>
              <div className="text-2xl font-semibold mt-1">54%</div>
              <Progress value={54} className="h-1.5 mt-2" />
              <div className="text-[11px] text-muted-foreground mt-1">₹89.4L / ₹1.65Cr</div>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Growth (MoM)</span>
            <Badge variant="secondary" className="rounded-full">+12.6%</Badge>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pending payments</span>
            <span className="font-medium">{currency(1820000)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Outstanding receivables</span>
            <span className="font-medium">{currency(3420000)}</span>
          </div>
        </SectionCard>

        <SectionCard title="Top selling products">
          <div className="divide-y">
            {topProducts.map((p, i) => (
              <div key={p.name} className="py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted grid place-items-center text-xs font-semibold">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{compact(p.units)} units · {p.margin}% margin</div>
                </div>
                <div className="text-sm font-semibold">{currency(p.revenue)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Revenue by channel" description="Cross-channel performance">
          <BarsChart data={channelSales} />
        </SectionCard>
      </div>
    </div>
  );
}
