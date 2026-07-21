import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarketShell } from "@/components/MarketShell";
import { getSignedMediaUrls } from "@/lib/marketMedia";

export const Route = createFileRoute("/market/favorites")({
  ssr: false,
  component: FavoritesPage,
});

function FavoritesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: favs = [] } = useQuery({
    queryKey: ["favorites", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("product:products(id,name,category,product_media(storage_path,sort_order))")
        .eq("user_id", userId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!userId) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">Sign in to save favorites</h1>
          <Link to="/market/auth" className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground">Sign in</Link>
        </div>
      </MarketShell>
    );
  }

  return (
    <MarketShell>
      <h1 className="font-display text-3xl font-bold text-foreground">Favorites</h1>
      {favs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No favorites yet. Browse and tap the heart to save pieces.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {favs.map((f) => {
            const p = f.product as { id: string; name: string; category: string; product_media: Array<{ storage_path: string; sort_order: number }> } | null;
            if (!p) return null;
            return <FavTile key={p.id} product={p} />;
          })}
        </div>
      )}
    </MarketShell>
  );
}

function FavTile({ product }: { product: { id: string; name: string; category: string; product_media: Array<{ storage_path: string; sort_order: number }> } }) {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    const sorted = [...product.product_media].sort((a, b) => a.sort_order - b.sort_order);
    if (sorted[0]) getSignedMediaUrls([sorted[0].storage_path]).then((m) => setImg(m[sorted[0].storage_path] ?? null));
  }, [product.product_media]);
  return (
    <Link to="/market/product/$productId" params={{ productId: product.id }} className="group block overflow-hidden rounded-2xl border border-border bg-card">
      <div className="aspect-[3/4] w-full bg-muted">
        {img ? <img src={img} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>}
      </div>
      <div className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{product.category}</div>
        <div className="mt-1 line-clamp-1 font-medium text-foreground">{product.name}</div>
      </div>
    </Link>
  );
}
