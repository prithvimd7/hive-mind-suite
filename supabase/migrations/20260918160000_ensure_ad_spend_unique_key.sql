-- The sync functions and ad CSV import upsert ON CONFLICT (platform, campaign, spend_date), but
-- the unique constraint from 20260726144657 never reached the live database
-- ("there is no unique or exclusion constraint matching the ON CONFLICT specification").
-- This migration is idempotent: safe to run whether or not parts of it already exist.

-- 1. Merge existing duplicates so the constraint can be created. Totals are summed into the
--    oldest row of each group, so no spend/revenue is lost.
CREATE TEMP TABLE _ad_dupes ON COMMIT DROP AS
SELECT platform, campaign, spend_date,
       (array_agg(id ORDER BY created_at, id))[1] AS keep_id,
       sum(spend) AS spend, sum(revenue) AS revenue, sum(impressions) AS impressions,
       sum(clicks) AS clicks, sum(conversions) AS conversions
FROM public.ad_spend_imports
WHERE campaign IS NOT NULL
GROUP BY platform, campaign, spend_date
HAVING count(*) > 1;

UPDATE public.ad_spend_imports a
SET spend = d.spend, revenue = d.revenue, impressions = d.impressions, clicks = d.clicks, conversions = d.conversions
FROM _ad_dupes d
WHERE a.id = d.keep_id;

DELETE FROM public.ad_spend_imports a
USING _ad_dupes d
WHERE a.platform = d.platform AND a.campaign = d.campaign AND a.spend_date = d.spend_date AND a.id <> d.keep_id;

-- 2. The unique key every upsert targets.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ad_spend_imports_platform_campaign_date_key') THEN
    ALTER TABLE public.ad_spend_imports
      ADD CONSTRAINT ad_spend_imports_platform_campaign_date_key UNIQUE (platform, campaign, spend_date);
  END IF;
END $$;

-- 3. The CEO insert policy from 20260726143604 may also be missing (needed for manual entries
--    and CSV upserts, which run as the signed-in user).
GRANT INSERT ON public.ad_spend_imports TO authenticated;
DROP POLICY IF EXISTS "CEO can insert ad spend" ON public.ad_spend_imports;
CREATE POLICY "CEO can insert ad spend" ON public.ad_spend_imports
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ceo'));
