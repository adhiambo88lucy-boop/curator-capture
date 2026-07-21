
-- Enums
CREATE TYPE public.supplier_status AS ENUM ('active','inactive','blacklisted');
CREATE TYPE public.product_status AS ENUM ('discovered','watchlist','draft','published','archived');
CREATE TYPE public.listing_publish_status AS ENUM ('draft','published','archived');
CREATE TYPE public.media_kind AS ENUM ('photo','video');
CREATE TYPE public.session_status AS ENUM ('active','ended');

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  wechat text,
  market text,
  building text,
  floor text,
  booth text,
  notes text,
  status public.supplier_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CAPTURE SESSIONS
CREATE TABLE public.capture_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status public.session_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_sessions TO authenticated;
GRANT ALL ON public.capture_sessions TO service_role;
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sessions" ON public.capture_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.capture_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_code text NOT NULL UNIQUE DEFAULT ('LA-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  material text,
  tags text[] NOT NULL DEFAULT '{}',
  status public.product_status NOT NULL DEFAULT 'draft',
  discovery_date date NOT NULL DEFAULT CURRENT_DATE,
  capture_session_id uuid REFERENCES public.capture_sessions(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX products_session_idx ON public.products(capture_session_id);
CREATE INDEX products_supplier_idx ON public.products(supplier_id);
CREATE INDEX products_status_idx ON public.products(status);

-- COLOURS
CREATE TABLE public.product_colours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_colours TO authenticated;
GRANT ALL ON public.product_colours TO service_role;
ALTER TABLE public.product_colours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage colours" ON public.product_colours FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX colours_product_idx ON public.product_colours(product_id);

-- MEDIA (attached to colour)
CREATE TABLE public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colour_id uuid NOT NULL REFERENCES public.product_colours(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  url text NOT NULL,
  kind public.media_kind NOT NULL DEFAULT 'photo',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media TO authenticated;
GRANT ALL ON public.product_media TO service_role;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage media" ON public.product_media FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX media_colour_idx ON public.product_media(colour_id);
CREATE INDEX media_product_idx ON public.product_media(product_id);

-- SIZES
CREATE TABLE public.product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(product_id, size)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sizes TO authenticated;
GRANT ALL ON public.product_sizes TO service_role;
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sizes" ON public.product_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LISTINGS
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('LST-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_price_rmb numeric(12,2),
  moq int,
  available_qty int,
  publish_status public.listing_publish_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage listings" ON public.listings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX listings_product_idx ON public.listings(product_id);
CREATE INDEX listings_supplier_idx ON public.listings(supplier_id);
