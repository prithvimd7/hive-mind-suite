-- Allow salespersons to add sales records and CEOs to read all integration data
GRANT SELECT, INSERT ON public.sales_imports TO authenticated;
GRANT SELECT ON public.ad_spend_imports TO authenticated;
GRANT SELECT, UPDATE ON public.data_sources TO authenticated;

-- Sales imports: CEO can view everything; any authenticated user can insert records
DROP POLICY IF EXISTS "CEO can view sales" ON public.sales_imports;
CREATE POLICY "CEO can view sales"
ON public.sales_imports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

DROP POLICY IF EXISTS "Authenticated can insert sales" ON public.sales_imports;
CREATE POLICY "Authenticated can insert sales"
ON public.sales_imports FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ad spend is CEO-only
DROP POLICY IF EXISTS "CEO can view ad spend" ON public.ad_spend_imports;
CREATE POLICY "CEO can view ad spend"
ON public.ad_spend_imports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

-- Data sources / integrations: CEO manages connections
DROP POLICY IF EXISTS "CEO can view data sources" ON public.data_sources;
CREATE POLICY "CEO can view data sources"
ON public.data_sources FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

DROP POLICY IF EXISTS "CEO can update data sources" ON public.data_sources;
CREATE POLICY "CEO can update data sources"
ON public.data_sources FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'))
WITH CHECK (public.has_role(auth.uid(), 'ceo'));

-- Lock down direct execution of the signup role trigger function
REVOKE EXECUTE ON FUNCTION public.assign_role_on_signup() FROM PUBLIC, anon, authenticated;

-- Keep has_role callable by authenticated users (required for RLS policy evaluation) but not anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;