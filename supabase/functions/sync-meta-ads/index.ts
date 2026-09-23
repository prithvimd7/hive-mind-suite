// supabase/functions/sync-meta-ads/index.ts
//
// Pulls daily campaign-level spend, impressions, clicks, purchases and purchase value
// from Meta's Marketing API and upserts it into ad_spend_imports.
//
// Secrets (Edge Functions → Secrets):
//   META_ACCESS_TOKEN   - long-lived System User token with ads_read
//   META_AD_ACCOUNT_ID  - numeric ad account id, WITHOUT the "act_" prefix
//   CRON_SECRET         - shared secret; callers send `Authorization: Bearer <CRON_SECRET>`

import { parseRange, requireEnv, serveSync, upsertAds, markSynced, HttpError, type AdRow } from "../_shared/sync.ts";

const GRAPH_VERSION = "v21.0";

// Meta reports the SAME purchase under several action types (omni_purchase is the de-duplicated
// total across web/app/offline; the others are subsets). Summing them double/triple counts, so
// take the first type present in priority order.
const PURCHASE_PRIORITY = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

type Action = { action_type: string; value: string };
interface InsightRow {
  campaign_name?: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Action[];
  action_values?: Action[];
}

function purchases(rows: Action[] | undefined): number {
  if (!rows) return 0;
  for (const type of PURCHASE_PRIORITY) {
    const hit = rows.find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

serveSync("meta_ads", async (req, db) => {
  const env = requireEnv("META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID");
  const { since, until } = parseRange(req);
  // Guard against the token being pasted into the account id secret (and vice versa): Meta would
  // otherwise echo the whole credential back inside its error message.
  const account = env.META_AD_ACCOUNT_ID.trim().replace(/^act_/, "");
  if (!/^d+$/.test(account)) {
    throw new HttpError(400, "META_AD_ACCOUNT_ID must be the numeric ad account id (digits only, no act_ prefix). It looks like a different value was saved in that secret.");
  }
  if (!env.META_ACCESS_TOKEN.trim().startsWith("EAA")) {
    throw new HttpError(400, "META_ACCESS_TOKEN does not look like a Meta access token (it should start with EAA).");
  }

  const fields = "campaign_name,spend,impressions,clicks,actions,action_values";
  let url: string =
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${account}/insights` +
    `?level=campaign&time_increment=1&fields=${fields}&limit=200` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`;

  const rows: AdRow[] = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${env.META_ACCESS_TOKEN.trim()}` } });
    const body = await res.json();
    if (body.error) throw new Error(`Meta API error (${body.error.code}): ${body.error.message}`);
    for (const r of body.data as InsightRow[]) {
      rows.push({
        campaign: r.campaign_name ?? "Unnamed campaign",
        spend_date: r.date_start,
        spend: Number(r.spend ?? 0),
        revenue: purchases(r.action_values),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        conversions: purchases(r.actions),
        raw: r,
      });
    }
    url = body.paging?.next ?? "";
  }

  const synced = await upsertAds(db, "meta_ads", rows);
  await markSynced(db, "meta_ads");
  return { rows_synced: synced, since, until };
});
