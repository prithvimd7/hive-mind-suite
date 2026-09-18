// supabase/functions/sync-amazon-ads/index.ts
//
// Pulls daily Sponsored Products campaign performance from the Amazon Ads Reporting API (v3)
// and upserts it into ad_spend_imports with platform "amazon_ads".
//
// Amazon builds reports asynchronously (often 1–5 minutes). This function requests the report,
// waits up to ~100s, and if it isn't ready yet saves the report id in data_sources.config so the
// next "Sync now" (or the daily cron) picks it up instead of requesting a new one.
//
// Secrets (Edge Functions → Secrets):
//   AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET - LWA credentials of your Amazon Ads API app
//   AMAZON_ADS_REFRESH_TOKEN                       - from authorizing the app with advertising::campaign_management
//   AMAZON_ADS_PROFILE_ID                          - the Amazon.in advertising profile id
//   AMAZON_ADS_ENDPOINT                            - optional, defaults to the EU endpoint (serves India)
//   CRON_SECRET

import { lwaAccessToken, parseRange, requireEnv, serveSync, upsertAds, markSynced, sleep, type AdRow } from "../_shared/sync.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_DAYS = 31; // Amazon's limit for a daily spCampaigns report
type Pending = { id: string; since: string; until: string };

serveSync("amazon_ads", async (req, db) => {
  const env = requireEnv("AMAZON_ADS_CLIENT_ID", "AMAZON_ADS_CLIENT_SECRET", "AMAZON_ADS_REFRESH_TOKEN", "AMAZON_ADS_PROFILE_ID");
  const endpoint = Deno.env.get("AMAZON_ADS_ENDPOINT") ?? "https://advertising-api-eu.amazon.com";
  const token = await lwaAccessToken(env.AMAZON_ADS_CLIENT_ID, env.AMAZON_ADS_CLIENT_SECRET, env.AMAZON_ADS_REFRESH_TOKEN);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Amazon-Advertising-API-ClientId": env.AMAZON_ADS_CLIENT_ID,
    "Amazon-Advertising-API-Scope": env.AMAZON_ADS_PROFILE_ID,
  };

  const config = await getConfig(db);
  let job: Pending | undefined = config.pending_report as Pending | undefined;
  let clamped = false;

  if (!job) {
    let { since, until } = parseRange(req);
    const earliest = new Date(new Date(until + "T00:00:00Z").getTime() - (MAX_DAYS - 1) * 86400000).toISOString().slice(0, 10);
    if (since < earliest) { since = earliest; clamped = true; }
    job = { id: await createReport(endpoint, headers, since, until), since, until };
  }

  // Poll for up to ~100s (edge functions have a limited wall-clock budget).
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${endpoint}/reporting/reports/${job.id}`, { headers });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Amazon Ads report status error: ${r.message ?? r.details ?? `HTTP ${res.status}`}`);

    if (r.status === "COMPLETED" && r.url) {
      const rows = await download(r.url);
      const synced = await upsertAds(db, "amazon_ads", rows);
      const { pending_report: _done, ...rest } = config;
      await markSynced(db, "amazon_ads", rest);
      return {
        rows_synced: synced, since: job.since, until: job.until,
        ...(clamped ? { note: `Amazon Ads reports cover at most ${MAX_DAYS} days; synced ${job.since} to ${job.until}.` } : {}),
      };
    }
    if (r.status === "FAILED") {
      const { pending_report: _failed, ...rest } = config;
      await db.from("data_sources").update({ config: rest }).eq("kind", "amazon_ads");
      throw new Error(`Amazon Ads report failed: ${r.failureReason ?? "unknown reason"}`);
    }
    await sleep(10_000);
  }

  // Not ready yet — remember it for the next run.
  await db.from("data_sources").update({ status: "pending", config: { ...config, pending_report: job } }).eq("kind", "amazon_ads");
  return { rows_synced: 0, pending: true, since: job.since, until: job.until, note: "Amazon is still preparing the report — click Sync now again in a few minutes." };
});

async function getConfig(db: SupabaseClient): Promise<Record<string, unknown>> {
  const { data } = await db.from("data_sources").select("config").eq("kind", "amazon_ads").maybeSingle();
  return (data?.config as Record<string, unknown>) ?? {};
}

async function createReport(endpoint: string, headers: Record<string, string>, since: string, until: string): Promise<string> {
  const res = await fetch(`${endpoint}/reporting/reports`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/vnd.createasyncreportrequest.v3+json" },
    body: JSON.stringify({
      name: `Company OS SP campaigns ${since}..${until}`,
      startDate: since,
      endDate: until,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: ["campaign"],
        columns: ["date", "campaignName", "cost", "impressions", "clicks", "purchases7d", "sales7d"],
        reportTypeId: "spCampaigns",
        timeUnit: "DAILY",
        format: "GZIP_JSON",
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.reportId) return body.reportId;
  // An identical request made recently comes back as 425 with the existing report's id.
  const dup = String(body.detail ?? body.details ?? "").match(/duplicate of\s*:?\s*([\w-]+)/i);
  if (res.status === 425 && dup) return dup[1];
  throw new Error(`Amazon Ads report request failed: ${body.message ?? body.detail ?? `HTTP ${res.status}`}`);
}

async function download(url: string): Promise<AdRow[]> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Downloading Amazon Ads report failed (HTTP ${res.status})`);
  const text = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
  const data = JSON.parse(text) as Record<string, string | number>[];
  return data.map((r) => ({
    campaign: String(r.campaignName ?? "Unnamed campaign"),
    spend_date: String(r.date),
    spend: Number(r.cost ?? 0),
    revenue: Number(r.sales7d ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    conversions: Number(r.purchases7d ?? 0),
    raw: r,
  }));
}
