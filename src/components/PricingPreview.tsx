import { useQuery } from "@tanstack/react-query";
import { calculateListingPrice } from "@/lib/pricing";

export function PricingPreview({ listingId }: { listingId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["price-preview-editor", listingId],
    queryFn: () => calculateListingPrice(listingId),
    staleTime: 15_000,
  });

  if (isLoading) return <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">Calculating…</div>;
  if (error) return <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">Pricing unavailable.</div>;
  if (!data) return null;

  const p = data as Record<string, number | string | boolean>;
  const belowMin = Boolean(p.below_min_margin);
  const markupSource = String(p.markup_source ?? "company");
  const gbSource = String(p.group_buy_fee_source ?? "company");
  const fixedActive = Boolean(p.fixed_price_active);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">Pricing preview (admin)</h3>
        <span className={`text-[10px] uppercase tracking-wider ${belowMin ? "text-destructive" : "text-muted-foreground"}`}>
          {belowMin ? "Below min margin" : "Live"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Cell l="Supplier" v={`¥${num(p.supplier_price_rmb)}`} />
        <Cell l="Shipping" v={`¥${num(p.shipping_cost_rmb)}`} />
        <Cell l="Markup" v={`${num(p.markup_pct)}%`} badge={markupSource} />
        <Cell l="Group buy fee" v={`${num(p.group_buy_fee_pct)}%`} badge={gbSource} />
        <Cell l="Rounding" v={String(p.rounding_mode)} />
        <Cell l="Customer" v={`${p.currency} ${num(p.customer_price)}`} badge={fixedActive ? "fixed" : undefined} accent />
        <Cell l="Group buy" v={`${p.currency} ${num(p.group_buy_price)}`} />
        <Cell l="Margin" v={`${num(p.margin_pct)}%`} accent={!belowMin} danger={belowMin} />
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        Source key: <SourceLabel s="company" /> company default · <SourceLabel s="category" /> category override · <SourceLabel s="product" /> product override.
      </div>
    </section>
  );
}

function num(v: unknown) { return Number(v ?? 0).toFixed(2); }

function Cell({ l, v, accent, danger, badge }: { l: string; v: string; accent?: boolean; danger?: boolean; badge?: string }) {
  return (
    <div className={`rounded-lg border border-border p-2 ${accent ? "bg-foreground/5" : ""} ${danger ? "border-destructive/50 text-destructive" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
        {badge && <SourceLabel s={badge} />}
      </div>
      <div className="mt-0.5 font-medium text-foreground">{v}</div>
    </div>
  );
}

function SourceLabel({ s }: { s: string }) {
  const map: Record<string, string> = {
    company: "bg-muted text-muted-foreground",
    category: "bg-sky-100 text-sky-700",
    product: "bg-emerald-100 text-emerald-700",
    fixed: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${map[s] ?? map.company}`}>
      {s}
    </span>
  );
}
