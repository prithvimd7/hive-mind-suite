// supabase/functions/sync-meta-ads/index.ts
//
// Pulls daily campaign-level spend, impressions, clicks, conversions and revenue
// from Meta's Marketing API for the configured ad account, and upserts it into
// the ad_spend_imports table.
//
// Required secrets (set with `supabase secrets set`):
//   META_ACCESS_TOKEN     - long-lived System User access token with ads_read
//   META_AD_ACCOUNT_ID    - numeric ad account id, WITHOUT the "act_" prefix
//   CRON_SECRET           - any random string; callers must send it as
//                           `Authorization: Bearer <CRON_SECRET>` (this function
//                           has verify_jwt disabled so it can be called from a
//                           cron job, so this is what actually protects it)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by the
// Supabase Edge Runtime - no need to set them yourself.
//
// Manual test:
//   curl -X POST "https://<project-ref>.supabase.co/functions/v1/sync-meta-ads?days=7" \
//     -H "Authorization: Bearer <CRON_SECRET>"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_VERSION = "v21.0";
const PURCHASE_ACTION_TYPES = new Set([
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
]);

interface MetaInsightRow {
  campaign_name?: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

interface MetaInsightsResponse {
  data: MetaInsightRow[];
  paging?: { next?: string };
  error?: { message: string; type: string; code: number };
}

function sumMatchingActions(rows: { action_type: string; value: string }[] | undefined): number {
  if (!rows) return 0;
  return rows
    .filter((a) => PURCHASE_ACTION_TYPES.has(a.action_type))
    .reduce((sum, a) => sum + (Number(a.value) || 0), 0);
}

async function fetchAllInsights(accessToken: string, adAccountId: string, since: string, until: string) {
  const rows: MetaInsightRow[] = [];
  const fields = ["campaign_name", "spend", "impressions", "clicks", "actions", "action_values"].join(",");
  let url =
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}/insights` +
    `?level=campaign&time_increment=1&fields=${fields}` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
    `&access_token=${accessToken}&limit=200`;

  while (url) {
    const res = await fetch(url);
    const json: MetaInsightsResponse = await res.json();
    if (json.error) {
      throw new Error(`Meta API error (${json.error.code}): ${json.error.message}`);
    }
    rows.push(...json.data);
    url = json.paging?.next ?? "";
  }
  return rows;
}

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const accessToken = Deno.env.get("META_ACCESS_TOKEN");
    const adAccountId = Deno.env.get("META_AD_ACCOUNT_ID");
    if (!accessToken || !adAccountId) {
      return new Response(
        JSON.stringify({ error: "Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID secret" }),
        { status: 500 },
      );
    }

    const url = new URL(req.url);
    const sinceParam = url.searchParams.get("since");
    const untilParam = url.searchParams.get("until");
    const days = Number(url.searchParams.get("days") ?? "7"); // fallback: re-pull last N days

    const until = untilParam ?? new Date().toISOString().slice(0, 10);
    const since = sinceParam ?? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const insights = await fetchAllInsights(accessToken, adAccountId, since, until);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const upsertRows = insights.map((row) => ({
      platform: "meta_ads",
      campaign: row.campaign_name ?? "Unnamed campaign",
      spend_date: row.date_start,
      spend: Number(row.spend ?? 0),
      revenue: sumMatchingActions(row.action_values),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      conversions: sumMatchingActions(row.actions),
      raw: row as unknown as Record<string, unknown>,
    }));

    if (upsertRows.length > 0) {
      const { error } = await supabase
        .from("ad_spend_imports")
        .upsert(upsertRows, { onConflict: "platform,campaign,spend_date" });
      if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    // Reflect the sync in data_sources so the Integrations page shows it as connected/synced.
    await supabase
      .from("data_sources")
      .update({ status: "connected", last_synced_at: new Date().toISOString() })
      .eq("kind", "meta_ads");

    return new Response(
      JSON.stringify({ ok: true, rows_synced: upsertRows.length, since, until }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
