import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  totalOrders: number;
  aov: number;
  revenueTrend: DailyPoint[];
  byChannel: ChannelBreakdown[];
}

const EMPTY: SalesData = {
  hasData: false,
  totalRevenue: 0,
  totalOrders: 0,
  aov: 0,
  revenueTrend: [],
  byChannel: [],
};

/** Real sales data from Supabase, aggregated for the last `days` days. Returns hasData=false if no rows exist yet. */
export function useSalesData(days = 30) {
  return useQuery({
    queryKey: ["sales_imports", days],
    queryFn: async (): Promise<SalesData> => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("sales_imports")
        .select("order_date, revenue, orders, channel")
        .gte("order_date", sinceStr)
        .order("order_date", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return EMPTY;

      const totalRevenue = data.reduce((a, r) => a + Number(r.revenue), 0);
      const totalOrders = data.reduce((a, r) => a + Number(r.orders), 0);

      const byDay = new Map<string, number>();
      for (const r of data) {
        byDay.set(r.order_date, (byDay.get(r.order_date) ?? 0) + Number(r.revenue));
      }
      const revenueTrend: DailyPoint[] = Array.from(byDay.entries()).map(([date, value]) => ({
        label: date.slice(5), // MM-DD
        value,
      }));

      const byChannelMap = new Map<string, { revenue: number; orders: number }>();
      for (const r of data) {
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
        hasData: true,
        totalRevenue,
        totalOrders,
        aov: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        revenueTrend,
        byChannel,
      };
    },
  });
}
