-- Product-level sales lines: which item sold, how many, for how much.
--
-- sales_imports stays the daily revenue/order total per channel (what the dashboard uses);
-- this table holds the per-product detail behind it, so totals never double count.
-- Products are matched by name, as channels use their own SKU codes.

CREATE TABLE IF NOT EXISTS public.sales_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date date NOT NULL,
  channel text NOT NULL,
  source text NOT NULL,
  product_name text NOT NULL,
  sku text,
  quantity numeric(14,2) NOT NULL DEFAULT 0,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  /** Stable id for a synced line, so re-running a sync replaces instead of duplicating. */
  import_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_items_date_idx ON public.sales_items (order_date);
CREATE INDEX IF NOT EXISTS sales_items_product_idx ON public.sales_items (product_name);
CREATE INDEX IF NOT EXISTS sales_items_source_date_idx ON public.sales_items (source, order_date);

ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_items TO authenticated;
GRANT ALL ON public.sales_items TO service_role;

-- Same access model as sales_imports: CEO reads, any signed-in user can add, CEO can correct.
DROP POLICY IF EXISTS "CEO can view sales items" ON public.sales_items;
CREATE POLICY "CEO can view sales items" ON public.sales_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ceo'));

DROP POLICY IF EXISTS "Authenticated can insert sales items" ON public.sales_items;
CREATE POLICY "Authenticated can insert sales items" ON public.sales_items
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "CEO can update sales items" ON public.sales_items;
CREATE POLICY "CEO can update sales items" ON public.sales_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));

DROP POLICY IF EXISTS "CEO can delete sales items" ON public.sales_items;
CREATE POLICY "CEO can delete sales items" ON public.sales_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ceo'));
