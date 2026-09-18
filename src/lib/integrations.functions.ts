import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCeo, requireUser } from "./auth-guard";

const SourceKind = z.enum([
  "shopify",
  "amazon_seller",
  "meta_ads",
  "amazon_ads",
  "google_ads",
  "blinkit",
  "offline",
]);

export const listDataSources = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("data_sources")
      .select("*")
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
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
  .middleware([requireUser])
  .inputValidator((v: { source: string; rows: unknown[] }) =>
    z.object({ source: SourceKind, rows: z.array(SalesRow).max(5000) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const payload = data.rows.map((r) => ({ ...r, source: data.source }));
    const { error, count } = await context.supabase
      .from("sales_imports")
      .insert(payload, { count: "exact" });
    if (error) throw new Error(error.message);
    const { error: sourceError } = await context.supabase
      .from("data_sources")
      .update({ status: "connected", last_synced_at: new Date().toISOString() })
      .eq("kind", data.source);
    if (sourceError) throw new Error(sourceError.message);
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
  .middleware([requireCeo])
  .inputValidator((v: { platform: string; rows: unknown[] }) =>
    z.object({ platform: SourceKind, rows: z.array(AdRow).max(5000) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    // One row per platform+campaign+day: merge duplicates in the file, then upsert so
    // re-uploading the same export updates rows instead of failing or double counting.
    const merged = new Map<string, z.infer<typeof AdRow> & { campaign: string; platform: string }>();
    for (const r of data.rows) {
      const campaign = r.campaign?.trim() || "Unnamed campaign";
      const key = `${campaign}|${r.spend_date}`;
      const m = merged.get(key);
      if (!m) { merged.set(key, { ...r, campaign, platform: data.platform }); continue; }
      m.spend += r.spend; m.revenue += r.revenue; m.impressions += r.impressions; m.clicks += r.clicks; m.conversions += r.conversions;
    }
    const payload = [...merged.values()];
    const { error, count } = await context.supabase
      .from("ad_spend_imports")
      .upsert(payload, { onConflict: "platform,campaign,spend_date", count: "exact" });
    if (error) throw new Error(error.message);
    const { error: sourceError } = await context.supabase
      .from("data_sources")
      .update({ status: "connected", last_synced_at: new Date().toISOString() })
      .eq("kind", data.platform);
    if (sourceError) throw new Error(sourceError.message);
    return { inserted: count ?? payload.length };
  });

export const getIntegrationsSummary = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const [sales, ads] = await Promise.all([
      context.supabase.from("sales_imports").select("source", { count: "exact", head: true }),
      context.supabase.from("ad_spend_imports").select("platform", { count: "exact", head: true }),
    ]);
    if (sales.error) throw new Error(sales.error.message);
    if (ads.error) throw new Error(ads.error.message);
    return {
      salesRows: sales.count ?? 0,
      adRows: ads.count ?? 0,
    };
  });
