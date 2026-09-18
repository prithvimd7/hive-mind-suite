-- Create a private schema that is not exposed via the Supabase API
CREATE SCHEMA IF NOT EXISTS private;

-- Recreate the role check helper in the private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Let authenticated users invoke the helper through RLS policies
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

-- Update policies to use the private helper
DROP POLICY IF EXISTS "CEO can view sales" ON public.sales_imports;
CREATE POLICY "CEO can view sales"
ON public.sales_imports FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'ceo'));

DROP POLICY IF EXISTS "CEO can view ad spend" ON public.ad_spend_imports;
CREATE POLICY "CEO can view ad spend"
ON public.ad_spend_imports FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'ceo'));

DROP POLICY IF EXISTS "CEO can view data sources" ON public.data_sources;
CREATE POLICY "CEO can view data sources"
ON public.data_sources FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'ceo'));

DROP POLICY IF EXISTS "CEO can update data sources" ON public.data_sources;
CREATE POLICY "CEO can update data sources"
ON public.data_sources FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'ceo'))
WITH CHECK (private.has_role(auth.uid(), 'ceo'));

-- Remove the public copy so it is no longer reachable via the API
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);