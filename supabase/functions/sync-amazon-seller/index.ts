// supabase/functions/sync-amazon-seller/index.ts
//
// Pulls orders from the Amazon Selling Partner API (Orders v0) for Amazon.in and stores daily
// revenue + order counts (India time) in sales_imports with source "amazon_seller".
// Cancelled orders are skipped. Pending orders count as orders but have no total until Amazon
// confirms payment, so re-sync recent days later (the daily cron does this automatically).
//
// Secrets (Edge Functions → Secrets):
//   AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET - LWA credentials of your SP-API app
//   AMAZON_SP_REFRESH_TOKEN                      - from self-authorizing the app in Seller Central
//   AMAZON_SP_MARKETPLACE_ID                     - optional, defaults to Amazon.in (A21TJRUUN4KGV)
//   AMAZON_SP_ENDPOINT                           - optional, defaults to the EU endpoint (serves India)
//   CRON_SECRET

import {
  istDate, lwaAccessToken, parseRange, replaceSales, replaceItems, requireEnv, serveSync, markSynced, sleep, HttpError,
  type DailySales, type ItemRow, type SaleStockResult,
} from "../_shared/sync.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

serveSync("amazon_seller", async (req, db) => {
  const env = requireEnv("AMAZON_SP_CLIENT_ID", "AMAZON_SP_CLIENT_SECRET", "AMAZON_SP_REFRESH_TOKEN");
  const marketplace = Deno.env.get("AMAZON_SP_MARKETPLACE_ID") ?? "A21TJRUUN4KGV";
  const endpoint = Deno.env.get("AMAZON_SP_ENDPOINT") ?? "https://sellingpartnerapi-eu.amazon.com";
  const { since, until } = parseRange(req);
  const token = await lwaAccessToken(env.AMAZON_SP_CLIENT_ID, env.AMAZON_SP_CLIENT_SECRET, env.AMAZON_SP_REFRESH_TOKEN);

  // IST midnight boundaries. CreatedBefore must be at least 2 minutes in the past.
  const after = new Date(`${since}T00:00:00+05:30`).toISOString();
  const endOfUntil = new Date(`${until}T23:59:59+05:30`).getTime();
  const before = new Date(Math.min(endOfUntil, Date.now() - 3 * 60_000)).toISOString();

  const byDay = new Map<string, DailySales>();
  let nextToken: string | undefined;
  let pages = 0;
  let retried = false;

  do {
    const params = nextToken
      ? new URLSearchParams({ MarketplaceIds: marketplace, NextToken: nextToken })
      : new URLSearchParams({ MarketplaceIds: marketplace, CreatedAfter: after, CreatedBefore: before, MaxResultsPerPage: "100" });
    const res = await fetch(`${endpoint}/orders/v0/orders?${params}`, { headers: { "x-amz-access-token": token } });

    if (res.status === 429) {
      // getOrders allows a burst of 20 requests, then ~1 per minute. Wait once and retry the same page.
      if (retried) throw new HttpError(429, "Amazon rate limit hit — try a shorter date range or wait a minute.");
      retried = true;
      await sleep(61_000);
      continue;
    }
    retried = false;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Amazon SP-API error: ${body.errors?.[0]?.message ?? `HTTP ${res.status}`}`);

    for (const o of body.payload?.Orders ?? []) {
      if (o.OrderStatus === "Canceled") continue;
      const day = istDate(o.PurchaseDate);
      if (day < since || day > until) continue;
      const d = byDay.get(day) ?? { order_date: day, revenue: 0, orders: 0 };
      d.revenue += Number(o.OrderTotal?.Amount ?? 0);
      d.orders += 1;
      byDay.set(day, d);
    }
    nextToken = body.payload?.NextToken;
    pages++;
    if (nextToken && pages % 20 === 0) await sleep(61_000); // stay inside the burst budget
  } while (nextToken);

  const days = [...byDay.values()];
  await replaceSales(db, "amazon_seller", "Amazon", since, until, days);

  // Product lines come from the orders report: the Orders API has no line items, and asking
  // for them per order would need one rate-limited call each.
  const itemsResult = await syncItems(db, { endpoint, token, marketplace, since, until });

  await markSynced(db, "amazon_seller", itemsResult.config);
  return {
    rows_synced: days.length,
    orders: days.reduce((a, d) => a + d.orders, 0),
    product_lines: itemsResult.lines,
    ...(itemsResult.stock ? { stock: itemsResult.stock } : {}),
    ...(itemsResult.pending ? { pending: true, note: "Daily totals are in. Amazon is still preparing the item report — sync again in a few minutes to fill in products." } : {}),
    since, until,
  };
});

const REPORT_TYPE = "GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL";
type PendingReport = { id: string; since: string; until: string };

/**
 * Requests (or resumes) the orders report and writes its product lines.
 * Amazon builds reports asynchronously, so an unfinished report id is kept in
 * data_sources.config and picked up by the next run, exactly like the Ads sync.
 */
async function syncItems(
  db: SupabaseClient,
  opts: { endpoint: string; token: string; marketplace: string; since: string; until: string },
): Promise<{ lines: number; pending: boolean; config?: Record<string, unknown>; stock?: SaleStockResult }> {
  const { endpoint, token, marketplace, since, until } = opts;
  const headers = { "x-amz-access-token": token, "Content-Type": "application/json" };

  const { data } = await db.from("data_sources").select("config").eq("kind", "amazon_seller").maybeSingle();
  const config = ((data?.config as Record<string, unknown>) ?? {});
  let job = config.pending_report as PendingReport | undefined;

  if (!job || job.since !== since || job.until !== until) {
    const res = await fetch(`${endpoint}/reports/2021-06-30/reports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reportType: REPORT_TYPE,
        marketplaceIds: [marketplace],
        dataStartTime: new Date(`${since}T00:00:00+05:30`).toISOString(),
        dataEndTime: new Date(`${until}T23:59:59+05:30`).toISOString(),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.reportId) {
      // Don't fail the whole sync: the daily totals above are already saved.
      return { lines: 0, pending: false, config: stripPending(config) };
    }
    job = { id: body.reportId, since, until };
  }

  // Poll briefly; a big report can take minutes, and the next run resumes it.
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${endpoint}/reports/2021-06-30/reports/${job.id}`, { headers });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) break;

    if (r.processingStatus === "DONE" && r.reportDocumentId) {
      const lines = await downloadItems(endpoint, headers, r.reportDocumentId, since, until);
      const { stock } = await replaceItems(db, "amazon_seller", "Amazon", since, until, lines);
      return { lines: lines.length, stock, pending: false, config: stripPending(config) };
    }
    if (r.processingStatus === "CANCELLED" || r.processingStatus === "FATAL") {
      return { lines: 0, pending: false, config: stripPending(config) };
    }
    await sleep(10_000);
  }

  return { lines: 0, pending: true, config: { ...config, pending_report: job } };
}

function stripPending(config: Record<string, unknown>) {
  const { pending_report: _drop, ...rest } = config;
  return rest;
}

/** Downloads the report document (TSV, often gzipped) and turns its rows into product lines. */
async function downloadItems(
  endpoint: string, headers: Record<string, string>, documentId: string, since: string, until: string,
): Promise<ItemRow[]> {
  const metaRes = await fetch(`${endpoint}/reports/2021-06-30/documents/${documentId}`, { headers });
  const meta = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok || !meta.url) return [];

  const fileRes = await fetch(meta.url);
  if (!fileRes.ok || !fileRes.body) return [];
  const stream = meta.compressionAlgorithm === "GZIP"
    ? fileRes.body.pipeThrough(new DecompressionStream("gzip"))
    : fileRes.body;
  const text = await new Response(stream).text();

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const cols = lines[0].split("\t").map((h) => h.trim().toLowerCase());
  const at = (row: string[], name: string) => {
    const i = cols.indexOf(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  const out: ItemRow[] = [];
  for (const line of lines.slice(1)) {
    const row = line.split("\t");
    const status = at(row, "item-status").toLowerCase();
    if (status === "cancelled") continue;

    const purchased = at(row, "purchase-date");
    if (!purchased) continue;
    const day = istDate(purchased);
    if (day < since || day > until) continue;

    const quantity = Number(at(row, "quantity") || at(row, "quantity-purchased") || 0);
    if (!quantity) continue;

    out.push({
      order_date: day,
      product_name: at(row, "product-name") || at(row, "sku") || "Unnamed product",
      sku: at(row, "sku") || null,
      quantity,
      revenue: Number(at(row, "item-price") || 0),
    });
  }
  return out;
}
