import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { StackedRevenue, RevenueArea } from "@/components/app/charts";
import { financePnL, revenueTrend, currency } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [
    { title: "Finance — Company OS" },
    { name: "description", content: "Revenue, expenses, cash flow, receivables, EBITDA and monthly P&L." },
    { property: "og:title", content: "Finance — Company OS" },
    { property: "og:description", content: "P&L, cash flow, receivables in one view." },
  ]}),
  component: Finance,
});

function Finance() {
  return (
    <div>
      <PageHeader title="Finance" description="P&L, cash flow, receivables and payables." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Revenue"           value={currency(9420000)} delta={12.6} />
        <KpiCard label="Expenses"          value={currency(6280000)} delta={7.2} />
        <KpiCard label="Net profit"        value={currency(1580000)} delta={18.4} />
        <KpiCard label="EBITDA"            value={currency(2340000)} delta={14.2} />
        <KpiCard label="GST payable"       value={currency(680000)} />
        <KpiCard label="Receivables"       value={currency(3420000)} delta={-2.1} />
        <KpiCard label="Payables"          value={currency(1810000)} delta={4.4} />
        <KpiCard label="Bank balance"      value={currency(4820000)} delta={6.8} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Monthly P&L" className="lg:col-span-2">
          <StackedRevenue data={financePnL} />
        </SectionCard>
        <SectionCard title="Cash flow (30d)">
          <RevenueArea data={revenueTrend} />
        </SectionCard>
      </div>
    </div>
  );
}
