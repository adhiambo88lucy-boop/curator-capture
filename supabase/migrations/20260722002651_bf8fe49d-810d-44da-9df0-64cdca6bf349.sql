
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage currencies" ON public.currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL REFERENCES public.currencies(code) ON DELETE CASCADE,
  rate_to_rmb NUMERIC(14,6) NOT NULL,
  margin_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ex_rates_currency_effective_idx ON public.exchange_rates(currency_code, effective_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage exchange_rates" ON public.exchange_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.shipping_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_companies TO authenticated;
GRANT ALL ON public.shipping_companies TO service_role;
ALTER TABLE public.shipping_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shipping_companies" ON public.shipping_companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.shipping_companies(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('sea','air','express')),
  rate NUMERIC(12,4) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  est_days_min INT,
  est_days_max INT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  internal_notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shipping_rates_company_method_idx ON public.shipping_rates(company_id, method);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_rates TO authenticated;
GRANT ALL ON public.shipping_rates TO service_role;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shipping_rates" ON public.shipping_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.product_pricing_overrides (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  markup_pct NUMERIC(6,3),
  group_buy_fee_pct NUMERIC(6,3),
  fixed_price_customer NUMERIC(14,2),
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_pricing_overrides TO authenticated;
GRANT ALL ON public.product_pricing_overrides TO service_role;
ALTER TABLE public.product_pricing_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pricing overrides" ON public.product_pricing_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  previous JSONB,
  next JSONB,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_module_idx ON public.audit_log(module, created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND actor = auth.uid());

CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_currencies_updated BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_shipping_companies_updated BEFORE UPDATE ON public.shipping_companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_shipping_rates_updated BEFORE UPDATE ON public.shipping_rates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pricing_overrides_updated BEFORE UPDATE ON public.product_pricing_overrides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.apply_rounding(_value NUMERIC, _mode TEXT)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _mode
    WHEN 'nearest_1' THEN ROUND(_value)
    WHEN 'nearest_5' THEN ROUND(_value/5)*5
    WHEN 'nearest_10' THEN ROUND(_value/10)*10
    WHEN 'nearest_50' THEN ROUND(_value/50)*50
    ELSE ROUND(_value,2)
  END;
$$;

INSERT INTO public.currencies(code,name,symbol,active) VALUES
  ('CNY','Chinese Yuan','¥',TRUE),
  ('USD','US Dollar','$',TRUE),
  ('NGN','Nigerian Naira','₦',TRUE),
  ('EUR','Euro','€',TRUE);

INSERT INTO public.exchange_rates(currency_code,rate_to_rmb,margin_pct,notes) VALUES
  ('CNY',1.0,0,'Base'),
  ('USD',0.14,2.5,'Seed'),
  ('NGN',210.0,3.0,'Seed'),
  ('EUR',0.13,2.5,'Seed');

INSERT INTO public.shipping_companies(id,name,active,internal_notes) VALUES
  ('11111111-1111-1111-1111-111111111111','Default Freight',TRUE,'Placeholder — update with real rates');

INSERT INTO public.shipping_rates(company_id,method,rate,unit,est_days_min,est_days_max) VALUES
  ('11111111-1111-1111-1111-111111111111','sea',6,'kg',30,45),
  ('11111111-1111-1111-1111-111111111111','air',35,'kg',7,12),
  ('11111111-1111-1111-1111-111111111111','express',60,'kg',3,6);

INSERT INTO public.app_settings(key,value,description) VALUES
  ('commercial.default_markup_pct', '35'::jsonb, 'Default platform markup percentage'),
  ('commercial.group_buy_fee_pct', '8'::jsonb, 'Service fee applied to group buy reservations'),
  ('commercial.min_profit', '5'::jsonb, 'Minimum acceptable profit per unit'),
  ('commercial.min_margin_pct', '15'::jsonb, 'Minimum acceptable margin percentage'),
  ('commercial.max_manual_markup_pct', '200'::jsonb, 'Maximum manual markup admin can set'),
  ('commercial.rounding_mode', '"nearest_1"'::jsonb, 'Rounding mode'),
  ('commercial.auto_pricing_enabled', 'true'::jsonb, 'Auto pricing on/off'),
  ('commercial.default_shipping_method', '"sea"'::jsonb, 'Default shipping method'),
  ('commercial.default_shipping_company_id', '"11111111-1111-1111-1111-111111111111"'::jsonb, 'Default shipping company id'),
  ('commercial.default_currency', '"USD"'::jsonb, 'Default display currency'),
  ('commercial.exchange_rate_stale_days', '7'::jsonb, 'Warn when exchange rate older than this'),
  ('commercial.shipping_rate_stale_days', '30'::jsonb, 'Warn when shipping rate older than this'),
  ('commercial.default_weight_kg', '0.5'::jsonb, 'Fallback per-unit weight');

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,3);

