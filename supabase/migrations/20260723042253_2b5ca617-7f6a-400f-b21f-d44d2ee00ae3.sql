
-- Category pricing overrides (Company → Category → Product hierarchy)
CREATE TABLE public.category_pricing_overrides (
  category_id UUID NOT NULL PRIMARY KEY REFERENCES public.categories(id) ON DELETE CASCADE,
  markup_pct NUMERIC(6,3),
  group_buy_fee_pct NUMERIC(6,3),
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_pricing_overrides TO authenticated;
GRANT ALL ON public.category_pricing_overrides TO service_role;
ALTER TABLE public.category_pricing_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage category overrides" ON public.category_pricing_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Anyone read category overrides" ON public.category_pricing_overrides
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_cpo_updated BEFORE UPDATE ON public.category_pricing_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Update pricing function to consult category override between product override and defaults
CREATE OR REPLACE FUNCTION public.calculate_listing_price(_listing_id uuid, _currency text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_listing RECORD; v_product RECORD; v_override RECORD; v_cat_override RECORD;
  v_markup NUMERIC; v_gb_fee NUMERIC; v_min_margin NUMERIC;
  v_markup_source TEXT; v_gb_source TEXT;
  v_rounding TEXT; v_default_ship_co UUID; v_default_method TEXT;
  v_currency TEXT; v_weight NUMERIC;
  v_ship_rate NUMERIC := 0; v_ship_cost_rmb NUMERIC := 0;
  v_ex_rate NUMERIC := 1; v_ex_margin NUMERIC := 0;
  v_base_rmb NUMERIC; v_with_markup_rmb NUMERIC;
  v_customer NUMERIC; v_gb_customer NUMERIC;
  v_profit NUMERIC; v_margin_pct NUMERIC;
  v_default_markup NUMERIC; v_default_gb NUMERIC;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = _listing_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','listing_not_found'); END IF;
  SELECT * INTO v_product FROM public.products WHERE id = v_listing.product_id;
  SELECT * INTO v_override FROM public.product_pricing_overrides WHERE product_id = v_listing.product_id;
  IF v_product.category_id IS NOT NULL THEN
    SELECT * INTO v_cat_override FROM public.category_pricing_overrides WHERE category_id = v_product.category_id;
  END IF;

  v_default_markup := (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key='commercial.default_markup_pct');
  v_default_gb := (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key='commercial.group_buy_fee_pct');

  IF v_override.markup_pct IS NOT NULL THEN
    v_markup := v_override.markup_pct; v_markup_source := 'product';
  ELSIF v_cat_override.markup_pct IS NOT NULL THEN
    v_markup := v_cat_override.markup_pct; v_markup_source := 'category';
  ELSE
    v_markup := v_default_markup; v_markup_source := 'company';
  END IF;

  IF v_override.group_buy_fee_pct IS NOT NULL THEN
    v_gb_fee := v_override.group_buy_fee_pct; v_gb_source := 'product';
  ELSIF v_cat_override.group_buy_fee_pct IS NOT NULL THEN
    v_gb_fee := v_cat_override.group_buy_fee_pct; v_gb_source := 'category';
  ELSE
    v_gb_fee := v_default_gb; v_gb_source := 'company';
  END IF;

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
    'markup_source', v_markup_source,
    'group_buy_fee_pct', v_gb_fee,
    'group_buy_fee_source', v_gb_source,
    'fixed_price_active', v_override.fixed_price_customer IS NOT NULL,
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
END; $function$;
