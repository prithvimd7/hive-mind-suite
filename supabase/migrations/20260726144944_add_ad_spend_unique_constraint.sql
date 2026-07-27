-- One row per platform+campaign+day, so daily syncs can upsert instead of duplicating rows.
-- Uses coalesce(campaign, '') because unique constraints treat NULLs as distinct in Postgres.
CREATE UNIQUE INDEX ad_spend_imports_platform_campaign_date_idx
ON public.ad_spend_imports (platform, COALESCE(campaign, ''), spend_date);
