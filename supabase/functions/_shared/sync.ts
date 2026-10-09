// Shared helpers for the sync-* edge functions.
//
// Every sync function:
//   - is called with a signed-in CEO token (manual sync) or CRON_SECRET (scheduled sync),
//   - accepts ?since=YYYY-MM-DD&until=YYYY-MM-DD (defaults to the last 7 days),
//   - writes into sales_imports / ad_spend_imports and marks its data_sources row as synced.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseProduct } from "./product-normalise.ts";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function requireEnv(...names: string[]): Record<string, string> {
  const missing = names.filter((n) => !Deno.env.get(n));
  if (missing.length) throw new HttpError(500, `Missing secret(s): ${missing.join(", ")}. Set them under Edge Functions → Secrets.`);
  return Object.fromEntries(names.map((n) => [n, Deno.env.get(n)!]));
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Calendar date (YYYY-MM-DD) in India time for an ISO timestamp. */
export function istDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export function parseRange(req: Request) {
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "7");
  const until = url.searchParams.get("until") ?? ymd(new Date());
  const since = url.searchParams.get("since") ?? ymd(new Date(Date.now() - days * 86400000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || since > until) {
    throw new HttpError(400, "since/until must be YYYY-MM-DD with since <= until");
  }
  return { since, until };
}

export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export type DailySales = { order_date: string; revenue: number; orders: number };

/**
 * Replaces this source's rows for the date range with fresh daily totals, so re-running a
 * sync never double counts. Only rows with this `source` are touched — manual entries are safe.
 */
export async function replaceSales(db: SupabaseClient, source: string, channel: string, since: string, until: string, days: DailySales[]) {
  const del = await db.from("sales_imports").delete().eq("source", source).gte("order_date", since).lte("order_date", until);
  if (del.error) throw new Error(`Clearing old ${source} rows failed: ${del.error.message}`);
  if (!days.length) return 0;
  const ins = await db.from("sales_imports").insert(
    days.map((d) => ({
      source, channel, order_date: d.order_date, revenue: Math.round(d.revenue * 100) / 100, orders: d.orders,
      currency: "INR", external_id: `${source}:${d.order_date}`,
    })),
  );
  if (ins.error) throw new Error(`Saving ${source} sales failed: ${ins.error.message}`);
  return days.length;
}

export type ItemRow = { order_date: string; product_name: string; sku?: string | null; quantity: number; revenue: number };

/**
 * Replaces this source's product lines for the range, mirroring replaceSales so the daily
 * totals and the per-product detail stay consistent when a sync is re-run. Sold units are
 * then taken out of finished-goods stock.
 */
