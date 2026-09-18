import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isoDaysAgo, localIso } from "@/lib/format";
import { isCriticalStock, isInvoiceOverdue, isLowStock, today, type InventoryItem, type Invoice } from "./use-modules";

export interface Alert {
  id: string;
  title: string;
  detail?: string;
  kind: "warning" | "destructive" | "info" | "success";
  to: string;
}

export interface BusinessSnapshot {
  // 30-day window vs the 30 days before it
  revenue: number;
  prevRevenue: number;
  orders: number;
  adSpend: number;
  expenses: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number | null;
  netMargin: number | null;
  /** Cash in (sales) minus cash out (paid expenses + ad spend) over the window. */
  cashFlow: number;
  unitsProduced: number;
  prevUnitsProduced: number;
  inventoryValue: number;
  receivables: number;
  payables: number;
  gstPayable: number;
  /** Daily cash in/out for the window, for charting. */
  cashTrend: { label: string; value: number; secondary: number }[];
  /** Last 6 calendar months: revenue vs total costs (expenses + ad spend). */
  monthlyPnL: { month: string; revenue: number; expense: number }[];
  forecast: Forecast | null;
  alerts: Alert[];
}

export interface Forecast {
  /** Actual daily revenue for the history window followed by projected days. */
  series: { label: string; value?: number; secondary?: number }[];
  next30: number;
  dailySlope: number;
  daysOfHistory: number;
}

const MIN_FORECAST_DAYS = 14;

/**
 * Least-squares linear trend over daily revenue (missing days count as zero),
 * projected forward 30 days. Deliberately simple and explainable — it's a trend line, not a model.
 */
