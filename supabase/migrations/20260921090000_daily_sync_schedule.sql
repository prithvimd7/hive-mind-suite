-- Daily auto-sync for the live integrations.
--
-- The schedule needs CRON_SECRET, which must not live in the repo, so this migration only
-- installs a helper. Run it once with the real secret (Supabase SQL editor or Lovable):
--
--   select public.schedule_company_os_syncs('<CRON_SECRET>');
--
-- By default it schedules Shopify, Meta Ads and Amazon Ads at 04:00 UTC (~09:30 IST), each
-- re-pulling the last 7 days so late conversions, refunds and cancellations are corrected.
-- To include others once their credentials are set:
--
--   select public.schedule_company_os_syncs('<CRON_SECRET>',
--     array['sync-shopify','sync-meta-ads','sync-amazon-ads','sync-amazon-seller','sync-google-ads']);
--
-- To stop all scheduled syncs:
--
--   select public.unschedule_company_os_syncs();

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

CREATE OR REPLACE FUNCTION public.unschedule_company_os_syncs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  removed int := 0;
  job record;
BEGIN
  FOR job IN SELECT jobname FROM cron.job WHERE jobname LIKE 'company-os-%' LOOP
    PERFORM cron.unschedule(job.jobname);
    removed := removed + 1;
  END LOOP;
  -- Also drop the broken job from 20260726144657, which sent a placeholder as its auth header.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-meta-ads-daily') THEN
    PERFORM cron.unschedule('sync-meta-ads-daily');
    removed := removed + 1;
  END IF;
  RETURN removed;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_company_os_syncs(
  p_cron_secret text,
  p_functions text[] DEFAULT array['sync-shopify', 'sync-meta-ads', 'sync-amazon-ads'],
  p_schedule text DEFAULT '0 4 * * *',   -- 04:00 UTC ≈ 09:30 IST
  p_days integer DEFAULT 7
)
RETURNS TABLE (job_name text, function_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn text;
  base_url text := 'https://ywymetblsxqixzxuavko.supabase.co/functions/v1/';
BEGIN
  IF coalesce(p_cron_secret, '') = '' THEN
    RAISE EXCEPTION 'CRON_SECRET is required and must match the edge function secret';
  END IF;

  PERFORM public.unschedule_company_os_syncs();

  FOREACH fn IN ARRAY p_functions LOOP
    PERFORM cron.schedule(
      'company-os-' || fn,
      p_schedule,
      format(
        $cmd$select net.http_post(
          url := %L,
          headers := jsonb_build_object('Authorization', 'Bearer ' || %L),
          timeout_milliseconds := 150000)$cmd$,
        base_url || fn || '?days=' || p_days,
        p_cron_secret
      )
    );
    job_name := 'company-os-' || fn;
    function_name := fn;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Scheduling is an admin action: keep it off the API roles (the command text holds the secret).
REVOKE ALL ON FUNCTION public.schedule_company_os_syncs(text, text[], text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unschedule_company_os_syncs() FROM PUBLIC, anon, authenticated;