export async function replaceItems(
  db: SupabaseClient, source: string, channel: string, since: string, until: string, items: ItemRow[],
) {
  const del = await db.from("sales_items").delete().eq("source", source).gte("order_date", since).lte("order_date", until);
  if (del.error) throw new Error(`Clearing old ${source} items failed: ${del.error.message}`);
  // An empty range still has to be reconciled: those sales may have been cancelled, and their
  // units belong back in stock.
  if (!items.length) {
    return { rows: 0, stock: await reconcileSaleStock(db, source, since, until) };
  }

  // One row per day and product.
  const merged = new Map<string, ItemRow>();
  for (const i of items) {
    const key = `${i.order_date}|${i.product_name}`;
    const cur = merged.get(key);
    if (!cur) { merged.set(key, { ...i }); continue; }
    cur.quantity += i.quantity;
    cur.revenue += i.revenue;
  }

  const rows = [...merged.values()].map((i) => ({
    source, channel, order_date: i.order_date, product_name: i.product_name, sku: i.sku ?? null,
    quantity: Math.round(i.quantity * 100) / 100,
    revenue: Math.round(i.revenue * 100) / 100,
    currency: "INR",
    import_ref: `${source}:${i.order_date}:${i.product_name}`,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("sales_items").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Saving ${source} items failed: ${error.message}`);
  }
  return { rows: rows.length, stock: await reconcileSaleStock(db, source, since, until) };
}

/**
 * Takes this source's sold units out of finished-goods stock for the range.
 *
 * Listing titles are folded into products and pack sizes turned into real units here — the
 * same matcher the app uses — and the per-day totals handed to apply_sale_stock(), which
 * reconciles them against what was already deducted. Safe to re-run: the second run moves
 * nothing. Products with no inventory item, and titles that match no product, are skipped.
 */
export async function reconcileSaleStock(
  db: SupabaseClient, source: string, since: string, until: string,
): Promise<SaleStockResult> {
  const products = await db.from("products").select("id, name");
  if (products.error) throw new Error(`Reading products failed: ${products.error.message}`);
  const names = (products.data ?? []).map((p) => p.name as string);
  const idByName = new Map<string, string>((products.data ?? []).map((p) => [p.name as string, p.id as string]));

  const sold = await db.from("sales_items")
    .select("order_date, product_name, quantity")
    .eq("source", source).gte("order_date", since).lte("order_date", until);
  if (sold.error) throw new Error(`Reading ${source} items failed: ${sold.error.message}`);

  const perDay = new Map<string, { product_id: string; date: string; units: number }>();
  let unmatched = 0;
  for (const row of sold.data ?? []) {
    const { product, packSize } = parseProduct(String(row.product_name), names);
    const productId = idByName.get(product);
    if (!productId) { unmatched += 1; continue; }
    const key = `${row.order_date}|${productId}`;
    const cur = perDay.get(key) ?? { product_id: productId, date: String(row.order_date), units: 0 };
    cur.units += Number(row.quantity ?? 0) * packSize;
    perDay.set(key, cur);
  }

  const { data, error } = await db.rpc("apply_sale_stock", {
    p_source: source, p_since: since, p_until: until, p_rows: [...perDay.values()],
  });
  if (error) throw new Error(`Updating stock from ${source} sales failed: ${error.message}`);
  return { stock_lines: perDay.size, stock_changes: Number(data ?? 0), unmatched_titles: unmatched };
}

/** What a reconciliation did: lines considered, stock changes applied, titles it couldn't place. */
export type SaleStockResult = { stock_lines: number; stock_changes: number; unmatched_titles: number };

export type AdRow = {
  campaign: string; spend_date: string; spend: number; revenue: number;
  impressions: number; clicks: number; conversions: number; raw?: unknown;
};

/** Upserts one row per platform+campaign+day (unique constraint ad_spend_imports_platform_campaign_date_key). */
export async function upsertAds(db: SupabaseClient, platform: string, input: AdRow[]) {
  // Two campaigns can share a name; merge same-name same-day rows first, because an upsert batch
  // may not touch the same unique key twice.
  const merged = new Map<string, AdRow>();
  for (const r of input) {
    const k = `${r.campaign}|${r.spend_date}`;
    const m = merged.get(k);
    if (!m) { merged.set(k, { ...r }); continue; }
    m.spend += r.spend; m.revenue += r.revenue; m.impressions += r.impressions;
    m.clicks += r.clicks; m.conversions += r.conversions;
  }
  const rows = [...merged.values()];
  if (!rows.length) return 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({
      platform, ...r, conversions: Math.round(r.conversions), raw: r.raw ?? {},
    }));
    const { error } = await db.from("ad_spend_imports").upsert(chunk, { onConflict: "platform,campaign,spend_date" });
    if (error) throw new Error(`Saving ${platform} rows failed: ${error.message}`);
  }
  return rows.length;
}

export async function markSynced(db: SupabaseClient, kind: string, config?: Record<string, unknown>) {
  const patch: Record<string, unknown> = { status: "connected", last_synced_at: new Date().toISOString() };
  if (config) patch.config = config;
  await db.from("data_sources").update(patch).eq("kind", kind);
}

export async function markError(db: SupabaseClient, kind: string) {
  await db.from("data_sources").update({ status: "error" }).eq("kind", kind);
}

/** Authorizes a scheduled job secret or independently verifies a signed-in CEO token. */
async function authorizeSync(req: Request, db: SupabaseClient): Promise<boolean> {
  const authorization = req.headers.get("Authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;

  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) return false;

  const { data: role, error: roleError } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("role", "ceo")
    .maybeSingle();
  return !roleError && Boolean(role);
}

/** Standard wrapper: caller check, error → JSON, and data_sources status on failure. */
export function serveSync(kind: string, run: (req: Request, db: SupabaseClient) => Promise<Record<string, unknown>>) {
  Deno.serve(async (req) => {
    const db = admin();
    if (!(await authorizeSync(req, db))) {
      return json({ error: "Unauthorized" }, 401);
    }
    try {
      return json({ ok: true, ...(await run(req, db)) });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) await markError(db, kind).catch(() => {});
      return json({ error: err instanceof Error ? err.message : String(err) }, status);
    }
  });
}

/**
 * Login-with-Amazon token exchange, used by both Seller (SP-API) and Ads APIs. SP-API uses the global
 * endpoint; the Ads API wants the regional one that issued the refresh token (EU, incl. India: api.amazon.co.uk).
 */
export async function lwaAccessToken(clientId: string, clientSecret: string, refreshToken: string, tokenUrl = "https://api.amazon.com/auth/o2/token") {
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Amazon login failed: ${j.error_description ?? j.error ?? res.status}`);
  return j.access_token as string;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
