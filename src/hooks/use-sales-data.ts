import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { eachDay, rangeDays, type DateRange } from "@/lib/date-range";
import { isoDaysAgo, localIso, today } from "@/lib/format";

export interface DailyPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface ChannelBreakdown {
  channel: string;
  revenue: number;
  orders: number;
  conv: number;
}

export interface SalesData {
  hasData: boolean;
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  totalOrders: number;
  aov: number;
  revenueTrend: DailyPoint[];
  byChannel: ChannelBreakdown[];
}

const EMPTY: SalesData = {
  hasData: false,
  totalRevenue: 0,
  todayRevenue: 0,
  monthRevenue: 0,
  totalOrders: 0,
  aov: 0,
  revenueTrend: [],
  byChannel: [],
};

/**
 * Real sales data from Supabase for the last `days` days (including today) or an explicit date range.
 * Returns hasData=false if no rows exist yet.
 */
export function useSalesData(period: number | DateRange = 30) {
  const range = typeof period === "number" ? { since: isoDaysAgo(period - 1), until: today() } : period;
  const now = new Date();
  const monthStart = localIso(new Date(now.getFullYear(), now.getMonth(), 1));
  const querySince = [range.since, monthStart, today()].sort()[0];
  return useQuery({
    queryKey: ["sales_imports", range.since, range.until],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SalesData> => {
      const { data, error } = await supabase
        .from("sales_imports")
        .select("order_date, revenue, orders, channel")
        .gte("order_date", querySince)
        .lte("order_date", range.until)
        .order("order_date", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return EMPTY;

      const rangeRows = data.filter((r) => r.order_date >= range.since && r.order_date <= range.until);
      const totalRevenue = rangeRows.reduce((a, r) => a + Number(r.revenue), 0);
      const totalOrders = rangeRows.reduce((a, r) => a + Number(r.orders), 0);
      const todayRevenue = data
        .filter((r) => r.order_date === today())
        .reduce((a, r) => a + Number(r.revenue), 0);
      const monthRevenue = data
        .filter((r) => r.order_date >= monthStart && r.order_date <= today())
        .reduce((a, r) => a + Number(r.revenue), 0);

      const byDay = new Map<string, number>();
      for (const r of rangeRows) {
        byDay.set(r.order_date, (byDay.get(r.order_date) ?? 0) + Number(r.revenue));
      }
      // One point per day (zero-filled) so gaps show as dips. Long ranges would be too dense, so weekly-bucket past ~45 days.
      const days = eachDay(range);
      const revenueTrend: DailyPoint[] = rangeDays(range) <= 45
        ? days.map((d) => ({ label: d.slice(5), value: byDay.get(d) ?? 0 }))
        : bucketWeekly(days, byDay);

      const byChannelMap = new Map<string, { revenue: number; orders: number }>();
      for (const r of rangeRows) {
        const ch = r.channel ?? "Other";
        const cur = byChannelMap.get(ch) ?? { revenue: 0, orders: 0 };
        cur.revenue += Number(r.revenue);
        cur.orders += Number(r.orders);
        byChannelMap.set(ch, cur);
      }
      const byChannel: ChannelBreakdown[] = Array.from(byChannelMap.entries()).map(([channel, v]) => ({
        channel,
        revenue: v.revenue,
        orders: v.orders,
        conv: 0, // no session/traffic data yet to compute real conversion
      }));

      return {
        hasData: rangeRows.length > 0,
        totalRevenue,
        todayRevenue,
        monthRevenue,
        totalOrders,
        aov: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        revenueTrend,
        byChannel,
      };
    },
  });
}

function bucketWeekly(days: string[], byDay: Map<string, number>): DailyPoint[] {
  const out: DailyPoint[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7);
    out.push({ label: `w/c ${week[0].slice(5)}`, value: week.reduce((a, d) => a + (byDay.get(d) ?? 0), 0) });
  }
  return out;
}
