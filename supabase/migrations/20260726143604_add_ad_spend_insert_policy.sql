GRANT INSERT ON public.ad_spend_imports TO authenticated;

CREATE POLICY "CEO can insert ad spend"
ON public.ad_spend_imports FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'ceo'));
