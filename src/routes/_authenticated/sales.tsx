import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DateRangePicker } from "@/components/app/date-range-picker";
import {
  formatRange, monthLabel, resolveSelection, validateRangeSearch, type RangeSearch,
} from "@/lib/date-range";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { EmptyState } from "@/components/app/empty-state";
import { BarsChart, RevenueArea } from "@/components/app/charts";
import { currency, compact, shortDate } from "@/lib/format";
import { useSalesData, type SalesDayRow } from "@/hooks/use-sales-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Range selection plus an optional drill-down: a channel, then a month within it. */
type SalesSearch = RangeSearch & { channel?: string; month_of?: string };

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [
    { title: "Sales — Company OS" },
    { name: "description", content: "Sales across every channel: website, marketplaces, wholesale, distributors." },
    { property: "og:title", content: "Sales — Company OS" },
    { property: "og:description", content: "Sales performance across every channel." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  validateSearch: (search: Record<string, unknown>): SalesSearch => {
    const base = validateRangeSearch(search);
    const channel = typeof search.channel === "string" && search.channel ? search.channel : undefined;
    const monthOf = typeof search.month_of === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month_of)
      ? search.month_of : undefined;
    // A month only makes sense inside a channel.
    return { ...base, channel, month_of: channel ? monthOf : undefined };
  },
  component: Sales,
});

const monthOf = (date: string) => date.slice(0, 7);

function totals(rows: SalesDayRow[]) {
  const revenue = rows.reduce((a, r) => a + r.revenue, 0);
  const orders = rows.reduce((a, r) => a + r.orders, 0);
  return { revenue, orders, aov: orders ? revenue / orders : 0 };
}

/** Groups rows by a key, returning rows sorted by that key. */
function groupBy(rows: SalesDayRow[], key: (r: SalesDayRow) => string) {
  const map = new Map<string, { key: string; revenue: number; orders: number }>();
  for (const r of rows) {
    const k = key(r);
    const cur = map.get(k) ?? { key: k, revenue: 0, orders: 0 };
    cur.revenue += r.revenue;
    cur.orders += r.orders;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function Sales() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { channel, month_of: month } = search;
  const { range, label: rangeLabel, short } = resolveSelection(search);
  const { data, isLoading } = useSalesData(range);

  const go = (next: Partial<SalesSearch>) =>
    navigate({ search: { ...search, ...next } as SalesSearch, replace: true });
  const setRange = (next: RangeSearch) => navigate({ search: { ...next, channel, month_of: month } as SalesSearch, replace: true });

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const scoped = useMemo(() => {
    let r = rows;
    if (channel) r = r.filter((x) => x.channel === channel);
    if (month) r = r.filter((x) => monthOf(x.date) === month);
    return r;
  }, [rows, channel, month]);

  const t = totals(scoped);
  const months = useMemo(
    () => groupBy(channel ? rows.filter((r) => r.channel === channel) : rows, (r) => monthOf(r.date)),
    [rows, channel],
  );
  const days = useMemo(() => groupBy(scoped, (r) => r.date), [scoped]);
  const channels = useMemo(() => groupBy(rows, (r) => r.channel).sort((a, b) => b.revenue - a.revenue), [rows]);

  const heading = month ? `${channel} · ${monthLabel(month)}` : channel ?? "All channels";

  return (
    <div>
      <PageHeader
        title="Sales & Revenue"
        description={`${rangeLabel} · ${formatRange(range)}`}
        actions={<DateRangePicker value={search} onChange={setRange} />}
      />

      {/* Breadcrumb: All channels › Shopify › April 2026 */}
      {(channel || month) && (
        <div className="mb-3 flex items-center gap-1 text-[13px]">
          <button onClick={() => go({ channel: undefined, month_of: undefined })} className="text-muted-foreground hover:text-foreground">
            All channels
          </button>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {month ? (
            <>
              <button onClick={() => go({ month_of: undefined })} className="text-muted-foreground hover:text-foreground">{channel}</button>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{monthLabel(month)}</span>
            </>
          ) : (
            <span className="font-medium">{channel}</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[86px] rounded-[var(--radius)]" />)}
        </div>
      ) : !data?.hasData ? (
        <SectionCard title="No sales data yet">
          <EmptyState
            title={`No sales recorded in ${rangeLabel.toLowerCase()}`}
            description="Add entries manually, or sync Shopify / Amazon from Integrations to see real revenue here."
            ctaLabel="Add a sale"
            ctaTo="/entry"
          />
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3">
            {channel ? (
              <>
                <KpiCard label={`${heading} revenue`} value={currency(t.revenue)} />
                <KpiCard label="Orders" value={compact(t.orders)} />
                <KpiCard label="AOV" value={currency(Math.round(t.aov))} />
              </>
            ) : (
              <>
                <KpiCard label="Today's sales" value={currency(data.todayRevenue)} />
                <KpiCard label="This month" value={currency(data.monthRevenue)} />
                <KpiCard label={`Revenue (${short})`} value={currency(data.totalRevenue)} to="/finance" />
                <KpiCard label={`Orders (${short})`} value={compact(data.totalOrders)} />
                <KpiCard label="AOV" value={currency(Math.round(data.aov))} />
                <KpiCard label="Channels" value={String(channels.length)} />
              </>
            )}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title={month ? "Daily revenue" : channel ? "Month on month" : "Revenue by channel"}
              description={
                month ? `${channel} · ${monthLabel(month)}`
                  : channel ? "Click a month to see its days"
                  : "Click a channel to break it down by month"
              }
            >
              {month ? (
                <BarsChart
                  data={days.map((d) => ({ label: shortDate(d.key), revenue: d.revenue }))}
                  xKey="label"
                />
              ) : channel ? (
                <BarsChart
                  data={months.map((m) => ({ label: monthLabel(m.key), revenue: m.revenue, month: m.key }))}
                  xKey="label"
                  onSelect={(label) => {
                    const hit = months.find((m) => monthLabel(m.key) === label);
                    if (hit) go({ month_of: hit.key });
                  }}
                />
              ) : (
                <BarsChart
                  data={channels.map((c) => ({ channel: c.key, revenue: c.revenue }))}
                  onSelect={(value) => go({ channel: value, month_of: undefined })}
                />
              )}
            </SectionCard>

            <SectionCard title="Trend" description={channel ?? "All channels"}>
              <RevenueArea
                data={(channel ? groupBy(scoped, (r) => r.date) : groupBy(rows, (r) => r.date))
                  .map((d) => ({ label: d.key.slice(5), value: d.revenue }))}
              />
            </SectionCard>
          </div>

          <div className="mt-3">
            <SectionCard
              title={month ? "Days" : channel ? "Months" : "Channel breakdown"}
              description={month ? undefined : "Click a row to drill in"}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{month ? "Date" : channel ? "Month" : "Channel"}</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">AOV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(month ? days : channel ? months : channels).map((row) => {
                    const clickable = !month;
                    const label = month ? shortDate(row.key) : channel ? monthLabel(row.key) : row.key;
                    return (
                      <TableRow
                        key={row.key}
                        className={cn(clickable && "cursor-pointer")}
                        onClick={clickable ? () => (channel ? go({ month_of: row.key }) : go({ channel: row.key })) : undefined}
                      >
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell className="text-right">{currency(row.revenue)}</TableCell>
                        <TableCell className="text-right">{compact(row.orders)}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {row.orders ? currency(Math.round(row.revenue / row.orders)) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
