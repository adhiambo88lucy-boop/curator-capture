import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BusinessShell } from "@/components/BusinessShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { calculateListingPrice } from "@/lib/pricing";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/business/pricing")({
  component: PricingStudio,
});

type Product = {
  id: string; name: string; internal_code: string; category: string | null; weight_kg: number | null;
  listings: { id: string; supplier_price_rmb: number | null }[];
  product_pricing_overrides: { markup_pct: number | null; group_buy_fee_pct: number | null; fixed_price_customer: number | null; notes: string | null } | null;
};

function PricingStudio() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["pricing-products", q],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id,name,internal_code,category,weight_kg,listings(id,supplier_price_rmb),product_pricing_overrides(markup_pct,group_buy_fee_pct,fixed_price_customer,notes)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  return (
    <BusinessShell title="Pricing Studio">
      <div className="mb-4 flex items-center justify-between gap-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="w-full max-w-sm rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div className="space-y-4">
        {products.map((p) => (
          <PricingRow key={p.id} product={p} onSaved={() => qc.invalidateQueries({ queryKey: ["pricing-products"] })} />
        ))}
        {products.length === 0 && <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No products.</div>}
      </div>
    </BusinessShell>
  );
}

function PricingRow({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const o = product.product_pricing_overrides;
  const [markup, setMarkup] = useState<string>(o?.markup_pct?.toString() ?? "");
  const [gbFee, setGbFee] = useState<string>(o?.group_buy_fee_pct?.toString() ?? "");
  const [fixed, setFixed] = useState<string>(o?.fixed_price_customer?.toString() ?? "");
  const [weight, setWeight] = useState<string>(product.weight_kg?.toString() ?? "");
  const listingId = product.listings[0]?.id;

  const { data: preview, refetch } = useQuery({
    queryKey: ["price-preview", listingId, product.weight_kg, o?.markup_pct, o?.group_buy_fee_pct, o?.fixed_price_customer],
    enabled: !!listingId,
    queryFn: () => calculateListingPrice(listingId!),
  });

  const save = useMutation({
    mutationFn: async () => {
      const wkg = weight === "" ? null : Number(weight);
      if (wkg != null) await supabase.from("products").update({ weight_kg: wkg }).eq("id", product.id);
      const payload = {
        product_id: product.id,
        markup_pct: markup === "" ? null : Number(markup),
        group_buy_fee_pct: gbFee === "" ? null : Number(gbFee),
        fixed_price_customer: fixed === "" ? null : Number(fixed),
      };
      const { error } = await supabase.from("product_pricing_overrides").upsert(payload);
      if (error) throw error;
      await logAudit({ module: "pricing", action: "override_update", entityType: "product", entityId: product.id, previous: o, next: payload });
    },
    onSuccess: () => { toast.success("Saved"); onSaved(); refetch(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const supplier = product.listings[0]?.supplier_price_rmb ?? null;
  const markupSource = String((preview as Record<string, unknown> | undefined)?.markup_source ?? "company");
  const gbSource = String((preview as Record<string, unknown> | undefined)?.group_buy_fee_source ?? "company");

  const resetField = async (field: "markup_pct" | "group_buy_fee_pct" | "fixed_price_customer") => {
    const payload: Record<string, unknown> = { product_id: product.id, [field]: null };
    const { error } = await supabase.from("product_pricing_overrides").upsert(payload as never);
    if (error) { toast.error(error.message); return; }
    if (field === "markup_pct") setMarkup("");
    if (field === "group_buy_fee_pct") setGbFee("");
    if (field === "fixed_price_customer") setFixed("");
    toast.success("Reset to inherited");
    onSaved(); refetch();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{product.internal_code} · {product.category ?? "—"}</div>
          <div className="font-semibold">{product.name}</div>
          <div className="text-xs text-muted-foreground">Supplier price: {supplier != null ? `¥${supplier}` : "—"}</div>
        </div>
        {preview && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. customer price</div>
            <div className="text-lg font-semibold">{String(preview.currency)} {Number(preview.customer_price).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Margin {Number(preview.margin_pct).toFixed(1)}% {preview.below_min_margin ? "· ⚠ below min" : ""}</div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Labeled label="Markup %" source={markupSource} onReset={o?.markup_pct != null ? () => resetField("markup_pct") : undefined}>
          <input value={markup} onChange={(e) => setMarkup(e.target.value)} placeholder="inherit" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </Labeled>
        <Labeled label="Group buy fee %" source={gbSource} onReset={o?.group_buy_fee_pct != null ? () => resetField("group_buy_fee_pct") : undefined}>
          <input value={gbFee} onChange={(e) => setGbFee(e.target.value)} placeholder="inherit" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </Labeled>
        <Labeled label="Fixed customer price" onReset={o?.fixed_price_customer != null ? () => resetField("fixed_price_customer") : undefined}>
          <input value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="auto" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </Labeled>
        <Labeled label="Weight (kg)"><input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="default" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" /></Labeled>
      </div>

      {preview && (
        <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            <Line l="Supplier" v={`¥${Number(preview.supplier_price_rmb ?? 0).toFixed(2)}`} />
            <Line l="Shipping" v={`¥${Number(preview.shipping_cost_rmb).toFixed(2)}`} />
            <Line l="+ Markup" v={`${Number(preview.markup_pct)}%`} />
            <Line l="→ RMB" v={`¥${Number(preview.with_markup_rmb).toFixed(2)}`} />
            <Line l="Exchange" v={`${Number(preview.exchange_rate)} (+${Number(preview.exchange_margin_pct)}%)`} />
            <Line l="Rounding" v={String(preview.rounding_mode)} />
            <Line l="Customer" v={`${String(preview.currency)} ${Number(preview.customer_price).toFixed(2)}`} />
            <Line l="Group buy" v={`${String(preview.currency)} ${Number(preview.group_buy_price).toFixed(2)}`} />
            <Line l="Profit" v={`${String(preview.currency)} ${Number(preview.estimated_profit).toFixed(2)}`} />
            <Line l="Margin" v={`${Number(preview.margin_pct).toFixed(1)}%`} />
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <AppButton onClick={() => save.mutate()} disabled={save.isPending}>Save overrides</AppButton>
      </div>
    </div>
  );
}

function Labeled({ label, children, source, onReset }: { label: string; children: React.ReactNode; source?: string; onReset?: () => void }) {
  const badge: Record<string, string> = {
    company: "bg-muted text-muted-foreground",
    category: "bg-sky-100 text-sky-700",
    product: "bg-emerald-100 text-emerald-700",
  };
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="flex items-center gap-1">
          {source && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${badge[source] ?? badge.company}`}>{source}</span>
          )}
          {onReset && (
            <button type="button" onClick={onReset} className="text-[10px] text-muted-foreground hover:text-foreground underline">reset</button>
          )}
        </div>
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Line({ l, v }: { l: string; v: string }) {
  return <div><span className="text-muted-foreground">{l}:</span> <span className="font-medium text-foreground">{v}</span></div>;
}
