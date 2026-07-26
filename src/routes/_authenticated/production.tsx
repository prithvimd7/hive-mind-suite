import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { LineDual, Heatmap } from "@/components/app/charts";
import { production, currency } from "@/lib/mock-data";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({ meta: [
    { title: "Production — Company OS" },
    { name: "description", content: "Daily production, batches, yield, protein %, downtime and quality." },
    { property: "og:title", content: "Production — Company OS" },
    { property: "og:description", content: "Factory floor performance and quality." },
  ]}),
  component: Production,
});

function Production() {
  return (
    <div>
      <PageHeader title="Production" description="Batches, yield, machines and quality." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Today's production" value="2,140 units" delta={4.2} />
        <KpiCard label="Batches today"      value="14" />
        <KpiCard label="Machine util."      value="86%" delta={2.1} />
        <KpiCard label="Production cost"    value={currency(18.4)} hint="per unit" />
        <KpiCard label="Yield"              value="94.2%" delta={0.8} />
        <KpiCard label="Protein"            value="22.4%" delta={0.3} />
        <KpiCard label="Rejected"           value="1.6%" delta={-0.4} />
        <KpiCard label="Downtime"           value="42 min" delta={-12.4} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Daily production" description="Actual vs plan (14 days)" className="lg:col-span-2">
          <LineDual data={production} />
        </SectionCard>
        <SectionCard title="Quality checks" description="Pass rate by station">
          <div className="space-y-3">
            {[
              { label: "Mixing",  v: 98 },
              { label: "Cooking", v: 96 },
              { label: "Retort",  v: 94 },
              { label: "Packing", v: 99 },
              { label: "Sealing", v: 97 },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{s.label}</span><span className="font-medium">{s.v}%</span></div>
                <Progress value={s.v} className="h-1.5" />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Machine utilization heatmap" description="Last 7 days · 24 hours">
          <Heatmap />
        </SectionCard>
      </div>
    </div>
  );
}
