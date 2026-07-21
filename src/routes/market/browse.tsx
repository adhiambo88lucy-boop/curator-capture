import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { MarketShell } from "@/components/MarketShell";
import { getSignedMediaUrls } from "@/lib/marketMedia";
import { Field, Input, Select } from "@/components/ui/field";
import { Users } from "lucide-react";

const searchSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  q: z.string().optional(),
  groupBuy: z.string().optional(),
});

export const Route = createFileRoute("/market/browse")({
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  component: BrowsePage,
});

type Row = {
  id: string;
  name: string;
  category: string;
  cover_path: string | null;
  price: number | null;
  moq: number | null;
  group_buy_enabled: boolean;
  category_id: string | null;
  subcategory_id: string | null;
};

function BrowsePage() {
  const initial = Route.useSearch();
  const [q, setQ] = useState(initial.q ?? "");
  const [categorySlug, setCategorySlug] = useState(initial.category ?? "");
  const [subcategorySlug, setSubcategorySlug] = useState(initial.subcategory ?? "");
  const [groupBuyOnly, setGroupBuyOnly] = useState(initial.groupBuy === "1");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [maxMoq, setMaxMoq] = useState<string>("");

  const { data: categories = [] } = useQuery({
    queryKey: ["market-categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug,sort_order,subcategories(id,name,slug,sort_order)")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeCategory = categories.find((c) => c.slug === categorySlug);
  const subcats = ((activeCategory?.subcategories ?? []) as Array<{ id: string; name: string; slug: string; sort_order: number }>).sort((a, b) => a.sort_order - b.sort_order);

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["market-browse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,category_id,subcategory_id,product_media(storage_path,sort_order),listings(supplier_price_rmb,moq,group_buy_enabled,publish_status)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((p) => {
        const media = (p.product_media ?? []) as Array<{ storage_path: string; sort_order: number }>;
        media.sort((a, b) => a.sort_order - b.sort_order);
        const listing = ((p.listings ?? []) as Array<{ supplier_price_rmb: number | null; moq: number | null; group_buy_enabled: boolean; publish_status: string }>).find((l) => l.publish_status === "published");
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          category_id: p.category_id,
          subcategory_id: p.subcategory_id,
          cover_path: media[0]?.storage_path ?? null,
          price: listing?.supplier_price_rmb ?? null,
          moq: listing?.moq ?? null,
          group_buy_enabled: listing?.group_buy_enabled ?? false,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (activeCategory && r.category_id !== activeCategory.id) return false;
      if (subcategorySlug) {
        const sc = subcats.find((s) => s.slug === subcategorySlug);
        if (sc && r.subcategory_id !== sc.id) return false;
      }
      if (groupBuyOnly && !r.group_buy_enabled) return false;
      if (maxPrice && r.price !== null && r.price > Number(maxPrice)) return false;
      if (maxMoq && r.moq !== null && r.moq > Number(maxMoq)) return false;
      return true;
    });
  }, [rows, q, activeCategory, subcategorySlug, subcats, groupBuyOnly, maxPrice, maxMoq]);

  return (
    <MarketShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">Browse</h1>
        <p className="mt-1 text-sm text-muted-foreground">{filtered.length} pieces available</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <Field label="Search"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name…" /></Field>
          <Field label="Category">
            <Select value={categorySlug} onChange={(e) => { setCategorySlug(e.target.value); setSubcategorySlug(""); }}>
              <option value="">All</option>
              {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </Select>
          </Field>
          {subcats.length > 0 && (
            <Field label="Subcategory">
              <Select value={subcategorySlug} onChange={(e) => setSubcategorySlug(e.target.value)}>
                <option value="">All</option>
                {subcats.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Max price (¥)"><Input inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></Field>
          <Field label="Max MOQ"><Input inputMode="numeric" value={maxMoq} onChange={(e) => setMaxMoq(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={groupBuyOnly} onChange={(e) => setGroupBuyOnly(e.target.checked)} />
            Group Buy only
          </label>
        </aside>

        <div>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No products match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {filtered.map((p) => <BrowseTile key={p.id} row={p} />)}
            </div>
          )}
        </div>
      </div>
    </MarketShell>
  );
}

function BrowseTile({ row }: { row: Row }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!row.cover_path) return;
    getSignedMediaUrls([row.cover_path]).then((m) => setImgUrl(m[row.cover_path!] ?? null));
  }, [row.cover_path]);

  return (
    <Link
      to="/market/product/$productId"
      params={{ productId: row.id }}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-lg"
    >
      <div className="aspect-[3/4] w-full bg-muted">
        {imgUrl ? <img src={imgUrl} alt={row.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>}
      </div>
      <div className="p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{row.category}</div>
        <div className="mt-1 line-clamp-1 font-medium text-foreground">{row.name}</div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">{row.price ? `¥${row.price}` : "—"}</span>
          <span className="text-muted-foreground">MOQ {row.moq ?? "—"}</span>
        </div>
        {row.group_buy_enabled && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            <Users className="h-3 w-3" /> Group Buy
          </div>
        )}
      </div>
    </Link>
  );
}
