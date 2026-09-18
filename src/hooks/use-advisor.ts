import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { askAdvisor } from "@/lib/advisor.functions";
import { fetchBusinessSnapshot, snapshotKey } from "./use-business-snapshot";
import { DEFAULT_RANGE, resolveRange } from "@/lib/date-range";
import { isoDaysAgo } from "@/lib/format";

export type AdvisorMsg = { role: "user" | "assistant"; content: string; error?: boolean };

const GREETING: AdvisorMsg = {
  role: "assistant",
  content: "Hi! I'm your AI business advisor. I answer from your live data — sales, ads, production, inventory, finance, CRM and team. What do you want to know?",
};

/** Collects a compact JSON snapshot of everything the signed-in user can see, for grounding the model. */
async function gatherContext(qc: ReturnType<typeof useQueryClient>) {
  const since = isoDaysAgo(90);
  const last30 = resolveRange(DEFAULT_RANGE);
  const [snapshot, sales, ads, products, inventory, batches, contacts, team] = await Promise.all([
    qc.fetchQuery({ queryKey: snapshotKey(last30), queryFn: () => fetchBusinessSnapshot(last30), staleTime: 60_000 }),
    supabase.from("sales_imports").select("order_date, channel, revenue, orders").gte("order_date", since).order("order_date"),
    supabase.from("ad_spend_imports").select("spend_date, platform, campaign, spend, revenue, clicks, impressions, conversions").gte("spend_date", since),
    supabase.from("products").select("sku, name, category, unit_cost, retail_price, is_active"),
    supabase.from("inventory_items").select("sku, name, item_type, stock, unit, reorder_level, unit_cost, expiry_date"),
    supabase.from("production_batches").select("batch_code, batch_date, units_planned, units_produced, rejects, downtime_minutes, protein_pct, qc_status").gte("batch_date", since),
    supabase.from("crm_contacts").select("name, company, contact_type, stage, deal_value, city, next_follow_up"),
    supabase.from("team_members").select("name, role, department, attendance, kpi_score, monthly_target, is_active"),
  ]);

  // Daily sales by channel, and campaign totals, keep the payload small but specific.
  const campaigns = new Map<string, { platform: string; campaign: string; spend: number; revenue: number; clicks: number; impressions: number; conversions: number }>();
  for (const r of ads.data ?? []) {
    const k = `${r.platform}|${r.campaign ?? ""}`;
    const c = campaigns.get(k) ?? { platform: r.platform, campaign: r.campaign ?? "Unnamed", spend: 0, revenue: 0, clicks: 0, impressions: 0, conversions: 0 };
    c.spend += Number(r.spend); c.revenue += Number(r.revenue); c.clicks += r.clicks; c.impressions += r.impressions; c.conversions += r.conversions;
    campaigns.set(k, c);
  }

  // Imports can be per-order; roll them up to one row per day+channel.
  const dailySales = new Map<string, { date: string; channel: string; revenue: number; orders: number }>();
  for (const r of sales.data ?? []) {
    const k = `${r.order_date}|${r.channel ?? "Other"}`;
    const d = dailySales.get(k) ?? { date: r.order_date, channel: r.channel ?? "Other", revenue: 0, orders: 0 };
    d.revenue += Number(r.revenue); d.orders += r.orders;
    dailySales.set(k, d);
  }

  const { forecast, cashTrend: _cashTrend, alerts, ...kpis } = snapshot;
  return JSON.stringify({
    kpis_last_30_days: kpis,
    open_alerts: alerts,
    forecast_next_30_days: forecast ? { total: forecast.next30, daily_trend_slope: Math.round(forecast.dailySlope), days_of_history: forecast.daysOfHistory } : "not enough history (needs 14+ days)",
    daily_sales_by_channel_last_90_days: [...dailySales.values()],
    ad_campaigns_last_90_days: [...campaigns.values()].map((c) => ({ ...c, roas: c.spend ? +(c.revenue / c.spend).toFixed(2) : null })),
    products: products.data ?? [],
    inventory: inventory.data ?? [],
    production_batches_last_90_days: batches.data ?? [],
    crm_contacts: contacts.data ?? [],
    team: team.data ?? [],
  });
}

export function useAdvisor() {
  const qc = useQueryClient();
  const ask = useServerFn(askAdvisor);
  const [msgs, setMsgs] = useState<AdvisorMsg[]>([GREETING]);
  const [busy, setBusy] = useState(false);

  const send = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = msgs.filter((m, i) => i > 0 && !m.error).slice(-10).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const context = await gatherContext(qc);
      const { answer } = await ask({ data: { question, history, context } });
      setMsgs((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }, [ask, busy, msgs, qc]);

  const reset = useCallback(() => setMsgs([GREETING]), []);

  return { msgs, busy, send, reset };
}

export const ADVISOR_SUGGESTIONS = [
  "How is the business doing this month?",
  "Which products have the highest margin?",
  "Predict next month's sales.",
  "Which marketing campaign is wasting money?",
  "What inventory should I reorder?",
  "Which deals should I follow up on this week?",
];
