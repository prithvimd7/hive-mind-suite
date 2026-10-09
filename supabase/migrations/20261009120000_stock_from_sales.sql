-- Sales now take stock out, the way finished batches put it in.
--
-- Two routes in, because the data arrives in two shapes:
--
--   * Synced channels (Shopify, Amazon) report listing titles like "… | Pack of 6". The sync
--     function folds those into a product and works out real units, then calls
--     apply_sale_stock() with the result. Keyed per source + day + product, and applied as a
--     difference against what was already taken out, so re-running a sync never double counts
--     and a cancelled order puts the units back.
--
--   * Offline sales entered in the app name the product outright, so a trigger handles them
--     directly: one movement per row, reversed if the row is edited or deleted.
--
-- Stock is clamped at zero, so a period synced before stock was counted properly leaves the
-- item at 0 rather than going negative.

/**
 * From when sales count against stock.
 *
 * Today's stock figures were counted by hand and already net off everything sold so far, so
 * deducting past sales would take them off twice — and re-syncing an old month for its product
 * detail would do it again. Sales before this date are ignored; it defaults to the day this
 * migration runs. To deduct from an earlier date, set it and re-sync that period:
 *
 *   update public.stock_settings set deduct_sales_from = '2026-10-01';
 */
CREATE TABLE IF NOT EXISTS public.stock_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  deduct_sales_from date NOT NULL DEFAULT current_date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.stock_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.stock_settings TO authenticated;
GRANT ALL ON public.stock_settings TO service_role;
ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view stock settings" ON public.stock_settings;
CREATE POLICY "Authenticated can view stock settings" ON public.stock_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "CEO can update stock settings" ON public.stock_settings;
CREATE POLICY "CEO can update stock settings" ON public.stock_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE OR REPLACE FUNCTION public.deduct_sales_from()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((SELECT deduct_sales_from FROM public.stock_settings WHERE id), current_date)
$$;

-- 'sale' joins the movement kinds.
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_kind_check;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_kind_check CHECK (kind IN ('production', 'adjustment', 'sale'));

CREATE INDEX IF NOT EXISTS stock_movements_source_ref_idx ON public.stock_movements (source_ref);

-- Label sale movements as well as production ones.
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
          CASE
            WHEN source LIKE 'batch:%' THEN 'production'
            WHEN source LIKE 'sale:%' OR source LIKE 'sale_row:%' THEN 'sale'
            ELSE 'adjustment'
          END,
          source);
  RETURN NULL;
END $$;

