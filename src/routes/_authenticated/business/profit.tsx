import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { BusinessShell } from "@/components/BusinessShell";
import { supabase } from "@/integrations/supabase/client";
import { calculateListingPrice } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/business/profit")({
  component: ProfitDashboard,
});

interface Listing { id: string; supplier_price_rmb: number | null; product: { id: string; name: string; internal_code: string } | null }

function ProfitDashboard() {
  const { data: listings = [] } = useQuery({
    queryKey: ["profit-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,supplier_price_rmb,product:products(id,name,internal_code)")
        .eq("publish_status", "published")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Listing[];
    },
  });

  const results = useQueries({
    queries: listings.map((l) => ({
      queryKey: ["price-preview", l.id],
      queryFn: () => calculateListingPrice(l.id),
      staleTime: 30_000,
    })),
  });

  const rows = listings.map((l, i) => {
    const p = results[i]?.data as Record<string, number | string | boolean> | undefined;
    if (!p) return null;
    return {
      id: l.id,
      product: l.product,
      customer: Number(p.customer_price),
      profit: Number(p.estimated_profit),
      margin: Number(p.margin_pct),
      belowMin: Boolean(p.below_min_margin),
      groupBuy: Number(p.group_buy_price),
      currency: String(p.currency),
    };
  }).filter(Boolean) as Array<{ id: string; product: Listing["product"]; customer: number; profit: number; margin: number; belowMin: boolean; groupBuy: number; currency: string }>;

  const avgMargin = rows.length ? rows.reduce((a, b) => a + b.margin, 0) / rows.length : 0;
  const grossProfit = rows.reduce((a, b) => a + b.profit, 0);
  const sortedHigh = [...rows].sort((a, b) => b.margin - a.margin).slice(0, 5);
  const sortedLow = [...rows].sort((a, b) => a.margin - b.margin).slice(0, 5);
  const belowMin = rows.filter((r) => r.belowMin);
  const currency = rows[0]?.currency ?? "";

  return (
    <BusinessShell title="Profit Dashboard">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Average margin" value={`${avgMargin.toFixed(1)}%`} />
        <Stat label={`Expected gross profit (${currency})`} value={grossProfit.toFixed(2)} />
        <Stat label="Below target margin" value={`${belowMin.length} / ${rows.length}`} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel title="Highest margin"><Table rows={sortedHigh} /></Panel>
        <Panel title="Lowest margin"><Table rows={sortedLow} /></Panel>
      </div>

      {belowMin.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">Products below target margin</div>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {belowMin.map((r) => <li key={r.id}>{r.product?.internal_code} — {r.product?.name} · {r.margin.toFixed(1)}%</li>)}
          </ul>
        </div>
      )}
    </BusinessShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}
function Table({ rows }: { rows: Array<{ id: string; product: { internal_code: string; name: string } | null; customer: number; profit: number; margin: number; currency: string }> }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground"><tr><th className="py-1">Product</th><th className="py-1 text-right">Price</th><th className="py-1 text-right">Profit</th><th className="py-1 text-right">Margin</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border/50">
            <td className="py-1">{r.product?.internal_code} {r.product?.name}</td>
            <td className="py-1 text-right">{r.currency} {r.customer.toFixed(2)}</td>
            <td className="py-1 text-right">{r.profit.toFixed(2)}</td>
            <td className="py-1 text-right">{r.margin.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
