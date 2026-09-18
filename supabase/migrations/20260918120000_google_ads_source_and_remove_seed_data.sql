-- 1. Google Ads as a data source (synced by the sync-google-ads edge function).
INSERT INTO public.data_sources (kind, label, status)
VALUES ('google_ads', 'Google Ads', 'disconnected')
ON CONFLICT (kind) DO NOTHING;

-- 2. Remove the sample rows the app seeded on setup. Only rows nobody has touched or linked
--    real data to are deleted, so anything entered through the app is kept.
DELETE FROM public.inventory_items
WHERE sku IN ('KT-MBB-001', 'KT-CBB-002', 'KT-GTB-003')
  AND stock = 0 AND reorder_level = 0 AND unit_cost IS NULL AND expiry_date IS NULL;

DELETE FROM public.products p
WHERE p.sku IN ('KT-MBB-001', 'KT-CBB-002', 'KT-GTB-003')
  AND p.unit_cost IS NULL AND p.retail_price IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.production_batches b WHERE b.product_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.product_id = p.id);

DELETE FROM public.production_lines l
WHERE l.name = 'Retort Line 1' AND l.capacity_per_day = 250 AND l.notes IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.production_batches b WHERE b.line_id = l.id);

-- 3. Let the CEO delete ad-spend rows (e.g. a wrong CSV upload). Sales already has this.
GRANT DELETE ON public.ad_spend_imports TO authenticated;
DROP POLICY IF EXISTS "CEO can delete ad spend" ON public.ad_spend_imports;
CREATE POLICY "CEO can delete ad spend" ON public.ad_spend_imports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ceo'));

-- 4. OPTIONAL daily auto-sync at 04:00 UTC (~9:30 AM IST), re-pulling the last 7 days.
--    Run this block once in the SQL editor after setting CRON_SECRET, replacing the placeholder.
--    Only schedule the platforms whose secrets you've set.
--
-- create extension if not exists pg_cron with schema extensions;
-- create extension if not exists pg_net with schema extensions;
-- select cron.unschedule(jobname) from cron.job where jobname like 'company-os-sync-%';
-- select cron.schedule('company-os-sync-' || fn, '0 4 * * *', format(
--   $f$ select net.http_post(
--        url := 'https://ywymetblsxqixzxuavko.supabase.co/functions/v1/%s?days=7',
--        headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_YOUR_CRON_SECRET'),
--        timeout_milliseconds := 150000) $f$, fn))
-- from unnest(array['sync-meta-ads','sync-shopify','sync-amazon-seller','sync-amazon-ads','sync-google-ads']) as fn;
