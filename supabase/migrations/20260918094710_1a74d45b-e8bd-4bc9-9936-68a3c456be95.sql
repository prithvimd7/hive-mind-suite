GRANT UPDATE ON public.ad_spend_imports TO authenticated;

DROP POLICY IF EXISTS "CEO can update ad spend" ON public.ad_spend_imports;

CREATE POLICY "CEO can update ad spend" ON public.ad_spend_imports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo'))
  WITH CHECK (public.has_role(auth.uid(), 'ceo'));