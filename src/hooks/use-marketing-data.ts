import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampaignRow {
  name: string;
  platform: string;
  spend: number;
  revenue: number;
  roas: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

export interface MarketingData {
  hasData: boolean;
  totalSpend: number;
  totalRevenue: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  cac: number | null;
  byPlatform: { label: string; value: number }[];
  campaigns: CampaignRow[];
}

const EMPTY: MarketingData = {
  hasData: false,
  totalSpend: 0,
  totalRevenue: 0,
  roas: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  conversions: 0,
  cac: null,
  byPlatform: [],
  campaigns: [],
};

/** Real ad spend data from Supabase, aggregated for the last `days` days. Returns hasData=false if no rows exist yet. */
export function useMarketingData(days = 30) {
  return useQuery({
    queryKey: ["ad_spend_imports", days],
    queryFn: async (): Promise<MarketingData> => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("ad_spend_imports")
        .select("platform, campaign, spend, revenue, impressions, clicks, conversions, spend_date")
        .gte("spend_date", sinceStr)
        .order("spend_date", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return EMPTY;

      const totalSpend = data.reduce((a, r) => a + Number(r.spend), 0);
      const totalRevenue = data.reduce((a, r) => a + Number(r.revenue), 0);
      const impressions = data.reduce((a, r) => a + Number(r.impressions), 0);
      const clicks = data.reduce((a, r) => a + Number(r.clicks), 0);
      const conversions = data.reduce((a, r) => a + Number(r.conversions), 0);

      const byPlatformMap = new Map<string, number>();
      for (const r of data) byPlatformMap.set(r.platform, (byPlatformMap.get(r.platform) ?? 0) + Number(r.spend));
      const byPlatform = Array.from(byPlatformMap.entries()).map(([label, value]) => ({ label, value }));

      const campaignMap = new Map<string, CampaignRow>();
      for (const r of data) {
        const key = `${r.platform} — ${r.campaign ?? "Unnamed"}`;
        const cur = campaignMap.get(key) ?? {
          name: key, platform: r.platform, spend: 0, revenue: 0, roas: 0, clicks: 0, impressions: 0, conversions: 0,
        };
        cur.spend += Number(r.spend);
        cur.revenue += Number(r.revenue);
        cur.clicks += Number(r.clicks);
        cur.impressions += Number(r.impressions);
        cur.conversions += Number(r.conversions);
        campaignMap.set(key, cur);
      }
      const campaigns = Array.from(campaignMap.values()).map((c) => ({
        ...c,
        roas: c.spend > 0 ? c.revenue / c.spend : 0,
      })).sort((a, b) => b.spend - a.spend);

      return {
        hasData: true,
        totalSpend,
        totalRevenue,
        roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? totalSpend / clicks : 0,
        cpm: impressions > 0 ? (totalSpend / impressions) * 1000 : 0,
        conversions,
        cac: conversions > 0 ? totalSpend / conversions : null,
        byPlatform,
        campaigns,
      };
    },
  });
}
