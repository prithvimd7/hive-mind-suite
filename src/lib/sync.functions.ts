import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCeo } from "./auth-guard";

/** Data sources with a live sync edge function (supabase/functions/sync-<name>). */
export const SYNC_FUNCTIONS = {
  shopify: "sync-shopify",
  amazon_seller: "sync-amazon-seller",
  meta_ads: "sync-meta-ads",
  amazon_ads: "sync-amazon-ads",
  google_ads: "sync-google-ads",
} as const;

export type SyncKind = keyof typeof SYNC_FUNCTIONS;

export type SyncResult = {
  ok: true;
  rows_synced: number;
  since: string;
  until: string;
  orders?: number;
  pending?: boolean;
  note?: string;
};

/**
 * Runs a platform sync from the server (not the browser), so CRON_SECRET never reaches the
 * client bundle. CEO only.
 *
 * Needs, in the app's server environment (Lovable Cloud → Project Settings → Environment):
 *   SUPABASE_URL - already set when Supabase is connected
 *   CRON_SECRET  - must match the CRON_SECRET edge function secret
 */
export const triggerSync = createServerFn({ method: "POST" })
  .middleware([requireCeo])
  .inputValidator((input: { kind: SyncKind; since?: string; until?: string }) =>
    z.object({
      kind: z.enum(Object.keys(SYNC_FUNCTIONS) as [SyncKind, ...SyncKind[]]),
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(input),
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

    const res = await fetch(`${SUPABASE_URL}/functions/v1/${SYNC_FUNCTIONS[data.kind]}?${params}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error(`The ${SYNC_FUNCTIONS[data.kind]} edge function isn't deployed yet.`);
    if (res.status === 401) throw new Error("CRON_SECRET in the app environment doesn't match the edge function secret.");
    if (!res.ok) throw new Error(json?.error ?? `Sync failed (HTTP ${res.status})`);
    return json as SyncResult;
  });