-- A product by its exact name, for sales lines that name it outright.
CREATE OR REPLACE FUNCTION public.product_id_by_name(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.products
  WHERE lower(name) = lower(btrim(coalesce(p_name, '')))
  ORDER BY created_at
  LIMIT 1
$$;

/**
 * Takes a synced channel's sold units out of stock for a date range.
 *
 * p_rows is [{ "product_id": uuid, "date": "YYYY-MM-DD", "units": number }, …] — already
 * folded into products and real units by the sync function, which owns the title matching.
 * Each (source, day, product) is reconciled against what it previously took out, so the
 * result is the same however many times the range is synced.
 */
CREATE OR REPLACE FUNCTION public.apply_sale_stock(p_source text, p_since date, p_until date, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r         record;
  v_item    uuid;
  v_ref     text;
  v_applied numeric(14,2);
  v_target  numeric(14,2);
  v_refs    text[] := '{}';
  v_changed integer := 0;
  v_from    date := public.deduct_sales_from();
BEGIN
  IF p_until < v_from THEN
    RETURN 0;  -- entirely before sales started counting against stock
  END IF;

  FOR r IN
    SELECT (e->>'product_id')::uuid AS product_id,
           (e->>'date')::date       AS sold_on,
           (e->>'units')::numeric   AS units
      FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e
     WHERE (e->>'date')::date >= v_from
  LOOP
    v_ref  := 'sale:' || p_source || ':' || r.sold_on || ':' || r.product_id;
    v_refs := v_refs || v_ref;

    v_item := public.finished_item_for(r.product_id);
    IF v_item IS NULL THEN
      CONTINUE;  -- nothing tracking this product's stock
    END IF;

    SELECT coalesce(sum(qty), 0) INTO v_applied
      FROM public.stock_movements WHERE source_ref = v_ref;
    v_target := -r.units;

    IF v_target <> v_applied THEN
      PERFORM public.apply_stock_delta(v_item, v_target - v_applied, r.sold_on, v_ref);
      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  -- Days that no longer have those sales — a cancelled order, or a re-sync returning less.
  FOR r IN
    SELECT m.source_ref, m.item_id, sum(m.qty) AS applied
      FROM public.stock_movements m
     WHERE m.kind = 'sale'
       AND m.source_ref LIKE 'sale:' || p_source || ':%'
       AND m.moved_on BETWEEN greatest(p_since, v_from) AND p_until
       AND NOT (m.source_ref = ANY (v_refs))
     GROUP BY m.source_ref, m.item_id
    HAVING sum(m.qty) <> 0
  LOOP
    PERFORM public.apply_stock_delta(
      r.item_id, -r.applied, split_part(r.source_ref, ':', 3)::date, r.source_ref);
    v_changed := v_changed + 1;
  END LOOP;

  RETURN v_changed;
END $$;

-- Offline sales entered in the app: the row names its product, so no matching is needed.
CREATE OR REPLACE FUNCTION public.tg_manual_sale_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  old_item  uuid;
  new_item  uuid;
  old_units numeric(14,2) := 0;
  new_units numeric(14,2) := 0;
  v_ref     text;
  v_on      date;
BEGIN
  IF tg_op = 'DELETE' THEN
    v_ref := 'sale_row:' || old.id;
    v_on  := old.order_date;
  ELSE
    v_ref := 'sale_row:' || new.id;
    v_on  := new.order_date;
  END IF;

  IF v_on < public.deduct_sales_from() THEN
    RETURN NULL;  -- before sales counted against stock
  END IF;

  IF tg_op <> 'INSERT' AND old.source = 'manual' THEN
    old_units := coalesce(old.quantity, 0);
    old_item  := public.finished_item_for(public.product_id_by_name(old.product_name));
  END IF;
  IF tg_op <> 'DELETE' AND new.source = 'manual' THEN
    new_units := coalesce(new.quantity, 0);
    new_item  := public.finished_item_for(public.product_id_by_name(new.product_name));
  END IF;

  IF old_item IS NOT DISTINCT FROM new_item THEN
    IF new_item IS NOT NULL AND new_units <> old_units THEN
      PERFORM public.apply_stock_delta(new_item, old_units - new_units, v_on, v_ref);
    END IF;
  ELSE
    -- The line was moved to another product.
    IF old_item IS NOT NULL AND old_units <> 0 THEN
      PERFORM public.apply_stock_delta(old_item, old_units, v_on, v_ref);
    END IF;
    IF new_item IS NOT NULL AND new_units <> 0 THEN
      PERFORM public.apply_stock_delta(new_item, -new_units, v_on, v_ref);
    END IF;
  END IF;
  RETURN NULL;
END $$;

-- NEW isn't available to a DELETE trigger's WHEN clause, so these are three triggers.
DROP TRIGGER IF EXISTS sales_items_manual_stock_ins ON public.sales_items;
CREATE TRIGGER sales_items_manual_stock_ins
AFTER INSERT ON public.sales_items
FOR EACH ROW WHEN (new.source = 'manual')
EXECUTE FUNCTION public.tg_manual_sale_stock();

DROP TRIGGER IF EXISTS sales_items_manual_stock_upd ON public.sales_items;
CREATE TRIGGER sales_items_manual_stock_upd
AFTER UPDATE ON public.sales_items
FOR EACH ROW WHEN (new.source = 'manual' OR old.source = 'manual')
EXECUTE FUNCTION public.tg_manual_sale_stock();

DROP TRIGGER IF EXISTS sales_items_manual_stock_del ON public.sales_items;
CREATE TRIGGER sales_items_manual_stock_del
AFTER DELETE ON public.sales_items
FOR EACH ROW WHEN (old.source = 'manual')
EXECUTE FUNCTION public.tg_manual_sale_stock();

-- Only the sync functions (service role) may post channel sales; the rest run as owner.
REVOKE ALL ON FUNCTION public.apply_sale_stock(text, date, date, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_sale_stock(text, date, date, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.product_id_by_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deduct_sales_from() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_manual_sale_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_log_stock_movement() FROM PUBLIC, anon, authenticated;