CREATE OR REPLACE FUNCTION public.calculate_listing_price(_listing_id UUID, _currency TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_listing RECORD; v_product RECORD; v_override RECORD;
  v_markup NUMERIC; v_gb_fee NUMERIC; v_min_margin NUMERIC;
  v_rounding TEXT; v_default_ship_co UUID; v_default_method TEXT;
  v_currency TEXT; v_weight NUMERIC;
  v_ship_rate NUMERIC := 0; v_ship_cost_rmb NUMERIC := 0;
  v_ex_rate NUMERIC := 1; v_ex_margin NUMERIC := 0;
  v_base_rmb NUMERIC; v_with_markup_rmb NUMERIC;
  v_customer NUMERIC; v_gb_customer NUMERIC;
  v_profit NUMERIC; v_margin_pct NUMERIC;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = _listing_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','listing_not_found'); END IF;
  SELECT * INTO v_product FROM public.products WHERE id = v_listing.product_id;
  SELECT * INTO v_override FROM public.product_pricing_overrides WHERE product_id = v_listing.product_id;

  v_markup := COALESCE(v_override.markup_pct, (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key='commercial.default_markup_pct'));
  v_gb_fee := COALESCE(v_override.group_buy_fee_pct, (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key='commercial.group_buy_fee_pct'));
  v_min_margin := (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key='commercial.min_margin_pct');
  v_rounding := (SELECT value#>>'{}' FROM app_settings WHERE key='commercial.rounding_mode');
  v_default_ship_co := (SELECT (value#>>'{}')::uuid FROM app_settings WHERE key='commercial.default_shipping_company_id');
  v_default_method := (SELECT value#>>'{}' FROM app_settings WHERE key='commercial.default_shipping_method');
  v_currency := COALESCE(_currency, (SELECT value#>>'{}' FROM app_settings WHERE key='commercial.default_currency'));
  v_weight := COALESCE(v_product.weight_kg, (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key='commercial.default_weight_kg'));

  SELECT rate INTO v_ship_rate FROM public.shipping_rates
    WHERE company_id = v_default_ship_co AND method = v_default_method AND active
    ORDER BY updated_at DESC LIMIT 1;
  v_ship_rate := COALESCE(v_ship_rate,0);
  v_ship_cost_rmb := v_ship_rate * v_weight;

  SELECT rate_to_rmb, margin_pct INTO v_ex_rate, v_ex_margin
    FROM public.exchange_rates WHERE currency_code = v_currency
    ORDER BY effective_at DESC LIMIT 1;
  v_ex_rate := COALESCE(v_ex_rate,1); v_ex_margin := COALESCE(v_ex_margin,0);

  v_base_rmb := COALESCE(v_listing.supplier_price_rmb,0) + v_ship_cost_rmb;
  v_with_markup_rmb := v_base_rmb * (1 + v_markup/100.0);

  IF v_currency = 'CNY' THEN
    v_customer := v_with_markup_rmb;
  ELSE
    v_customer := v_with_markup_rmb * v_ex_rate * (1 + v_ex_margin/100.0);
  END IF;

  IF v_override.fixed_price_customer IS NOT NULL THEN
    v_customer := v_override.fixed_price_customer;
  END IF;

  v_customer := public.apply_rounding(v_customer, v_rounding);
  v_gb_customer := public.apply_rounding(v_customer * (1 + v_gb_fee/100.0), v_rounding);
  v_profit := v_customer - (v_base_rmb * v_ex_rate);
  v_margin_pct := CASE WHEN v_customer > 0 THEN (v_profit / v_customer) * 100 ELSE 0 END;

  RETURN jsonb_build_object(
    'listing_id', v_listing.id,
    'currency', v_currency,
    'supplier_price_rmb', v_listing.supplier_price_rmb,
    'weight_kg', v_weight,
    'shipping_rate_rmb_per_unit', v_ship_rate,
    'shipping_cost_rmb', v_ship_cost_rmb,
    'markup_pct', v_markup,
    'group_buy_fee_pct', v_gb_fee,
    'exchange_rate', v_ex_rate,
    'exchange_margin_pct', v_ex_margin,
    'base_rmb', v_base_rmb,
    'with_markup_rmb', v_with_markup_rmb,
    'customer_price', v_customer,
    'group_buy_price', v_gb_customer,
    'estimated_profit', v_profit,
    'margin_pct', v_margin_pct,
    'below_min_margin', v_margin_pct < v_min_margin,
    'rounding_mode', v_rounding,
    'shipping_method', v_default_method
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.calculate_listing_price(UUID, TEXT) TO authenticated;