export function buildForecast(daily: Map<string, number>, historyDays: number): Forecast | null {
  const days: { date: string; value: number }[] = [];
  for (let i = historyDays - 1; i >= 0; i--) {
    const d = isoDaysAgo(i);
    days.push({ date: d, value: daily.get(d) ?? 0 });
  }
  const firstSale = days.findIndex((d) => d.value > 0);
  if (firstSale === -1) return null;
  const hist = days.slice(firstSale);
  if (hist.length < MIN_FORECAST_DAYS) return null;

  const n = hist.length;
  const xs = hist.map((_, i) => i);
  const ys = hist.map((d) => d.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  const at = (x: number) => Math.max(0, intercept + slope * x);

  const series: Forecast["series"] = hist.map((d, i) => ({ label: d.date.slice(5), value: d.value, secondary: Math.round(at(i)) }));
  let next30 = 0;
  for (let k = 1; k <= 30; k++) {
    const dt = new Date();
    dt.setDate(dt.getDate() + k);
    const v = Math.round(at(n - 1 + k));
    next30 += v;
    series.push({ label: localIso(dt).slice(5), secondary: v });
  }
  return { series, next30, dailySlope: slope, daysOfHistory: n };
}

function sum<T>(rows: T[] | null | undefined, f: (r: T) => number) {
  return (rows ?? []).reduce((a, r) => a + (Number(f(r)) || 0), 0);
}

export function buildAlerts(input: {
  inventory: InventoryItem[];
  invoices: Invoice[];
  unpaidExpenses: { id: string; vendor: string | null; category: string; amount: number; due_date: string | null }[];
  followUps: { id: string; name: string; company: string | null; next_follow_up: string | null }[];
  failedBatches: { id: string; batch_code: string; batch_date: string }[];
}): Alert[] {
  const t = today();
  const alerts: Alert[] = [];
  for (const i of input.inventory.filter(isLowStock)) {
    alerts.push({
      id: `stock-${i.id}`,
      title: `${isCriticalStock(i) ? "Critical" : "Low"} stock: ${i.name}`,
      detail: `${Number(i.stock)} ${i.unit} left (reorder at ${Number(i.reorder_level)})`,
      kind: isCriticalStock(i) ? "destructive" : "warning",
      to: "/inventory",
    });
  }
  for (const inv of input.invoices.filter(isInvoiceOverdue)) {
    alerts.push({ id: `inv-${inv.id}`, title: `Invoice ${inv.invoice_no} overdue`, detail: `${inv.customer} · due ${inv.due_date}`, kind: "destructive", to: "/finance" });
  }
  for (const e of input.unpaidExpenses.filter((e) => e.due_date && e.due_date <= t)) {
    alerts.push({ id: `exp-${e.id}`, title: `Bill due: ${e.vendor ?? e.category}`, detail: `Due ${e.due_date}`, kind: "warning", to: "/finance" });
  }
  for (const c of input.followUps) {
    alerts.push({
      id: `fu-${c.id}`,
      title: `Follow up: ${c.name}${c.company ? ` (${c.company})` : ""}`,
      detail: c.next_follow_up! < t ? `Overdue since ${c.next_follow_up}` : "Due today",
      kind: "info",
      to: "/crm",
    });
  }
  for (const b of input.failedBatches) {
    alerts.push({ id: `qc-${b.id}`, title: `Batch ${b.batch_code} failed QC`, detail: b.batch_date, kind: "destructive", to: "/production" });
  }
  const rank = { destructive: 0, warning: 1, info: 2, success: 3 } as const;
  return alerts.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** Pulls every module's data for the last 60–180 days and derives the cross-functional numbers. */
export async function fetchBusinessSnapshot(): Promise<BusinessSnapshot> {
  const d30 = isoDaysAgo(30), d60 = isoDaysAgo(60), d90 = isoDaysAgo(90);
  const monthStart = new Date();
  monthStart.setMonth(monthStart.getMonth() - 5, 1);
  const d6m = localIso(monthStart);
  const since = d6m < d90 ? d6m : d90;
  const t = today();

  const [sales, ads, exps, batchesRes, inv, invs, fu] = await Promise.all([
    supabase.from("sales_imports").select("order_date, revenue, orders").gte("order_date", since),
    supabase.from("ad_spend_imports").select("spend_date, spend").gte("spend_date", since),
    supabase.from("expenses").select("id, expense_date, amount, gst_amount, is_cogs, status, due_date, vendor, category").gte("expense_date", since),
    supabase.from("production_batches").select("id, batch_code, batch_date, units_produced, qc_status").gte("batch_date", d60),
    supabase.from("inventory_items").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("crm_contacts").select("id, name, company, next_follow_up, stage").lte("next_follow_up", t).not("stage", "in", "(won,lost)"),
  ]);
  for (const r of [sales, ads, exps, batchesRes, inv, invs, fu]) if (r.error) throw r.error;

  const salesRows = sales.data ?? [];
  const adRows = ads.data ?? [];
  const expRows = exps.data ?? [];
  const batchRows = batchesRes.data ?? [];
  const invRows = inv.data ?? [];
  const invoiceRows = invs.data ?? [];

  const in30 = <T,>(rows: T[], f: (r: T) => string) => rows.filter((r) => f(r) >= d30);
  const inPrev30 = <T,>(rows: T[], f: (r: T) => string) => rows.filter((r) => f(r) >= d60 && f(r) < d30);

  const s30 = in30(salesRows, (r) => r.order_date);
  const a30 = in30(adRows, (r) => r.spend_date);
  const e30 = in30(expRows, (r) => r.expense_date);

  const revenue = sum(s30, (r) => r.revenue);
  const adSpend = sum(a30, (r) => r.spend);
  const expenses = sum(e30, (r) => r.amount);
  const cogs = sum(e30.filter((e) => e.is_cogs), (r) => r.amount);
  const grossProfit = revenue - cogs;
  const netProfit = revenue - expenses - adSpend;
  const paidOut = sum(e30.filter((e) => e.status === "paid"), (r) => r.amount);

  // Daily cash trend
  const cashIn = new Map<string, number>(), cashOut = new Map<string, number>();
  for (const r of s30) cashIn.set(r.order_date, (cashIn.get(r.order_date) ?? 0) + Number(r.revenue));
  for (const r of a30) cashOut.set(r.spend_date, (cashOut.get(r.spend_date) ?? 0) + Number(r.spend));
  for (const r of e30.filter((e) => e.status === "paid")) cashOut.set(r.expense_date, (cashOut.get(r.expense_date) ?? 0) + Number(r.amount));
  const cashTrend = Array.from({ length: 30 }, (_, i) => {
    const d = isoDaysAgo(29 - i);
    return { label: d.slice(5), value: cashIn.get(d) ?? 0, secondary: cashOut.get(d) ?? 0 };
  });

  // Monthly P&L
  const monthlyPnL: BusinessSnapshot["monthlyPnL"] = [];
  for (let m = 5; m >= 0; m--) {
    const dt = new Date();
    dt.setMonth(dt.getMonth() - m, 1);
    const key = localIso(dt).slice(0, 7);
    monthlyPnL.push({
      month: dt.toLocaleDateString("en-IN", { month: "short" }),
      revenue: sum(salesRows.filter((r) => r.order_date.startsWith(key)), (r) => r.revenue),
      expense:
        sum(expRows.filter((r) => r.expense_date.startsWith(key)), (r) => r.amount) +
        sum(adRows.filter((r) => r.spend_date.startsWith(key)), (r) => r.spend),
    });
  }

  // Forecast from 90 days of daily revenue
  const daily = new Map<string, number>();
  for (const r of salesRows.filter((r) => r.order_date >= d90)) daily.set(r.order_date, (daily.get(r.order_date) ?? 0) + Number(r.revenue));
  const forecast = buildForecast(daily, 90);

  const unpaidInvoices = invoiceRows.filter((i) => i.status === "sent"); // drafts aren't receivable yet
  const unpaidExpenses = expRows.filter((e) => e.status === "unpaid");

  return {
    revenue,
    prevRevenue: sum(inPrev30(salesRows, (r) => r.order_date), (r) => r.revenue),
    orders: sum(s30, (r) => r.orders),
    adSpend,
    expenses,
    cogs,
    grossProfit,
    netProfit,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : null,
    cashFlow: revenue - paidOut - adSpend,
    unitsProduced: sum(in30(batchRows, (r) => r.batch_date), (r) => r.units_produced),
    prevUnitsProduced: sum(inPrev30(batchRows, (r) => r.batch_date), (r) => r.units_produced),
    inventoryValue: sum(invRows, (r) => Number(r.stock) * Number(r.unit_cost ?? 0)),
    receivables: sum(unpaidInvoices, (r) => Number(r.amount) + Number(r.gst_amount)),
    payables: sum(unpaidExpenses, (r) => Number(r.amount) + Number(r.gst_amount)),
    // Output GST collected on invoices minus input GST paid on expenses, this window.
    gstPayable:
      sum(invoiceRows.filter((i) => i.issue_date >= d30), (r) => r.gst_amount) - sum(e30, (r) => r.gst_amount),
    cashTrend,
    monthlyPnL,
    forecast,
    alerts: buildAlerts({
      inventory: invRows,
      invoices: invoiceRows,
      unpaidExpenses: unpaidExpenses.map((e) => ({ ...e, amount: Number(e.amount) })),
      followUps: fu.data ?? [],
      failedBatches: batchRows.filter((b) => b.qc_status === "failed" && b.batch_date >= isoDaysAgo(7)),
    }),
  };
}

export function useBusinessSnapshot(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ["business_snapshot"], queryFn: fetchBusinessSnapshot, staleTime: 60_000, enabled: opts.enabled ?? true });
}
