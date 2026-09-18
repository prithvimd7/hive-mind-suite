// supabase/functions/sync-shopify/index.ts
//
// Pulls orders from the Shopify Admin GraphQL API and stores daily revenue + order counts
// (India time) in sales_imports with source "shopify". Cancelled and test orders are skipped.
// Revenue = current total price (after edits/refunds), in the shop's currency.
//
// Secrets (Edge Functions → Secrets):
//   SHOPIFY_STORE_DOMAIN   - e.g. kettle-and-tonic.myshopify.com
//   and EITHER (an app made in the Shopify Dev Dashboard — the only option for new apps since Jan 2026):
//     SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET - exchanged for a 24h token via the client credentials
//                            grant. The app must be installed on the store, in the same Shopify organization.
//   OR (a legacy custom app created in the Shopify admin before 2026):
//     SHOPIFY_ACCESS_TOKEN - its Admin API access token (shpat_…)
//   Scopes: read_orders (plus read_all_orders to sync history older than 60 days)
//   SHOPIFY_API_VERSION    - optional, defaults below

import { istDate, parseRange, replaceSales, requireEnv, serveSync, markSynced, HttpError, type DailySales } from "../_shared/sync.ts";

const DEFAULT_API_VERSION = "2026-07";

const QUERY = `
query Orders($cursor: String, $q: String!) {
  orders(first: 250, after: $cursor, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes { createdAt cancelledAt test currentTotalPriceSet { shopMoney { amount currencyCode } } }
  }
}`;

serveSync("shopify", async (req, db) => {
  const env = requireEnv("SHOPIFY_STORE_DOMAIN");
  const version = Deno.env.get("SHOPIFY_API_VERSION") ?? DEFAULT_API_VERSION;
  const { since, until } = parseRange(req);
  const domain = env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const accessToken = await getAccessToken(domain);

  // Widen by a day on each side in UTC, then filter by India date, so IST day boundaries are exact.
  const q = `created_at:>=${shift(since, -1)} created_at:<=${shift(until, 1)}`;
  const byDay = new Map<string, DailySales>();
  let cursor: string | null = null;

  do {
    const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
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

/** Legacy admin-app token if set, otherwise a fresh 24h token from the Dev Dashboard app's client credentials. */
async function getAccessToken(domain: string): Promise<string> {
  const legacy = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
  if (legacy) return legacy;
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new HttpError(500, "Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (Dev Dashboard app), or SHOPIFY_ACCESS_TOKEN (pre-2026 custom app).");
  }
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const why = body.error_description ?? body.error ?? `HTTP ${res.status}`;
    throw new Error(`Shopify token request failed: ${why}. Check the app is installed on ${domain} and is in the same Shopify organization.`);
  }
  return body.access_token as string;
}
