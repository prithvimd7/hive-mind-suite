import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { EmptyState } from "@/components/app/empty-state";
import { RecordDialog, RowActions, EditButton, type Field } from "@/components/app/record-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { team, type TeamMember } from "@/hooks/use-modules";
import { currency } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [
    { title: "Team — Company OS" },
    { name: "description", content: "Attendance, KPIs, targets and a live team leaderboard." },
    { property: "og:title", content: "Team — Company OS" },
    { property: "og:description", content: "HR, KPIs and performance." },
  ]}),
  component: Team,
});

const ATTENDANCE = [
  { value: "present", label: "Present" },
  { value: "leave", label: "On leave" },
  { value: "absent", label: "Absent" },
];

const fields: Field[] = [
  { name: "name", label: "Name", required: true },
  { name: "role", label: "Role" },
  { name: "department", label: "Department" },
  { name: "attendance", label: "Today", type: "select", required: true, options: ATTENDANCE },
  { name: "kpi_score", label: "KPI score (0–100)", type: "number", required: true, min: 0, max: 100 },
  { name: "monthly_target", label: "Monthly target (₹)", type: "number", min: 0 },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "joined_on", label: "Joined on", type: "date" },
  { name: "is_active", label: "Active employee", type: "switch" },
];

function Team() {
  const { data, isLoading } = team.useList();
  const create = team.useCreate(), update = team.useUpdate(), remove = team.useDelete();
  const members = (data ?? []).filter((m) => m.is_active);
  const sorted = [...members].sort((a, b) => b.kpi_score - a.kpi_score);
  const count = (a: string) => members.filter((m) => m.attendance === a).length;
  const avgKpi = members.length ? Math.round(members.reduce((a, m) => a + m.kpi_score, 0) / members.length) : null;

  const save = (p: Record<string, unknown>, id?: string) => (id ? update.mutateAsync({ id, ...p }) : create.mutateAsync(p as never));
  const setAttendance = (m: TeamMember, attendance: string) =>
    update.mutate({ id: m.id, attendance }, { onError: (e) => toast.error(e.message) });

  return (
    <div>
      <PageHeader
        title="Team & HR"
        description="Attendance, KPIs and performance."
        actions={
          <RecordDialog<TeamMember>
            title="Team member" fields={fields} onSave={save}
            defaults={{ attendance: "present", kpi_score: 0, is_active: true }}
            trigger={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add member</Button>}
          />
        }
      />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Team size" value={String(members.length)} />
        <KpiCard label="Present"   value={String(count("present"))} hint={members.length ? `${Math.round((count("present") / members.length) * 100)}% attendance` : undefined} />
        <KpiCard label="On leave"  value={String(count("leave"))} hint={count("absent") ? `${count("absent")} absent` : undefined} />
        <KpiCard label="Avg KPI"   value={avgKpi === null ? "—" : String(avgKpi)} />
      </div>

      <div className="mt-6">
        <SectionCard title="Leaderboard" description="Ranked by KPI score — set attendance for today from the dropdown">
          {isLoading ? <Skeleton className="h-40 rounded-xl" /> : sorted.length === 0 ? (
            <EmptyState title="No team members yet" description="Add your team to track attendance and KPIs." />
          ) : (
            <div className="divide-y">
              {sorted.map((m, i) => (
                <div key={m.id} className="py-3 flex items-center gap-3">
                  <div className="text-sm font-semibold w-6 text-muted-foreground">{i + 1}</div>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          m.attendance === "present" ? "bg-[color:var(--success)]" : m.attendance === "leave" ? "bg-[color:var(--warning)]" : "bg-destructive",
                        )}
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[m.role, m.department].filter(Boolean).join(" · ") || "—"}
                      {m.monthly_target ? ` · target ${currency(Number(m.monthly_target))}` : ""}
                    </div>
                  </div>
                  <Select value={m.attendance} onValueChange={(v) => setAttendance(m, v)}>
                    <SelectTrigger className="h-7 w-[96px] text-xs hidden sm:flex"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE.map((a) => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="w-28 hidden md:block"><Progress value={m.kpi_score} className="h-1.5" /></div>
                  <Badge variant="secondary" className="rounded-full">{m.kpi_score}</Badge>
                  <RowActions
                    label={m.name}
                    editTrigger={<RecordDialog<TeamMember> title="Team member" fields={fields} record={m} onSave={save} trigger={<EditButton />} />}
                    onDelete={() => remove.mutate(m.id, { onError: (e) => toast.error(e.message) })}
                  />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
