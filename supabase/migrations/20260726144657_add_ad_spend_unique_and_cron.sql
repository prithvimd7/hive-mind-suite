-- Needed so sync-meta-ads can upsert without creating duplicate rows on re-run.
ALTER TABLE public.ad_spend_imports
  ADD CONSTRAINT ad_spend_imports_platform_campaign_date_key
  UNIQUE (platform, campaign, spend_date);

-- Schedule the sync to run automatically every day at 04:00 UTC (~9:30 AM IST).
-- This requires pg_cron and pg_net, which Supabase has available by default -
-- if either extension isn't enabled on your project yet, enable it from
-- Database -> Extensions in the Supabase dashboard, then re-run this block.
--
-- NOTE: replace YOUR_PROJECT_REF and YOUR_ANON_KEY below (safe to keep the anon
-- key here - it has no special privileges; the function authenticates to Meta
-- and Supabase using its own secrets, not this key).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'sync-meta-ads-daily',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://ywymetblsxqixzxuavko.supabase.co/functions/v1/sync-meta-ads',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_ANON_KEY')
  );
  $$
);
