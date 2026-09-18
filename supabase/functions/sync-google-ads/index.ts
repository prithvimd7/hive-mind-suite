// supabase/functions/sync-google-ads/index.ts
//
// Pulls daily campaign cost, impressions, clicks, conversions and conversion value from the
// Google Ads API (via your manager / MCC account) and upserts into ad_spend_imports with
// platform "google_ads".
//
// Secrets (Edge Functions → Secrets):
//   GOOGLE_ADS_DEVELOPER_TOKEN   - from the manager account: Tools → API Center (needs Basic access or higher)
//   GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET - OAuth client (Google Cloud console, "Desktop"/"Web" app)
//   GOOGLE_ADS_REFRESH_TOKEN     - OAuth refresh token for a user with access to the manager account
//                                  (scope https://www.googleapis.com/auth/adwords)
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID - the manager (MCC) account id, digits only
//   GOOGLE_ADS_CUSTOMER_IDS      - the client account id(s) to pull, comma-separated, digits only
//   GOOGLE_ADS_API_VERSION       - optional, defaults below (Google sunsets versions roughly yearly)
//   CRON_SECRET

import { parseRange, requireEnv, serveSync, upsertAds, markSynced, type AdRow } from "../_shared/sync.ts";

const DEFAULT_API_VERSION = "v25";
const digits = (s: string) => s.replace(/\D/g, "");

serveSync("google_ads", async (req, db) => {
  const env = requireEnv(
    "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_CUSTOMER_IDS",
  );
  const version = Deno.env.get("GOOGLE_ADS_API_VERSION") ?? DEFAULT_API_VERSION;
  const { since, until } = parseRange(req);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
      client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    }),
  });
  const tok = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Google login failed: ${tok.error_description ?? tok.error ?? tokenRes.status}`);

  const customers = env.GOOGLE_ADS_CUSTOMER_IDS.split(",").map(digits).filter(Boolean);
  const query = `
    SELECT campaign.name, segments.date, metrics.cost_micros, metrics.impressions,
           metrics.clicks, metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'`;

  const rows: AdRow[] = [];
  for (const cid of customers) {
    const res = await fetch(`https://googleads.googleapis.com/${version}/customers/${cid}/googleAds:searchStream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok.access_token}`,
        "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
        "login-customer-id": digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = Array.isArray(body) ? body[0]?.error : body.error;
      const detail = err?.details?.[0]?.errors?.[0]?.message ?? err?.message ?? `HTTP ${res.status}`;
      throw new Error(`Google Ads API error (account ${cid}): ${detail}`);
    }
    for (const batch of body as { results?: GoogleRow[] }[]) {
      for (const r of batch.results ?? []) {
        const name = r.campaign?.name ?? "Unnamed campaign";
        rows.push({
          // Campaign names can repeat across client accounts; keep them distinct when pulling several.
          campaign: customers.length > 1 ? `${name} (${cid})` : name,
          spend_date: r.segments.date,
          spend: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
          revenue: Number(r.metrics?.conversionsValue ?? 0),
          impressions: Number(r.metrics?.impressions ?? 0),
          clicks: Number(r.metrics?.clicks ?? 0),
          conversions: Number(r.metrics?.conversions ?? 0),
          raw: r,
        });
      }
    }
  }

  const synced = await upsertAds(db, "google_ads", rows);
  await markSynced(db, "google_ads");
  return { rows_synced: synced, accounts: customers.length, since, until };
});

interface GoogleRow {
  campaign?: { name?: string };
  segments: { date: string };
  metrics?: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number; conversionsValue?: number };
}
