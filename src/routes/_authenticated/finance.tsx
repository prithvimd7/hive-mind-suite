import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { EmptyState } from "@/components/app/empty-state";
import { StackedRevenue, RevenueArea } from "@/components/app/charts";
import { RecordDialog, RowActions, EditButton, type Field } from "@/components/app/record-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusinessSnapshot } from "@/hooks/use-business-snapshot";
import {
  expenses, invoices, EXPENSE_CATEGORIES, COGS_CATEGORIES, isInvoiceOverdue, type Expense, type Invoice,
} from "@/hooks/use-modules";
import { currency, delta, pct, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [
    { title: "Finance — Company OS" },
    { name: "description", content: "Revenue, expenses, cash flow, receivables, EBITDA and monthly P&L." },
    { property: "og:title", content: "Finance — Company OS" },
    { property: "og:description", content: "P&L, cash flow, receivables in one view." },
  ]}),
  component: Finance,
});

const expenseFields: Field[] = [
  { name: "expense_date", label: "Date", type: "date", required: true },
  { name: "category", label: "Category", type: "select", required: true, options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
  { name: "vendor", label: "Vendor", placeholder: "Supplier name" },
  { name: "amount", label: "Amount (₹, excl. GST)", type: "number", required: true, min: 0 },
  { name: "gst_amount", label: "GST (₹)", type: "number", required: true, min: 0 },
  { name: "is_cogs", label: "Counts as COGS", type: "switch" },
  { name: "status", label: "Status", type: "select", required: true, options: [{ value: "paid", label: "Paid" }, { value: "unpaid", label: "Unpaid" }] },
  { name: "due_date", label: "Due date", type: "date" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const invoiceFields: Field[] = [
  { name: "invoice_no", label: "Invoice #", required: true, placeholder: "INV-1024" },
  { name: "customer", label: "Customer", required: true, placeholder: "Distributor / retailer" },
  { name: "issue_date", label: "Issued", type: "date", required: true },
  { name: "due_date", label: "Due", type: "date" },
  { name: "amount", label: "Amount (₹, excl. GST)", type: "number", required: true, min: 0 },
  { name: "gst_amount", label: "GST (₹)", type: "number", required: true, min: 0 },
  {
    name: "status", label: "Status", type: "select", required: true,
    options: [{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "paid", label: "Paid" }],
  },
  { name: "paid_on", label: "Paid on", type: "date" },
  { name: "notes", label: "Notes", type: "textarea" },
];

function Finance() {
  const snap = useBusinessSnapshot();
  const s = snap.data;
  const exp = expenses.useList();
  const inv = invoices.useList();
  const createExp = expenses.useCreate(), updateExp = expenses.useUpdate(), removeExp = expenses.useDelete();
  const createInv = invoices.useCreate(), updateInv = invoices.useUpdate(), removeInv = invoices.useDelete();

  const saveExpense = (p: Record<string, unknown>, id?: string) =>
    id ? updateExp.mutateAsync({ id, ...p }) : createExp.mutateAsync(p as never);
  const saveInvoice = (p: Record<string, unknown>, id?: string) => {
    if (p.status === "paid" && !p.paid_on) p.paid_on = today();
    return id ? updateInv.mutateAsync({ id, ...p }) : createInv.mutateAsync(p as never);
  };
  // Picking a category pre-sets the COGS switch; the user can still override it.
  const onExpenseChange = (name: string, value: string | boolean, values: Record<string, string | boolean>) =>
    name === "category" ? { ...values, is_cogs: COGS_CATEGORIES.has(String(value)) } : values;

  const ebitda = s ? s.netProfit : 0; // no depreciation/interest/tax tracked separately yet, so EBITDA == operating profit here

  return (
    <div>
      <PageHeader
        title="Finance"
        description="P&L, cash flow, receivables and payables — last 30 days."
        actions={
          <>
            <RecordDialog<Invoice>
              title="Invoice" fields={invoiceFields} onSave={saveInvoice}
              defaults={{ issue_date: today(), status: "sent", amount: 0, gst_amount: 0 }}
              trigger={<Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Invoice</Button>}
            />
            <RecordDialog<Expense>
              title="Expense" fields={expenseFields} onSave={saveExpense} onChange={onExpenseChange}
              defaults={{ expense_date: today(), status: "paid", amount: 0, gst_amount: 0, is_cogs: false }}
              trigger={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Expense</Button>}
            />
          </>
        }
      />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        {!s ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)
        ) : (
          <>
            <KpiCard label="Revenue"      value={currency(s.revenue)} delta={delta(s.revenue, s.prevRevenue)} to="/sales" />
            <KpiCard label="Expenses"     value={currency(s.expenses + s.adSpend)} hint={`incl. ${currency(s.adSpend)} ad spend`} />
            <KpiCard label="Net profit"   value={currency(s.netProfit)} hint={`Net margin ${pct(s.netMargin)}`} />
            <KpiCard label="EBITDA"       value={currency(ebitda)} hint="Operating profit" />
            <KpiCard label="Gross margin" value={pct(s.grossMargin)} hint={`COGS ${currency(s.cogs)}`} />
            <KpiCard label="GST payable"  value={currency(Math.max(0, s.gstPayable))} hint={s.gstPayable < 0 ? `Input credit ${currency(-s.gstPayable)}` : "Output − input GST"} />
            <KpiCard label="Receivables"  value={currency(s.receivables)} hint="Unpaid invoices" />
            <KpiCard label="Payables"     value={currency(s.payables)} hint="Unpaid bills" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Monthly P&L" description="Revenue vs expenses + ad spend, last 6 months" className="lg:col-span-2">
          {s ? <StackedRevenue data={s.monthlyPnL} /> : <Skeleton className="h-[280px] rounded-xl" />}
        </SectionCard>
        <SectionCard title="Cash flow (30d)" description={s ? `Net ${currency(s.cashFlow)} · in solid, out dashed` : undefined}>
          {s ? <RevenueArea data={s.cashTrend} /> : <Skeleton className="h-[280px] rounded-xl" />}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard title="Invoices" description="Receivables from distributors, retailers and B2B customers">
          {inv.isLoading ? <Skeleton className="h-40 rounded-xl" /> : !inv.data?.length ? (
            <EmptyState title="No invoices yet" description="Add invoices to track receivables and overdue payments." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden sm:table-cell">Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.data.map((i) => {
                    const overdue = isInvoiceOverdue(i);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.invoice_no}</TableCell>
                        <TableCell className="font-medium">{i.customer}</TableCell>
                        <TableCell className="text-right">{currency(Number(i.amount) + Number(i.gst_amount))}</TableCell>
                        <TableCell className="hidden sm:table-cell">{shortDate(i.due_date)}</TableCell>
                        <TableCell>
                          <Badge variant={overdue ? "destructive" : i.status === "paid" ? "default" : "secondary"} className="rounded-full capitalize">
                            {overdue ? "Overdue" : i.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {i.status !== "paid" && (
                              <Button
                                size="icon" variant="ghost" className="h-8 w-8" aria-label="Mark paid" title="Mark paid"
                                onClick={() => updateInv.mutate({ id: i.id, status: "paid", paid_on: today() }, { onSuccess: () => toast.success("Marked paid") })}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <RowActions
                              label={i.invoice_no}
                              editTrigger={<RecordDialog<Invoice> title="Invoice" fields={invoiceFields} record={i} onSave={saveInvoice} trigger={<EditButton />} />}
                              onDelete={() => removeInv.mutate(i.id, { onError: (e) => toast.error(e.message) })}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Expenses" description="Bills, salaries, rent, raw materials…">
          {exp.isLoading ? <Skeleton className="h-40 rounded-xl" /> : !exp.data?.length ? (
            <EmptyState title="No expenses yet" description="Log expenses to unlock profit, margin and cash-flow numbers." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Vendor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exp.data.slice(0, 100).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{shortDate(e.expense_date)}</TableCell>
                      <TableCell>
                        {e.category}
                        {e.is_cogs && <Badge variant="outline" className="ml-1.5 rounded-full text-[10px]">COGS</Badge>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{e.vendor ?? "—"}</TableCell>
                      <TableCell className="text-right">{currency(Number(e.amount))}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === "paid" ? "default" : "secondary"} className="rounded-full capitalize">{e.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {e.status === "unpaid" && (
                            <Button
                              size="icon" variant="ghost" className="h-8 w-8" aria-label="Mark paid" title="Mark paid"
                              onClick={() => updateExp.mutate({ id: e.id, status: "paid" }, { onSuccess: () => toast.success("Marked paid") })}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <RowActions
                            label={`${e.category} ${currency(Number(e.amount))}`}
                            editTrigger={<RecordDialog<Expense> title="Expense" fields={expenseFields} record={e} onSave={saveExpense} onChange={onExpenseChange} trigger={<EditButton />} />}
                            onDelete={() => removeExp.mutate(e.id, { onError: (err) => toast.error(err.message) })}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
