-- Bank statement import for Finance.
--
-- expenses.import_ref lets a re-uploaded statement be recognised instead of duplicated, and
-- expense_import_rules remembers "this narration means this category" so each month gets easier.

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS import_ref text;
CREATE INDEX IF NOT EXISTS expenses_import_ref_idx ON public.expenses (import_ref);

CREATE TABLE IF NOT EXISTS public.expense_import_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  category text NOT NULL,
  is_cogs boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pattern)
);

ALTER TABLE public.expense_import_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_import_rules TO authenticated;
GRANT ALL ON public.expense_import_rules TO service_role;

DROP POLICY IF EXISTS "CEO can manage import rules" ON public.expense_import_rules;
CREATE POLICY "CEO can manage import rules" ON public.expense_import_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ceo')) WITH CHECK (public.has_role(auth.uid(), 'ceo'));
