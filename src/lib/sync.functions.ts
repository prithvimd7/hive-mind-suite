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

export type SyncSuccess = {
  ok: true;
  rows_synced: number;
  since: string;
  until: string;
  orders?: number;
  pending?: boolean;
  note?: string;
};

export type SyncFailure = {
  ok: false;
  error: string;
  status: number;
};

export type SyncResult = SyncSuccess | SyncFailure;

/**
 * Runs a platform sync using the signed-in CEO's verified bearer token. The token is forwarded
 * server-to-server and never becomes part of the function input. CEO only.
 *
 * Needs SUPABASE_URL in the app server environment (provided by Lovable Cloud).
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
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) throw new Error("Missing server environment variable: SUPABASE_URL");

    const { getRequest } = await import("@tanstack/react-start/server");
    const authorization = getRequest()?.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Your sign-in session has expired. Please sign in again.");

    const params = new URLSearchParams();
    if (data.since) params.set("since", data.since);
    if (data.until) params.set("until", data.until);

    const res = await fetch(`${supabaseUrl}/functions/v1/${SYNC_FUNCTIONS[data.kind]}?${params}`, {
      method: "POST",
      headers: { Authorization: authorization },
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 404) {
      return { ok: false, status: res.status, error: `The ${SYNC_FUNCTIONS[data.kind]} sync isn't deployed yet.` } satisfies SyncFailure;
    }
    if (res.status === 401 || res.status === 403) throw new Error("Your account is not authorized to run this sync.");
    if (!res.ok) {
      const error = typeof json?.error === "string" ? json.error : `Sync failed (HTTP ${res.status})`;
      return { ok: false, status: res.status, error } satisfies SyncFailure;
    }
    return json as SyncSuccess;
  });
