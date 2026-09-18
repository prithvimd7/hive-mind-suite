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
  istDate, lwaAccessToken, parseRange, replaceSales, requireEnv, serveSync, markSynced, sleep, HttpError, type DailySales,
} from "../_shared/sync.ts";

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
  await markSynced(db, "amazon_seller");
  return { rows_synced: days.length, orders: days.reduce((a, d) => a + d.orders, 0), since, until };
});
