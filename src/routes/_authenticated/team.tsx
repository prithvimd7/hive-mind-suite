import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { team } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [
    { title: "Team — Company OS" },
    { name: "description", content: "Attendance, KPIs, targets and a live team leaderboard." },
    { property: "og:title", content: "Team — Company OS" },
    { property: "og:description", content: "HR, KPIs and performance." },
  ]}),
  component: Team,
});

function Team() {
  const sorted = [...team].sort((a, b) => b.score - a.score);
  return (
    <div>
      <PageHeader title="Team & HR" description="Attendance, KPIs and performance." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Team size"    value="64" />
        <KpiCard label="Present"      value="58" delta={2.1} />
        <KpiCard label="On leave"     value="4" />
        <KpiCard label="Avg KPI"      value="82" delta={3.4} />
      </div>

      <div className="mt-6">
        <SectionCard title="Leaderboard" description="Performance score this month">
          <div className="divide-y">
            {sorted.map((m, i) => (
              <div key={m.name} className="py-3 flex items-center gap-3">
                <div className="text-sm font-semibold w-6 text-muted-foreground">{i + 1}</div>
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{m.name.split(" ").map((w) => w[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        m.status === "online" ? "bg-[color:var(--success)]" : m.status === "away" ? "bg-[color:var(--warning)]" : "bg-muted-foreground",
                      )}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground">{m.role}</div>
                </div>
                <div className="w-36 hidden sm:block">
                  <Progress value={m.score} className="h-1.5" />
                </div>
                <Badge variant="secondary" className="rounded-full">{m.score}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
