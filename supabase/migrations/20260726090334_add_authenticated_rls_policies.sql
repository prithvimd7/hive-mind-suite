-- Grant table-level privileges to authenticated users (RLS still applies on top of this).
GRANT SELECT, INSERT ON public.sales_imports TO authenticated;
GRANT SELECT ON public.ad_spend_imports TO authenticated;
GRANT SELECT, UPDATE ON public.data_sources TO authenticated;

-- sales_imports: CEO can view everything; any authenticated user (CEO or salesperson) can add entries.
CREATE POLICY "CEO can view sales"
ON public.sales_imports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "Authenticated can insert sales"
ON public.sales_imports FOR INSERT
TO authenticated
WITH CHECK (true);

-- ad_spend_imports: CEO-only read (marketing spend is sensitive).
CREATE POLICY "CEO can view ad spend"
ON public.ad_spend_imports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

-- data_sources: CEO can view and update connection status/config (Integrations page).
CREATE POLICY "CEO can view data sources"
ON public.data_sources FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "CEO can update data sources"
ON public.data_sources FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'))
WITH CHECK (public.has_role(auth.uid(), 'ceo'));
