-- Finished production now lands in stock, and every stock change is written to a ledger.
--
-- Before this, a batch reaching "done" recorded units_produced and nothing else happened:
-- inventory_items.stock only ever moved when someone typed a new number, so finished goods
-- never appeared under "In stock now".
--
-- Rule: a batch counts as stock when stage = 'done' AND qc_status <> 'failed'.
-- The delta is applied both ways, so un-finishing a batch, correcting its units, failing it
-- in QC, moving it to another product or deleting it all pull the stock back out again.
--
-- Existing rows are not backfilled on purpose: today's stock figures were typed by hand and
-- already include everything made so far, so adding history would double-count it.

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  moved_on date NOT NULL DEFAULT current_date,
  -- Signed: positive is stock in, negative is stock out.
  qty numeric(14,2) NOT NULL,
  kind text NOT NULL DEFAULT 'adjustment' CHECK (kind IN ('production', 'adjustment')),
  -- Where it came from, e.g. 'batch:<uuid>'. NULL for a hand adjustment.
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON public.stock_movements (item_id, moved_on);
CREATE INDEX IF NOT EXISTS stock_movements_date_idx ON public.stock_movements (moved_on);

-- Readable by the app; only the triggers below write to it, so there are no write policies.
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view stock movements" ON public.stock_movements;
CREATE POLICY "Authenticated can view stock movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);

-- The finished-goods row that holds a product's stock, if there is one.
CREATE OR REPLACE FUNCTION public.finished_item_for(p_product uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.inventory_items
  WHERE product_id = p_product
  ORDER BY (item_type = 'finished') DESC, created_at
  LIMIT 1
$$;

-- Same, but creates the finished-goods row the first time a product is made, so units
-- never disappear just because nobody set up an inventory item for a new product.
CREATE OR REPLACE FUNCTION public.ensure_finished_item(p_product uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_product record;
BEGIN
  IF p_product IS NULL THEN
    RETURN NULL;
  END IF;
  v_id := public.finished_item_for(p_product);
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT sku, name INTO v_product FROM public.products WHERE id = p_product;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.inventory_items (sku, name, item_type, unit, stock, product_id)
  VALUES (v_product.sku, v_product.name, 'finished', 'units', 0, p_product)
  ON CONFLICT (sku) DO UPDATE
    SET product_id = coalesce(inventory_items.product_id, excluded.product_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Moves stock and tags the change so the ledger records what caused it.
CREATE OR REPLACE FUNCTION public.apply_stock_delta(p_item uuid, p_delta numeric, p_on date, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.stock_source', coalesce(p_source, ''), true);
  PERFORM set_config('app.stock_moved_on', p_on::text, true);
  UPDATE public.inventory_items
     SET stock = greatest(0, stock + p_delta)
   WHERE id = p_item;
  -- Clear it again so a later hand edit in the same transaction isn't mislabelled.
  PERFORM set_config('app.stock_source', '', true);
  PERFORM set_config('app.stock_moved_on', '', true);
END $$;

-- One ledger row per real change in stock, whoever made it.
CREATE OR REPLACE FUNCTION public.tg_log_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  delta  numeric(14,2);
  source text := nullif(current_setting('app.stock_source', true), '');
  moved  date := coalesce(nullif(current_setting('app.stock_moved_on', true), '')::date, current_date);
BEGIN
  IF tg_op = 'INSERT' THEN
    delta := coalesce(new.stock, 0);
  ELSE
    delta := coalesce(new.stock, 0) - coalesce(old.stock, 0);
  END IF;
  IF delta = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.stock_movements (item_id, moved_on, qty, kind, source_ref)
  VALUES (new.id, moved, delta,
          CASE WHEN source LIKE 'batch:%' THEN 'production' ELSE 'adjustment' END,
          source);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS inventory_items_log_stock ON public.inventory_items;
CREATE TRIGGER inventory_items_log_stock
AFTER INSERT OR UPDATE OF stock ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.tg_log_stock_movement();

-- Finished batches in, un-finished batches back out.
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
  IF tg_op <> 'INSERT' AND old.stage = 'done' AND old.qc_status <> 'failed' THEN
    old_qty  := coalesce(old.units_produced, 0);
    old_item := public.finished_item_for(old.product_id);
  END IF;
  IF tg_op <> 'DELETE' AND new.stage = 'done' AND new.qc_status <> 'failed' THEN
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

DROP TRIGGER IF EXISTS production_batches_stock ON public.production_batches;
CREATE TRIGGER production_batches_stock
AFTER INSERT OR UPDATE OR DELETE ON public.production_batches
FOR EACH ROW EXECUTE FUNCTION public.tg_batch_stock();

-- These run as owner, so nobody may call them directly to move stock.
REVOKE ALL ON FUNCTION public.apply_stock_delta(uuid, numeric, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finished_item_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_finished_item(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_log_stock_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_batch_stock() FROM PUBLIC, anon, authenticated;
