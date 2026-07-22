// Central client-side pricing service.
// The SQL function `calculate_listing_price` is the canonical source of truth
// used by other modules (reservations, orders, etc.). This file mirrors it for
// live previews in the admin UI and exposes helpers so no other module needs
// to implement pricing math.

import { supabase } from "@/integrations/supabase/client";

export type RoundingMode = "nearest_1" | "nearest_5" | "nearest_10" | "nearest_50";

export interface PricingInputs {
  supplierPriceRmb: number;
  weightKg: number;
  shippingRatePerUnitRmb: number;
  markupPct: number;
  groupBuyFeePct: number;
  exchangeRate: number; // currency units per RMB
  exchangeMarginPct: number;
  rounding: RoundingMode;
  currency: string;
  fixedCustomerPrice?: number | null;
  minMarginPct: number;
}

export interface PricingBreakdown {
  currency: string;
  supplierPriceRmb: number;
  shippingCostRmb: number;
  baseRmb: number;
  markupPct: number;
  withMarkupRmb: number;
  exchangeRate: number;
  exchangeMarginPct: number;
  customerPrice: number;
  groupBuyFeePct: number;
  groupBuyPrice: number;
  estimatedProfit: number;
  marginPct: number;
  belowMinMargin: boolean;
  roundingMode: RoundingMode;
}

export function applyRounding(v: number, mode: RoundingMode): number {
  switch (mode) {
    case "nearest_5": return Math.round(v / 5) * 5;
    case "nearest_10": return Math.round(v / 10) * 10;
    case "nearest_50": return Math.round(v / 50) * 50;
    default: return Math.round(v);
  }
}

export function computePricing(i: PricingInputs): PricingBreakdown {
  const shippingCostRmb = i.shippingRatePerUnitRmb * i.weightKg;
  const baseRmb = i.supplierPriceRmb + shippingCostRmb;
  const withMarkupRmb = baseRmb * (1 + i.markupPct / 100);
  let customerPrice: number;
  if (i.currency === "CNY") {
    customerPrice = withMarkupRmb;
  } else {
    customerPrice = withMarkupRmb * i.exchangeRate * (1 + i.exchangeMarginPct / 100);
  }
  if (i.fixedCustomerPrice != null) customerPrice = i.fixedCustomerPrice;
  customerPrice = applyRounding(customerPrice, i.rounding);
  const groupBuyPrice = applyRounding(customerPrice * (1 + i.groupBuyFeePct / 100), i.rounding);
  const estimatedProfit = customerPrice - baseRmb * i.exchangeRate;
  const marginPct = customerPrice > 0 ? (estimatedProfit / customerPrice) * 100 : 0;
  return {
    currency: i.currency,
    supplierPriceRmb: i.supplierPriceRmb,
    shippingCostRmb,
    baseRmb,
    markupPct: i.markupPct,
    withMarkupRmb,
    exchangeRate: i.exchangeRate,
    exchangeMarginPct: i.exchangeMarginPct,
    customerPrice,
    groupBuyFeePct: i.groupBuyFeePct,
    groupBuyPrice,
    estimatedProfit,
    marginPct,
    belowMinMargin: marginPct < i.minMarginPct,
    roundingMode: i.rounding,
  };
}

/** Load a flat settings map from the app_settings table. */
export async function loadSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from("app_settings").select("key,value");
  if (error) throw error;
  const map: Record<string, unknown> = {};
  for (const r of data ?? []) map[r.key as string] = r.value;
  return map;
}

/** Convenience wrapper around the canonical SQL pricing function. */
export async function calculateListingPrice(listingId: string, currency?: string) {
  const args: { _listing_id: string; _currency?: string } = { _listing_id: listingId };
  if (currency) args._currency = currency;
  const { data, error } = await supabase.rpc("calculate_listing_price", args);
  if (error) throw error;
  return data as Record<string, number | string | boolean>;
}
