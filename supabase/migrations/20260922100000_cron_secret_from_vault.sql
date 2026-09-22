-- Keep CRON_SECRET out of the scheduled job definition.
--
-- 20260921090000 embedded the secret in each cron command, so anyone able to read cron.job
-- could see it. Instead, store it once in Supabase Vault (encrypted at rest) and have the job
-- look it up at run time.
--
-- Setup, run once in the SQL editor:
--   select public.set_company_os_cron_secret('<the CRON_SECRET value from Edge Function secrets>');
--   select public.schedule_company_os_syncs();
--
-- Then the schedule holds no secret at all.

create extension if not exists supabase_vault with schema vault;

-- Stores (or replaces) the CRON_SECRET used by the scheduled syncs.
CREATE OR REPLACE FUNCTION public.set_company_os_cron_secret(p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  existing uuid;
BEGIN
  IF coalesce(p_secret, '') = '' OR p_secret LIKE '<%>' THEN
    RAISE EXCEPTION 'Pass the real CRON_SECRET value, not a placeholder';
  END IF;

  SELECT id INTO existing FROM vault.secrets WHERE name = 'company_os_cron_secret';
  IF existing IS NULL THEN
    PERFORM vault.create_secret(p_secret, 'company_os_cron_secret', 'Bearer token for scheduled Company OS syncs');
  ELSE
    PERFORM vault.update_secret(existing, p_secret);
  END IF;
END;
$$;

-- Schedules the daily syncs. The job command reads the secret from Vault when it runs,
-- so the secret never appears in cron.job.
CREATE OR REPLACE FUNCTION public.schedule_company_os_syncs(
  p_functions text[] DEFAULT array['sync-shopify', 'sync-meta-ads', 'sync-amazon-ads', 'sync-amazon-seller'],
  p_schedule text DEFAULT '0 4 * * *',   -- 04:00 UTC ≈ 09:30 IST
  p_days integer DEFAULT 7
)
RETURNS TABLE (job_name text, function_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  fn text;
  base_url text := 'https://ywymetblsxqixzxuavko.supabase.co/functions/v1/';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'company_os_cron_secret') THEN
    RAISE EXCEPTION 'Run set_company_os_cron_secret(''<value>'') first — it must match the CRON_SECRET edge function secret';
  END IF;

  PERFORM public.unschedule_company_os_syncs();

  FOREACH fn IN ARRAY p_functions LOOP
    PERFORM cron.schedule(
      'company-os-' || fn,
      p_schedule,
      format(
        $cmd$select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'company_os_cron_secret')),
          timeout_milliseconds := 150000)$cmd$,
        base_url || fn || '?days=' || p_days
      )
    );
    job_name := 'company-os-' || fn;
    function_name := fn;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- The older signature took the secret as an argument; drop it so nobody schedules with an
-- embedded secret by mistake.
DROP FUNCTION IF EXISTS public.schedule_company_os_syncs(text, text[], text, integer);

REVOKE ALL ON FUNCTION public.set_company_os_cron_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.schedule_company_os_syncs(text[], text, integer) FROM PUBLIC, anon, authenticated;
