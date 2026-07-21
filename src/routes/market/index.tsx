import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarketShell } from "@/components/MarketShell";
import { getSignedMediaUrls } from "@/lib/marketMedia";
import { Sparkles, TrendingUp, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/market/")({
  ssr: false,
  component: MarketHome,
});

type ProductCard = {
  id: string;
  name: string;
  category: string;
  internal_code: string;
  created_at: string;
  cover_path: string | null;
  price: number | null;
  moq: number | null;
  group_buy_enabled: boolean;
};

function MarketHome() {
  const { data: categories = [] } = useQuery({
    queryKey: ["market-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,slug,sort_order").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery<ProductCard[]>({
    queryKey: ["market-new"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,internal_code,created_at,product_media(storage_path,sort_order),listings(supplier_price_rmb,moq,group_buy_enabled,publish_status)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []).map((p) => {
        const media = (p.product_media ?? []) as Array<{ storage_path: string; sort_order: number }>;
        media.sort((a, b) => a.sort_order - b.sort_order);
        const listing = ((p.listings ?? []) as Array<{ supplier_price_rmb: number | null; moq: number | null; group_buy_enabled: boolean; publish_status: string }>).find((l) => l.publish_status === "published");
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          internal_code: p.internal_code,
          created_at: p.created_at,
          cover_path: media[0]?.storage_path ?? null,
          price: listing?.supplier_price_rmb ?? null,
          moq: listing?.moq ?? null,
          group_buy_enabled: listing?.group_buy_enabled ?? false,
        };
      });
    },
  });

  return (
    <MarketShell>
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary via-primary to-accent px-6 py-14 text-primary-foreground md:px-12 md:py-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-widest">
            <Sparkles className="h-3 w-3" /> Curated in Guangzhou
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight md:text-6xl">
            Fashion, ready for your storefront.
          </h1>
          <p className="mt-4 max-w-lg text-sm text-primary-foreground/80 md:text-base">
            Hand-picked pieces sourced weekly from the world's largest wholesale markets — small MOQs, group buys, direct-from-supplier prices.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/market/browse" className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary hover:opacity-90">
              Browse marketplace <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/market/auth" className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-semibold hover:bg-white/10">
              Create buyer account
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-foreground">Shop by category</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/market/browse"
              search={{ category: c.slug }}
              className="group flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-6 transition hover:border-foreground/30 hover:shadow-sm"
            >
              <span className="font-display text-base font-semibold text-foreground">{c.name}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            <Sparkles className="mr-2 inline h-5 w-5 text-accent" />
            New today
          </h2>
          <Link to="/market/browse" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            See all →
          </Link>
        </div>
        <ProductGrid products={products.slice(0, 8)} />
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            <Users className="mr-2 inline h-5 w-5 text-accent" />
            Group Buy — join to unlock MOQ
          </h2>
        </div>
        <ProductGrid products={products.filter((p) => p.group_buy_enabled).slice(0, 4)} />
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            <TrendingUp className="mr-2 inline h-5 w-5 text-accent" />
            Trending
          </h2>
        </div>
        <ProductGrid products={products.slice(0, 4)} />
      </section>

      <section className="mt-12 rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Coming soon</div>
        <h3 className="mt-3 font-display text-2xl font-semibold text-foreground">Market Live</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Watch our curators shop the markets in real time. Reserve pieces as they're discovered.
        </p>
      </section>
    </MarketShell>
  );
}

function ProductGrid({ products }: { products: ProductCard[] }) {
  if (products.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        Nothing published yet. Check back soon.
      </div>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
      {products.map((p) => <ProductCardTile key={p.id} product={p} />)}
    </div>
  );
}

function ProductCardTile({ product }: { product: ProductCard }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!product.cover_path) return;
    getSignedMediaUrls([product.cover_path]).then((m) => setImgUrl(m[product.cover_path!] ?? null));
  }, [product.cover_path]);

  return (
    <Link
      to="/market/product/$productId"
      params={{ productId: product.id }}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-lg"
    >
      <div className="aspect-[3/4] w-full bg-muted">
        {imgUrl ? (
          <img src={imgUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{product.category}</div>
        <div className="mt-1 line-clamp-1 font-medium text-foreground">{product.name}</div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">{product.price ? `¥${product.price}` : "—"}</span>
          <span className="text-muted-foreground">MOQ {product.moq ?? "—"}</span>
        </div>
        {product.group_buy_enabled && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            <Users className="h-3 w-3" /> Group Buy
          </div>
        )}
      </div>
    </Link>
  );
}
