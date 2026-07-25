import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SourceKind = z.enum([
  "shopify",
  "amazon_seller",
  "meta_ads",
  "amazon_ads",
  "blinkit",
  "offline",
]);

export const listDataSources = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("data_sources")
    .select("*")
    .order("label");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const setSourceStatus = createServerFn({ method: "POST" })
  .inputValidator((v: { kind: string; status: string; config?: Record<string, unknown> }) =>
    z.object({
      kind: SourceKind,
      status: z.enum(["connected", "disconnected", "pending", "error"]),
      config: z.record(z.string(), z.unknown()).optional(),
    }).parse(v),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.config) patch.config = data.config;
    if (data.status === "connected") patch.last_synced_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("data_sources")
      .update(patch)
      .eq("kind", data.kind);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SalesRow = z.object({
  order_date: z.string(),
  channel: z.string().optional().nullable(),
  revenue: z.number(),
  orders: z.number().int().nonnegative().default(0),
  currency: z.string().default("INR"),
  external_id: z.string().optional().nullable(),
});

export const importSalesRows = createServerFn({ method: "POST" })
  .inputValidator((v: { source: string; rows: unknown[] }) =>
    z.object({ source: SourceKind, rows: z.array(SalesRow).max(5000) }).parse(v),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = data.rows.map((r) => ({ ...r, source: data.source }));
    const { error, count } = await supabaseAdmin
      .from("sales_imports")
      .insert(payload, { count: "exact" });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("data_sources")
      .update({ status: "connected", last_synced_at: new Date().toISOString() })
      .eq("kind", data.source);
    return { inserted: count ?? payload.length };
  });

const AdRow = z.object({
  spend_date: z.string(),
  campaign: z.string().optional().nullable(),
  spend: z.number(),
  revenue: z.number().default(0),
  impressions: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  conversions: z.number().int().nonnegative().default(0),
});

export const importAdRows = createServerFn({ method: "POST" })
  .inputValidator((v: { platform: string; rows: unknown[] }) =>
    z.object({ platform: SourceKind, rows: z.array(AdRow).max(5000) }).parse(v),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = data.rows.map((r) => ({ ...r, platform: data.platform }));
    const { error, count } = await supabaseAdmin
      .from("ad_spend_imports")
      .insert(payload, { count: "exact" });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("data_sources")
      .update({ status: "connected", last_synced_at: new Date().toISOString() })
      .eq("kind", data.platform);
    return { inserted: count ?? payload.length };
  });

export const getIntegrationsSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [sales, ads] = await Promise.all([
    supabaseAdmin.from("sales_imports").select("source", { count: "exact", head: true }),
    supabaseAdmin.from("ad_spend_imports").select("platform", { count: "exact", head: true }),
  ]);
  return {
    salesRows: sales.count ?? 0,
    adRows: ads.count ?? 0,
  };
});
