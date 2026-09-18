import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { requireCeo, requireUser } from "./auth-guard";

const SourceKind = z.enum([
  "shopify",
  "amazon_seller",
  "meta_ads",
  "amazon_ads",
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

export const setSourceStatus = createServerFn({ method: "POST" })
  .middleware([requireCeo])
  .inputValidator((v: { kind: string; status: string; config?: Record<string, unknown> }) =>
    z.object({
      kind: SourceKind,
      status: z.enum(["connected", "disconnected", "pending", "error"]),
      config: z.record(z.string(), z.unknown()).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const patch: { status: string; config?: Json; last_synced_at?: string } = {
      status: data.status,
    };
    if (data.config) patch.config = data.config as Json;
    if (data.status === "connected") patch.last_synced_at = new Date().toISOString();
    const { error } = await context.supabase
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
    const payload = data.rows.map((r) => ({ ...r, platform: data.platform }));
    const { error, count } = await context.supabase
      .from("ad_spend_imports")
      .insert(payload, { count: "exact" });
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
