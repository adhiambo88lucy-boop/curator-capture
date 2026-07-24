import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MarketShell } from "@/components/MarketShell";
import { AppButton } from "@/components/AppButton";
import { getSignedMediaUrls } from "@/lib/marketMedia";
import { Heart, Users, Play, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/market/product/$productId")({
  ssr: false,
  component: ProductDetail,
});

function ProductDetail() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [signedInUser, setSignedInUser] = useState<string | null>(null);
  const [activeColourId, setActiveColourId] = useState<string | null>(null);
  const [reserveQty, setReserveQty] = useState<string>("1");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedInUser(data.user?.id ?? null));
  }, []);

  const { data: product, isLoading } = useQuery({
    queryKey: ["market-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,description,material,tags,internal_code,product_colours(id,name,sort_order),product_media(id,storage_path,colour_id,kind,sort_order),product_sizes(id,size,sort_order),listings(id,supplier_price_rmb,moq,available_qty,group_buy_enabled,group_buy_deadline,publish_status)")
        .eq("id", productId)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const listing = ((product?.listings ?? []) as Array<{ id: string; supplier_price_rmb: number | null; moq: number | null; available_qty: number | null; group_buy_enabled: boolean; group_buy_deadline: string | null; publish_status: string }>).find((l) => l.publish_status === "published");

  const { data: progress = 0 } = useQuery({
    queryKey: ["gb-progress", listing?.id],
    enabled: !!listing?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_buy_progress", { _listing_id: listing!.id });
      if (error) throw error;
      return data as number;
    },
  });

  const colours = ((product?.product_colours ?? []) as Array<{ id: string; name: string; sort_order: number }>).sort((a, b) => a.sort_order - b.sort_order);
  const media = ((product?.product_media ?? []) as Array<{ id: string; storage_path: string; colour_id: string; kind: string; sort_order: number }>).sort((a, b) => a.sort_order - b.sort_order);
  const sizes = ((product?.product_sizes ?? []) as Array<{ id: string; size: string; sort_order: number }>).sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    if (!activeColourId && colours[0]) setActiveColourId(colours[0].id);
  }, [colours, activeColourId]);

  const visibleMedia = useMemo(() => (activeColourId ? media.filter((m) => m.colour_id === activeColourId) : media), [media, activeColourId]);

  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = visibleMedia.map((m) => m.storage_path);
    if (paths.length === 0) { setUrls({}); return; }
    getSignedMediaUrls(paths).then(setUrls);
  }, [visibleMedia]);

  const { data: isFav } = useQuery({
    queryKey: ["favorite", productId, signedInUser],
    enabled: !!signedInUser,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("id").eq("product_id", productId).eq("user_id", signedInUser!).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!signedInUser) throw new Error("Sign in to save favorites");
      if (isFav) {
        const { error } = await supabase.from("favorites").delete().eq("product_id", productId).eq("user_id", signedInUser);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("favorites").insert({ product_id: productId, user_id: signedInUser });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorite", productId, signedInUser] });
      toast.success(isFav ? "Removed from favorites" : "Saved to favorites");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const reserve = useMutation({
    mutationFn: async (type: "group_buy" | "full_moq") => {
      if (!signedInUser) throw new Error("Sign in to reserve");
      if (!listing) throw new Error("No active listing");
      const qty = type === "full_moq" ? (listing.moq ?? 1) : Number(reserveQty);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("Enter a valid quantity");
      const { error } = await supabase.from("group_buy_reservations").insert({
        listing_id: listing.id,
        buyer_id: signedInUser,
        quantity: qty,
        reservation_type: type,
        colour_id: activeColourId,
        workflow_stage: "curator_review",
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reservation placed — the curator team will review it shortly.");
      qc.invalidateQueries({ queryKey: ["gb-progress", listing?.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) return <MarketShell><div className="text-sm text-muted-foreground">Loading…</div></MarketShell>;
  if (!product) return <MarketShell><div className="text-sm">Product not available.</div></MarketShell>;

  const moq = listing?.moq ?? 0;
  const reserved = progress ?? 0;
  const pct = moq > 0 ? Math.min(100, Math.round((reserved / moq) * 100)) : 0;

  return (
    <MarketShell>
      <button onClick={() => navigate({ to: "/market/browse" })} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to browse
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-[3/4] w-full overflow-hidden rounded-3xl border border-border bg-muted">
            {visibleMedia[0] ? (
              visibleMedia[0].kind === "video" ? (
                <video src={urls[visibleMedia[0].storage_path]} controls className="h-full w-full object-cover" />
              ) : (
                <img src={urls[visibleMedia[0].storage_path]} alt={product.name} className="h-full w-full object-cover" />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No media</div>
            )}
          </div>
          {visibleMedia.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {visibleMedia.map((m) => (
                <div key={m.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                  {m.kind === "video" ? (
                    <div className="flex h-full items-center justify-center bg-black/80"><Play className="h-4 w-4 text-white" /></div>
                  ) : (
                    <img src={urls[m.storage_path]} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{product.category}</div>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">{product.name}</h1>
          <div className="mt-1 text-xs text-muted-foreground">Ref {product.internal_code}</div>

          <div className="mt-6 flex items-baseline gap-4">
            <div className="font-display text-4xl font-bold text-foreground">{listing?.supplier_price_rmb ? `¥${listing.supplier_price_rmb}` : "Price on request"}</div>
            {listing?.moq && <div className="text-sm text-muted-foreground">Full MOQ · {listing.moq} units</div>}
          </div>

          {colours.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Colour</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {colours.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveColourId(c.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${activeColourId === c.id ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-foreground/50"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sizes</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <span key={s.id} className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium">{s.size}</span>
                ))}
              </div>
            </div>
          )}

          {listing?.group_buy_enabled && listing.moq && (
            <div className="mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                <Users className="h-4 w-4" /> Group Buy — reserve your share
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{reserved} / {listing.moq} units reserved</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
              {listing.group_buy_deadline && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Closes {new Date(listing.group_buy_deadline).toLocaleDateString()}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={reserveQty}
                  onChange={(e) => setReserveQty(e.target.value)}
                  className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <AppButton className="flex-1" onClick={() => reserve.mutate("group_buy")} disabled={reserve.isPending || !signedInUser}>
                  {signedInUser ? "Reserve" : <Link to="/market/auth">Sign in to reserve</Link>}
                </AppButton>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {listing && (
              <AppButton variant="outline" className="flex-1" onClick={() => reserve.mutate("full_moq")} disabled={reserve.isPending || !signedInUser || !listing.moq}>
                Order Full MOQ ({listing.moq ?? "—"})
              </AppButton>
            )}
            <button
              onClick={() => toggleFav.mutate()}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${isFav ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-muted"}`}
              aria-label="Favorite"
            >
              <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
            </button>
          </div>

          {product.description && (
            <div className="mt-8">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</div>
              <p className="mt-2 whitespace-pre-line text-sm text-foreground">{product.description}</p>
            </div>
          )}
          {product.material && (
            <div className="mt-4 text-sm text-muted-foreground"><span className="font-medium text-foreground">Material:</span> {product.material}</div>
          )}
          {product.tags && (product.tags as string[]).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(product.tags as string[]).map((t) => (
                <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">#{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </MarketShell>
  );
}
