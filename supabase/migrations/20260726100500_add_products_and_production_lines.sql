-- Products: real SKUs (Kettle & Tonic + any future lines)
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  unit_cost numeric,
  retail_price numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

CREATE POLICY "Authenticated can view products"
ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "CEO can insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can update products"
ON public.products FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'ceo'))
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can delete products"
ON public.products FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

-- Production lines
CREATE TABLE public.production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity_per_day integer,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_lines TO authenticated;

CREATE POLICY "Authenticated can view production lines"
ON public.production_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "CEO can insert production lines"
ON public.production_lines FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can update production lines"
ON public.production_lines FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'ceo'))
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can delete production lines"
ON public.production_lines FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

-- Seed the real Kettle & Tonic SKUs so the app isn't empty on first load
INSERT INTO public.products (sku, name, category, is_active) VALUES
  ('KT-MBB-001', 'Mutton Bone Broth', 'Bone Broth', true),
  ('KT-CBB-002', 'Chicken Bone Broth', 'Bone Broth', true),
  ('KT-GTB-003', 'Golden Tonic', 'Bone Broth', true);

INSERT INTO public.production_lines (name, capacity_per_day, status) VALUES
  ('Retort Line 1', 250, 'active');
