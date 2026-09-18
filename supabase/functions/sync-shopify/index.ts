// supabase/functions/sync-shopify/index.ts
//
// Pulls orders from the Shopify Admin GraphQL API and stores daily revenue + order counts
// (India time) in sales_imports with source "shopify". Cancelled and test orders are skipped.
// Revenue = current total price (after edits/refunds), in the shop's currency.
//
// Secrets (Edge Functions → Secrets):
//   SHOPIFY_STORE_DOMAIN   - e.g. kettle-and-tonic.myshopify.com
//   SHOPIFY_ACCESS_TOKEN   - Admin API access token from a custom app (Settings → Apps → Develop apps)
//                            with the read_orders scope (read_all_orders for history > 60 days)
//   SHOPIFY_API_VERSION    - optional, defaults below
//   CRON_SECRET

import { istDate, parseRange, replaceSales, requireEnv, serveSync, markSynced, type DailySales } from "../_shared/sync.ts";

const DEFAULT_API_VERSION = "2026-07";

const QUERY = `
query Orders($cursor: String, $q: String!) {
  orders(first: 250, after: $cursor, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes { createdAt cancelledAt test currentTotalPriceSet { shopMoney { amount currencyCode } } }
  }
}`;

serveSync("shopify", async (req, db) => {
  const env = requireEnv("SHOPIFY_STORE_DOMAIN", "SHOPIFY_ACCESS_TOKEN");
  const version = Deno.env.get("SHOPIFY_API_VERSION") ?? DEFAULT_API_VERSION;
  const { since, until } = parseRange(req);
  const domain = env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  // Widen by a day on each side in UTC, then filter by India date, so IST day boundaries are exact.
  const q = `created_at:>=${shift(since, -1)} created_at:<=${shift(until, 1)}`;
  const byDay = new Map<string, DailySales>();
  let cursor: string | null = null;

  do {
    const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { cursor, q } }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.errors) {
      const msg = typeof body.errors === "string" ? body.errors : body.errors?.[0]?.message ?? `HTTP ${res.status}`;
      throw new Error(`Shopify API error: ${msg}`);
    }
    const page = body.data.orders;
    for (const o of page.nodes) {
      if (o.test || o.cancelledAt) continue;
      const day = istDate(o.createdAt);
      if (day < since || day > until) continue;
      const d = byDay.get(day) ?? { order_date: day, revenue: 0, orders: 0 };
      d.revenue += Number(o.currentTotalPriceSet?.shopMoney?.amount ?? 0);
      d.orders += 1;
      byDay.set(day, d);
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  const days = [...byDay.values()];
  await replaceSales(db, "shopify", "Shopify", since, until, days);
  await markSynced(db, "shopify");
  return { rows_synced: days.length, orders: days.reduce((a, d) => a + d.orders, 0), since, until };
});

function shift(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
