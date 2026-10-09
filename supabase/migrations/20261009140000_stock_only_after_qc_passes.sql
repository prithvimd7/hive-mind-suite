-- Units count as stock only once QC has passed.
--
-- Until now a finished batch counted unless QC had explicitly failed, so units awaiting a QC
-- result were already in stock. The rule is now: stage = 'done' AND qc_status = 'passed'.
--
-- Batches counted under the old rule while QC was still pending are taken back out below,
-- otherwise their units would be added a second time when QC passes.

CREATE OR REPLACE FUNCTION public.tg_batch_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  old_item uuid;
  new_item uuid;
  old_qty  numeric(14,2) := 0;
  new_qty  numeric(14,2) := 0;
BEGIN
  IF tg_op <> 'INSERT' AND old.stage = 'done' AND old.qc_status = 'passed' THEN
    old_qty  := coalesce(old.units_produced, 0);
    old_item := public.finished_item_for(old.product_id);
  END IF;
  IF tg_op <> 'DELETE' AND new.stage = 'done' AND new.qc_status = 'passed' THEN
    new_qty  := coalesce(new.units_produced, 0);
    new_item := public.ensure_finished_item(new.product_id);
  END IF;

  IF old_item IS NOT DISTINCT FROM new_item THEN
    IF new_item IS NOT NULL AND new_qty <> old_qty THEN
      PERFORM public.apply_stock_delta(new_item, new_qty - old_qty, new.batch_date, 'batch:' || new.id);
    END IF;
  ELSE
    -- The batch changed product: take the units off the old item and put them on the new one.
    IF old_item IS NOT NULL AND old_qty <> 0 THEN
      PERFORM public.apply_stock_delta(old_item, -old_qty, old.batch_date, 'batch:' || old.id);
    END IF;
    IF new_item IS NOT NULL AND new_qty <> 0 THEN
      PERFORM public.apply_stock_delta(new_item, new_qty, new.batch_date, 'batch:' || new.id);
    END IF;
  END IF;
  RETURN NULL;
END $$;

-- Undo what the old rule added for batches whose QC hasn't passed. The ledger says exactly
-- how much each batch put in, so this reverses that and nothing else; batches with no
-- movement (logged before stock tracking, or never counted) are left alone.
DO $$
DECLARE
  m record;
BEGIN
  FOR m IN
    SELECT sm.item_id, sm.source_ref, sum(sm.qty) AS applied
      FROM public.stock_movements sm
      JOIN public.production_batches pb ON 'batch:' || pb.id = sm.source_ref
     WHERE sm.kind = 'production'
       AND pb.qc_status <> 'passed'
     GROUP BY sm.item_id, sm.source_ref
    HAVING sum(sm.qty) <> 0
  LOOP
    PERFORM public.apply_stock_delta(m.item_id, -m.applied, current_date, m.source_ref);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.tg_batch_stock() FROM PUBLIC, anon, authenticated;
