-- Completes the remaining Company OS modules that were still on mock data:
-- production batches, inventory, finance (expenses + invoices), CRM and team.
-- Pattern matches earlier migrations: CEO has full access; salespeople get CRM
-- access (they work leads) and can log production batches. Everything else is CEO-only.

-- ───────────────────────── Production batches ─────────────────────────
CREATE TABLE public.production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text NOT NULL,
  batch_date date NOT NULL DEFAULT current_date,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  line_id uuid REFERENCES public.production_lines(id) ON DELETE SET NULL,
  units_planned integer NOT NULL DEFAULT 0,
  units_produced integer NOT NULL DEFAULT 0,
  rejects integer NOT NULL DEFAULT 0,
  downtime_minutes integer NOT NULL DEFAULT 0,
  protein_pct numeric(5,2),
  qc_status text NOT NULL DEFAULT 'pending' CHECK (qc_status IN ('pending', 'passed', 'failed')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX production_batches_date_idx ON public.production_batches (batch_date);
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches TO authenticated;
GRANT ALL ON public.production_batches TO service_role;

CREATE POLICY "Authenticated can view batches" ON public.production_batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can log batches" ON public.production_batches
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CEO can update batches" ON public.production_batches
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));
CREATE POLICY "CEO can delete batches" ON public.production_batches
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ceo'));

CREATE TRIGGER production_batches_touch BEFORE UPDATE ON public.production_batches
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ───────────────────────── Inventory ─────────────────────────
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  item_type text NOT NULL DEFAULT 'finished' CHECK (item_type IN ('raw', 'finished', 'packaging')),
  unit text NOT NULL DEFAULT 'units',
  stock numeric(14,2) NOT NULL DEFAULT 0,
  reorder_level numeric(14,2) NOT NULL DEFAULT 0,
  unit_cost numeric(14,2),
  expiry_date date,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

CREATE POLICY "Authenticated can view inventory" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "CEO can insert inventory" ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ceo'));
CREATE POLICY "CEO can update inventory" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));
CREATE POLICY "CEO can delete inventory" ON public.inventory_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ceo'));

CREATE TRIGGER inventory_items_touch BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Seed finished-goods rows for the existing Kettle & Tonic SKUs (stock 0 until counted).
INSERT INTO public.inventory_items (sku, name, item_type, unit, product_id)
SELECT p.sku, p.name, 'finished', 'jars', p.id FROM public.products p
ON CONFLICT (sku) DO NOTHING;

-- ───────────────────────── Finance ─────────────────────────
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  vendor text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  gst_amount numeric(14,2) NOT NULL DEFAULT 0,
  is_cogs boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid')),
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_date_idx ON public.expenses (expense_date);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

CREATE POLICY "CEO can manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  customer text NOT NULL,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  gst_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'paid')),
  paid_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

CREATE POLICY "CEO can manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));

-- ───────────────────────── CRM ─────────────────────────
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  contact_type text NOT NULL DEFAULT 'lead' CHECK (contact_type IN ('lead', 'customer', 'distributor', 'retailer')),
  stage text NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  deal_value numeric(14,2) NOT NULL DEFAULT 0,
  phone text,
  email text,
  city text,
  next_follow_up date,
  notes text,
  owner_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_contacts_stage_idx ON public.crm_contacts (stage);
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;

CREATE POLICY "Authenticated can view contacts" ON public.crm_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can add contacts" ON public.crm_contacts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owner or CEO can update contacts" ON public.crm_contacts
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'ceo'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'ceo'));
CREATE POLICY "CEO can delete contacts" ON public.crm_contacts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ceo'));

CREATE TRIGGER crm_contacts_touch BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ───────────────────────── Team ─────────────────────────
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  department text,
  email text,
  phone text,
  attendance text NOT NULL DEFAULT 'present' CHECK (attendance IN ('present', 'leave', 'absent')),
  kpi_score integer NOT NULL DEFAULT 0 CHECK (kpi_score BETWEEN 0 AND 100),
  monthly_target numeric(14,2),
  joined_on date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

CREATE POLICY "CEO can manage team" ON public.team_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE TRIGGER team_members_touch BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ───────────────────────── Existing tables: let the CEO correct sales entries ─────────────────────────
GRANT UPDATE, DELETE ON public.sales_imports TO authenticated;
CREATE POLICY "CEO can update sales" ON public.sales_imports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));
CREATE POLICY "CEO can delete sales" ON public.sales_imports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ceo'));
