-- Bug fix #1: the cron job scheduled in 20260726144657 sends the literal string
-- "YOUR_ANON_KEY" as the Authorization header - that placeholder was never filled
-- in, AND sync-meta-ads actually checks against CRON_SECRET, not the anon key.
-- As shipped, every scheduled run would fail with 401 Unauthorized.
--
-- Fix: unschedule the broken job. You'll re-create it with the real CRON_SECRET
-- once you've set that secret (see instructions) - a one-line command is at the
-- bottom of this file, commented out until you fill in the real value.
select cron.unschedule('sync-meta-ads-daily')
where exists (select 1 from cron.job where jobname = 'sync-meta-ads-daily');

-- Bug fix #2: 20260726144944 added a second, redundant unique index
-- (COALESCE-based) on top of the one already added in 20260726144657.
-- The Edge Function's upsert targets the plain (platform, campaign, spend_date)
-- constraint, so the COALESCE index is unused dead weight - drop it.
DROP INDEX IF EXISTS public.ad_spend_imports_platform_campaign_date_idx;

-- Once you've set the CRON_SECRET secret (Supabase dashboard -> Edge Functions ->
-- sync-meta-ads -> Secrets), run this in the SQL editor with the real value
-- substituted in place of REPLACE_WITH_YOUR_CRON_SECRET:
--
-- select cron.schedule(
--   'sync-meta-ads-daily',
--   '0 4 * * *',
--   $$
--   select net.http_post(
--     url := 'https://ywymetblsxqixzxuavko.supabase.co/functions/v1/sync-meta-ads',
--     headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_YOUR_CRON_SECRET')
--   );
--   $$
-- );
