import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Phone, Mail } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { EmptyState } from "@/components/app/empty-state";
import { RecordDialog, RowActions, EditButton, type Field } from "@/components/app/record-dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contacts, CONTACT_TYPES, STAGES, type Contact } from "@/hooks/use-modules";
import { useRole } from "@/hooks/use-role";
import { currency, isoDaysAgo, shortDate, today } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [
    { title: "CRM — Company OS" },
    { name: "description", content: "Customers, distributors, leads and pipeline in one flow." },
    { property: "og:title", content: "CRM — Company OS" },
    { property: "og:description", content: "Leads, pipeline and deals — clearly." },
  ]}),
  component: CRM,
});

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fields: Field[] = [
  { name: "name", label: "Contact name", required: true },
  { name: "company", label: "Company / store" },
  { name: "contact_type", label: "Type", type: "select", required: true, options: CONTACT_TYPES.map((t) => ({ value: t, label: cap(t) })) },
  { name: "stage", label: "Pipeline stage", type: "select", required: true, options: STAGES.map((s) => ({ value: s, label: cap(s) })) },
  { name: "deal_value", label: "Deal value (₹)", type: "number", required: true, min: 0 },
  { name: "next_follow_up", label: "Next follow-up", type: "date" },
  { name: "phone", label: "Phone" },
  { name: "email", label: "Email", type: "email" },
  { name: "city", label: "City", full: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

function CRM() {
  const { data, isLoading } = contacts.useList();
  const create = contacts.useCreate(), update = contacts.useUpdate(), remove = contacts.useDelete();
  const { role } = useRole();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");

  const rows = useMemo(() => data ?? [], [data]);
  const t = today();

  const stats = useMemo(() => {
    const open = rows.filter((c) => c.stage !== "won" && c.stage !== "lost");
    const won30 = rows.filter((c) => c.stage === "won" && c.updated_at.slice(0, 10) >= isoDaysAgo(30));
    const closed = rows.filter((c) => c.stage === "won" || c.stage === "lost");
    return {
      customers: rows.filter((c) => c.contact_type === "customer").length,
      distributors: rows.filter((c) => c.contact_type === "distributor").length,
      retailers: rows.filter((c) => c.contact_type === "retailer").length,
      openLeads: open.length,
      pipeline: open.reduce((a, c) => a + Number(c.deal_value), 0),
      winRate: closed.length ? (closed.filter((c) => c.stage === "won").length / closed.length) * 100 : null,
      followUps: open.filter((c) => c.next_follow_up && c.next_follow_up <= t).length,
      won30: won30.reduce((a, c) => a + Number(c.deal_value), 0),
    };
  }, [rows, t]);

  const byStage = STAGES.filter((s) => s !== "lost").map((stage) => {
    const inStage = rows.filter((c) => c.stage === stage);
    return { stage, count: inStage.length, value: inStage.reduce((a, c) => a + Number(c.deal_value), 0) };
  });
  const maxStage = Math.max(1, ...byStage.map((s) => s.value));

  const visible = rows.filter((c) => {
    if (type !== "all" && c.contact_type !== type) return false;
    if (!q) return true;
    const hay = `${c.name} ${c.company ?? ""} ${c.city ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const save = (p: Record<string, unknown>, id?: string) => (id ? update.mutateAsync({ id, ...p }) : create.mutateAsync(p as never));
  const setStage = (c: Contact, stage: string) =>
    update.mutate({ id: c.id, stage }, { onSuccess: () => toast.success(`${c.name} → ${cap(stage)}`), onError: (e) => toast.error(e.message) });

  return (
    <div>
      <PageHeader
        title="CRM"
        description="Leads, pipeline, distributors and deals."
        actions={
          <RecordDialog<Contact>
            title="Contact" fields={fields} onSave={save}
            defaults={{ contact_type: "lead", stage: "lead", deal_value: 0 }}
            trigger={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add contact</Button>}
          />
        }
      />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Customers"      value={String(stats.customers)} />
        <KpiCard label="Distributors"   value={String(stats.distributors)} />
        <KpiCard label="Retail stores"  value={String(stats.retailers)} />
        <KpiCard label="Open deals"     value={String(stats.openLeads)} />
        <KpiCard label="Pipeline value" value={currency(stats.pipeline)} hint="Open deals" />
        <KpiCard label="Win rate"       value={stats.winRate === null ? "—" : `${stats.winRate.toFixed(0)}%`} hint="Won ÷ closed" />
        <KpiCard label="Follow-ups due" value={String(stats.followUps)} hint="Today or overdue" />
        <KpiCard label="Won (30d)"      value={currency(stats.won30)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Sales pipeline" description="Deal value by stage">
          <div className="space-y-4">
            {byStage.map((s) => (
              <div key={s.stage}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium">{cap(s.stage)}</span>
                  <span className="text-muted-foreground">
                    {s.count} · <span className="text-foreground font-medium">{currency(s.value)}</span>
                  </span>
                </div>
                <Progress value={(s.value / maxStage) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Contacts"
          className="lg:col-span-2"
          action={
            <div className="flex gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-32 sm:w-44 pl-8 text-xs" />
              </div>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {CONTACT_TYPES.map((t) => <SelectItem key={t} value={t}>{cap(t)}s</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          }
        >
          {isLoading ? <Skeleton className="h-40 rounded-xl" /> : visible.length === 0 ? (
            <EmptyState
              title={rows.length ? "No matches" : "No contacts yet"}
              description={rows.length ? "Try a different search or type." : "Add leads, distributors and retail stores to build your pipeline."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Value</TableHead>
                    <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((c) => {
                    const due = c.next_follow_up && c.next_follow_up <= t && c.stage !== "won" && c.stage !== "lost";
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {[c.company, c.city].filter(Boolean).join(" · ") || "—"}
                            {c.phone && <a href={`tel:${c.phone}`} aria-label="Call"><Phone className="h-3 w-3" /></a>}
                            {c.email && <a href={`mailto:${c.email}`} aria-label="Email"><Mail className="h-3 w-3" /></a>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell capitalize text-muted-foreground">{c.contact_type}</TableCell>
                        <TableCell>
                          <Select value={c.stage} onValueChange={(v) => setStage(c, v)}>
                            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STAGES.map((s) => <SelectItem key={s} value={s} className="text-xs">{cap(s)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{currency(Number(c.deal_value))}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {c.next_follow_up ? (
                            <Badge variant={due ? "destructive" : "secondary"} className={cn("rounded-full", !due && "font-normal")}>
                              {shortDate(c.next_follow_up)}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            label={c.name}
                            editTrigger={<RecordDialog<Contact> title="Contact" fields={fields} record={c} onSave={save} trigger={<EditButton />} />}
                            onDelete={role === "ceo" ? () => remove.mutate(c.id, { onError: (e) => toast.error(e.message) }) : undefined}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
