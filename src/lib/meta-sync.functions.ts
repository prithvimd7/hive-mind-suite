import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Triggers the sync-meta-ads edge function from the server (not the browser),
 * so CRON_SECRET never reaches the client bundle.
 *
 * Requires these to be set as environment variables in the app's server runtime
 * (Lovable Cloud -> Project Settings -> Environment, NOT the Supabase Edge Function
 * secrets - those are separate):
 *   SUPABASE_URL   - already set if Supabase is connected
 *   CRON_SECRET    - must match the CRON_SECRET set on the sync-meta-ads function
 *
 * Accepts an optional { since, until } date range (YYYY-MM-DD). If omitted,
 * the edge function defaults to the last 7 days.
 */
export const triggerMetaSync = createServerFn({ method: "POST" })
  .inputValidator((input: { since?: string; until?: string } | undefined) =>
    z.object({ since: z.string().optional(), until: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!SUPABASE_URL || !CRON_SECRET) {
      const missing = [...(!SUPABASE_URL ? ["SUPABASE_URL"] : []), ...(!CRON_SECRET ? ["CRON_SECRET"] : [])];
      throw new Error(`Missing server environment variable(s): ${missing.join(", ")}`);
    }

    const params = new URLSearchParams();
    if (data.since) params.set("since", data.since);
    if (data.until) params.set("until", data.until);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-meta-ads?${params.toString()}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? `Sync failed (HTTP ${res.status})`);
    return json as { ok: true; rows_synced: number; since: string; until: string };
  });
