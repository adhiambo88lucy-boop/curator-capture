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
        <Cell l="Markup" v={`${num(p.markup_pct)}%`} />
        <Cell l="Rounding" v={String(p.rounding_mode)} />
        <Cell l="Customer" v={`${p.currency} ${num(p.customer_price)}`} accent />
        <Cell l="Group buy" v={`${p.currency} ${num(p.group_buy_price)}`} />
        <Cell l="Profit" v={`${p.currency} ${num(p.estimated_profit)}`} />
        <Cell l="Margin" v={`${num(p.margin_pct)}%`} accent={!belowMin} danger={belowMin} />
      </div>
    </section>
  );
}

function num(v: unknown) { return Number(v ?? 0).toFixed(2); }
function Cell({ l, v, accent, danger }: { l: string; v: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-lg border border-border p-2 ${accent ? "bg-foreground/5" : ""} ${danger ? "border-destructive/50 text-destructive" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
      <div className="mt-0.5 font-medium text-foreground">{v}</div>
    </div>
  );
}
