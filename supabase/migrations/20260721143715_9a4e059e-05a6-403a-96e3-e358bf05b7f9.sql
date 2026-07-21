
-- ============== ROLES ==============
CREATE TYPE public.app_role AS ENUM ('admin', 'buyer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "self buyer signup" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'buyer');
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'::public.app_role FROM auth.users
  ON CONFLICT DO NOTHING;

-- ============== BUYER PROFILES ==============
CREATE TABLE public.buyer_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text,
  contact_name text,
  country text,
  city text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.buyer_profiles TO authenticated;
GRANT ALL ON public.buyer_profiles TO service_role;
ALTER TABLE public.buyer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own buyer profile" ON public.buyer_profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_buyer_profiles_updated BEFORE UPDATE ON public.buyer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== CATEGORIES ==============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin write categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
GRANT SELECT ON public.subcategories TO anon, authenticated;
GRANT ALL ON public.subcategories TO service_role;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read subcategories" ON public.subcategories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin write subcategories" ON public.subcategories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

WITH cat_ins AS (
  INSERT INTO public.categories (name, slug, sort_order) VALUES
    ('Womenswear','womenswear',1),('Menswear','menswear',2),('Kidswear','kidswear',3),
    ('Shoes','shoes',4),('Bags','bags',5),('Accessories','accessories',6),
    ('Jewelry','jewelry',7),('Home & Textiles','home-textiles',8)
  RETURNING id, slug
)
INSERT INTO public.subcategories (category_id, name, slug, sort_order)
SELECT c.id, sub.name, sub.slug, sub.sort_order FROM cat_ins c
JOIN (VALUES
  ('womenswear','Dresses','dresses',1),('womenswear','Tops','tops',2),('womenswear','Bottoms','bottoms',3),
  ('womenswear','Outerwear','outerwear',4),('womenswear','Sets & Suits','sets-suits',5),
  ('menswear','Shirts','shirts',1),('menswear','Pants','pants',2),('menswear','Outerwear','outerwear',3),('menswear','Suits','suits',4),
  ('kidswear','Girls','girls',1),('kidswear','Boys','boys',2),('kidswear','Baby','baby',3),
  ('shoes','Heels','heels',1),('shoes','Sneakers','sneakers',2),('shoes','Sandals','sandals',3),('shoes','Boots','boots',4),
  ('bags','Handbags','handbags',1),('bags','Backpacks','backpacks',2),('bags','Clutches','clutches',3),
  ('accessories','Belts','belts',1),('accessories','Hats','hats',2),('accessories','Scarves','scarves',3),('accessories','Sunglasses','sunglasses',4),
  ('jewelry','Necklaces','necklaces',1),('jewelry','Earrings','earrings',2),('jewelry','Bracelets','bracelets',3),('jewelry','Rings','rings',4),
  ('home-textiles','Bedding','bedding',1),('home-textiles','Curtains','curtains',2),('home-textiles','Rugs','rugs',3)
) AS sub(cat_slug,name,slug,sort_order) ON sub.cat_slug = c.slug;

-- ============== SUPPLIER LOCATION ==============
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS city text;

-- ============== PRODUCT ADDITIONS ==============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.subcategories(id);
ALTER TABLE public.products
  ALTER COLUMN internal_code SET DEFAULT ('P-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)));

ALTER TABLE public.listings
  ALTER COLUMN code SET DEFAULT ('L-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  ADD COLUMN IF NOT EXISTS group_buy_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS group_buy_deadline timestamptz;

-- Public read policies for buyer marketplace
CREATE POLICY "public read published listings" ON public.listings
  FOR SELECT TO anon, authenticated USING (publish_status = 'published');
CREATE POLICY "public read published products" ON public.products
  FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "public read colours of published" ON public.product_colours
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'published')
  );
CREATE POLICY "public read media of published" ON public.product_media
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'published')
  );
CREATE POLICY "public read sizes of published" ON public.product_sizes
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'published')
  );

-- Storage: allow authenticated users to read from private product-media bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='authenticated read product-media') THEN
    EXECUTE $p$CREATE POLICY "authenticated read product-media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-media')$p$;
  END IF;
END $$;

-- ============== FAVORITES ==============
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites" ON public.favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============== GROUP BUY RESERVATIONS ==============
CREATE TYPE public.reservation_status AS ENUM ('pending','confirmed','cancelled');

CREATE TABLE public.group_buy_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0),
  status public.reservation_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_buy_reservations TO authenticated;
GRANT ALL ON public.group_buy_reservations TO service_role;
ALTER TABLE public.group_buy_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reservations" ON public.group_buy_reservations FOR ALL TO authenticated
  USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "admins read all reservations" ON public.group_buy_reservations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON public.group_buy_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_group_buy_progress(_listing_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(quantity),0)::int FROM public.group_buy_reservations
  WHERE listing_id = _listing_id AND status IN ('pending','confirmed');
$$;
GRANT EXECUTE ON FUNCTION public.get_group_buy_progress(uuid) TO anon, authenticated;
