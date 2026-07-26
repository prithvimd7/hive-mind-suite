import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { pipeline, currency, compact } from "@/lib/mock-data";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [
    { title: "CRM — Company OS" },
    { name: "description", content: "Customers, distributors, leads and pipeline in one flow." },
    { property: "og:title", content: "CRM — Company OS" },
    { property: "og:description", content: "Leads, pipeline and deals — clearly." },
  ]}),
  component: CRM,
});

function CRM() {
  const total = pipeline.reduce((a, s) => a + s.value, 0);
  return (
    <div>
      <PageHeader title="CRM" description="Leads, pipeline, distributors and deals." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Customers"      value={compact(28420)} delta={4.2} />
        <KpiCard label="Distributors"   value="84" delta={2.4} />
        <KpiCard label="Retail stores"  value="1,240" delta={6.1} />
        <KpiCard label="Leads (open)"   value={compact(148)} delta={12.4} />
        <KpiCard label="Pipeline value" value={currency(total)} delta={9.6} />
        <KpiCard label="Conversion"     value="18.6%" delta={1.2} />
        <KpiCard label="Follow-ups due" value="42" />
        <KpiCard label="Meetings"       value="18" hint="this week" />
      </div>

      <div className="mt-6">
        <SectionCard title="Sales pipeline" description="Deals by stage">
          <div className="space-y-4">
            {pipeline.map((s, i) => {
              const pct = 100 - i * 18;
              return (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{s.stage}</span>
                    <span className="text-muted-foreground">{s.count} deals · <span className="text-foreground font-medium">{currency(s.value)}</span></span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
