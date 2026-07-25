
CREATE TABLE public.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind)
);
GRANT ALL ON public.data_sources TO service_role;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sales_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  channel text,
  order_date date NOT NULL,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  external_id text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_imports_source_date_idx ON public.sales_imports (source, order_date);
GRANT ALL ON public.sales_imports TO service_role;
ALTER TABLE public.sales_imports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ad_spend_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  campaign text,
  spend_date date NOT NULL,
  spend numeric(14,2) NOT NULL DEFAULT 0,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_spend_imports_platform_date_idx ON public.ad_spend_imports (platform, spend_date);
GRANT ALL ON public.ad_spend_imports TO service_role;
ALTER TABLE public.ad_spend_imports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER data_sources_touch BEFORE UPDATE ON public.data_sources
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

INSERT INTO public.data_sources (kind, label, status) VALUES
  ('shopify',       'Shopify',            'disconnected'),
  ('amazon_seller', 'Amazon Seller',      'disconnected'),
  ('meta_ads',      'Meta Ads',           'disconnected'),
  ('amazon_ads',    'Amazon Ads',         'disconnected'),
  ('blinkit',       'Blinkit Seller',     'disconnected'),
  ('offline',       'Offline (CSV)',      'disconnected');
