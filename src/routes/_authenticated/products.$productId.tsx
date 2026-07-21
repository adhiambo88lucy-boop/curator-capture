import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatusPill } from "@/components/StatusPill";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Upload, Trash2, Check } from "lucide-react";
import { uploadMedia, signedUrl, removeMedia } from "@/lib/media";

export const Route = createFileRoute("/_authenticated/products/$productId")({
  component: ProductEditor,
});

const STATUSES = ["discovered", "watchlist", "draft", "published", "archived"] as const;
const CATEGORIES = ["Dresses", "Tops", "Bottoms", "Outerwear", "Shoes", "Bags", "Accessories", "Kids", "Other"];
const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

type Colour = { id: string; name: string; sort_order: number };
type Media = { id: string; colour_id: string; storage_path: string; kind: "photo" | "video"; sort_order: number };
type Size = { id: string; size: string };
type Listing = {
  id: string;
  code: string;
  supplier_id: string;
  product_id: string;
  supplier_price_rmb: number | null;
  moq: number | null;
  available_qty: number | null;
  publish_status: "draft" | "published" | "archived";
};

function ProductEditor() {
  const { productId } = Route.useParams();
  const qc = useQueryClient();

  const productQ = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,description,material,tags,status,internal_code,discovery_date,supplier:suppliers(id,name)")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const coloursQ = useQuery({
    queryKey: ["product-colours", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_colours")
        .select("id,name,sort_order")
        .eq("product_id", productId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Colour[];
    },
  });

  const mediaQ = useQuery({
    queryKey: ["product-media", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_media")
        .select("id,colour_id,storage_path,kind,sort_order")
        .eq("product_id", productId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Media[];
    },
  });

  const sizesQ = useQuery({
    queryKey: ["product-sizes", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_sizes")
        .select("id,size,sort_order")
        .eq("product_id", productId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Size[];
    },
  });

  const listingQ = useQuery({
    queryKey: ["product-listing", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,code,supplier_id,product_id,supplier_price_rmb,moq,available_qty,publish_status")
        .eq("product_id", productId)
        .maybeSingle();
      if (error) throw error;
      return data as Listing | null;
    },
  });

  const product = productQ.data;
  const colours = coloursQ.data ?? [];
  const media = mediaQ.data ?? [];
  const sizes = sizesQ.data ?? [];
  const listing = listingQ.data;

  const [selectedColour, setSelectedColour] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedColour && colours.length) setSelectedColour(colours[0].id);
  }, [colours, selectedColour]);

  if (productQ.isLoading) return <AppShell title="Product"><div>Loading…</div></AppShell>;
  if (!product) return <AppShell title="Product" back="/products"><div>Not found.</div></AppShell>;

  return (
    <AppShell title={product.name} back="/products">
      <div className="space-y-6">
        <ProductBasics product={product as ProductRow} productId={productId} />
        <CompletenessCard product={product as ProductRow} colours={colours} media={media} listing={listing ?? null} />
        <ColoursSection
          productId={productId}
          colours={colours}
          selected={selectedColour}
          onSelect={setSelectedColour}
        />
        {selectedColour && (
          <MediaSection
            productId={productId}
            colourId={selectedColour}
            media={media.filter((m) => m.colour_id === selectedColour)}
            onChanged={() => qc.invalidateQueries({ queryKey: ["product-media", productId] })}
          />
        )}
        <SizesSection productId={productId} sizes={sizes} />
        <ListingSection productId={productId} supplierId={((product as ProductRow).supplier?.id) ?? null} listing={listing ?? null} />
      </div>
    </AppShell>
  );
}

type ProductRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  material: string | null;
  tags: string[] | null;
  status: string;
  internal_code: string;
  discovery_date: string;
  supplier: { id: string; name: string } | null;
};

/* ─────────── Basics ─────────── */

function ProductBasics({ product, productId }: { product: ProductRow; productId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: product.name as string,
    category: product.category as string,
    description: (product.description as string) ?? "",
    material: (product.material as string) ?? "",
    tags: ((product.tags as string[]) ?? []).join(", "),
    status: product.status as string,
  });
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { error } = await supabase
        .from("products")
        .update({
          name: form.name,
          category: form.category,
          description: form.description || null,
          material: form.material || null,
          tags,
          status: form.status as never,
        })
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["product", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm({ ...form, [k]: v });
    setDirty(true);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {product.internal_code as string} · discovered {product.discovery_date as string}
          </div>
        </div>
        <StatusPill status={form.status} />
      </div>
      <div className="space-y-3">
        <Field label="Product name" required>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category">
            <Select value={form.category} onChange={(e) => update("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => update("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Material"><Input value={form.material} onChange={(e) => update("material", e.target.value)} /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></Field>
        <Field label="Tags" hint="Comma separated"><Input value={form.tags} onChange={(e) => update("tags", e.target.value)} /></Field>
        {dirty && (
          <AppButton className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </AppButton>
        )}
      </div>
    </section>
  );
}

/* ─────────── Completeness ─────────── */

function CompletenessCard({
  product, colours, media, listing,
}: {
  product: { name: string; category: string; supplier: unknown };
  colours: Colour[];
  media: Media[];
  listing: Listing | null;
}) {
  const checks = [
    { label: "Product name", ok: !!product.name },
    { label: "Category", ok: !!product.category },
    { label: "Supplier", ok: !!product.supplier },
    { label: "Colour variant", ok: colours.length > 0 },
    { label: "Photos", ok: media.some((m) => m.kind === "photo") },
    { label: "Listing price", ok: !!listing?.supplier_price_rmb },
    { label: "MOQ", ok: !!listing?.moq },
  ];
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Completeness</div>
        <div className="text-sm font-semibold">{pct}%</div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-1.5 text-muted-foreground">
            {c.ok ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className={c.ok ? "text-foreground" : ""}>{c.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────── Colours ─────────── */

function ColoursSection({
  productId, colours, selected, onSelect,
}: {
  productId: string;
  colours: Colour[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Colour name required");
      const { data, error } = await supabase
        .from("product_colours")
        .insert({ product_id: productId, name: name.trim(), sort_order: colours.length })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["product-colours", productId] });
      setAdding(false);
      setName("");
      onSelect(id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_colours").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-colours", productId] });
      qc.invalidateQueries({ queryKey: ["product-media", productId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Colour variants
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-xs font-medium text-accent hover:underline">
            + Add colour
          </button>
        )}
      </div>
      {adding && (
        <div className="mb-3 flex gap-2">
          <Input autoFocus placeholder="e.g. Black, Pink…" value={name} onChange={(e) => setName(e.target.value)} />
          <AppButton onClick={() => add.mutate()} disabled={add.isPending}>Add</AppButton>
          <AppButton variant="outline" onClick={() => { setAdding(false); setName(""); }}>Cancel</AppButton>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {colours.map((c) => (
          <div key={c.id} className="flex items-center overflow-hidden rounded-full border border-border">
            <button
              onClick={() => onSelect(c.id)}
              className={`px-3 py-1.5 text-sm ${selected === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {c.name}
            </button>
            <button
              onClick={() => { if (confirm(`Delete colour "${c.name}" and all its media?`)) del.mutate(c.id); }}
              className="border-l border-border px-2 py-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Delete colour"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {colours.length === 0 && !adding && (
          <div className="text-xs text-muted-foreground">No colours yet. Add one to attach photos.</div>
        )}
      </div>
    </section>
  );
}

/* ─────────── Media ─────────── */

function MediaSection({
  productId, colourId, media, onChanged,
}: {
  productId: string;
  colourId: string;
  media: Media[];
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const urls = useQueries({
    queries: media.map((m) => ({
      queryKey: ["signed", m.storage_path],
      queryFn: () => signedUrl(m.storage_path, 3600),
      staleTime: 30 * 60_000,
    })),
  });

  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      let order = media.length;
      for (const file of Array.from(files)) {
        const path = await uploadMedia(file, productId, colourId);
        const kind: "photo" | "video" = file.type.startsWith("video") ? "video" : "photo";
        const { error } = await supabase.from("product_media").insert({
          product_id: productId,
          colour_id: colourId,
          storage_path: path,
          url: path,
          kind,
          sort_order: order++,
        });
        if (error) throw error;
      }
      toast.success(`${files.length} uploaded`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const del = async (m: Media) => {
    if (!confirm("Remove this media?")) return;
    try {
      await removeMedia(m.storage_path);
      const { error } = await supabase.from("product_media").delete().eq("id", m.id);
      if (error) throw error;
      toast.success("Removed");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Photos & videos
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {media.map((m, i) => {
          const url = urls[i]?.data;
          return (
            <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              {url ? (
                m.kind === "video" ? (
                  <video src={url} className="h-full w-full object-cover" controls preload="metadata" />
                ) : (
                  <img src={url} alt="" className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">…</div>
              )}
              <button
                onClick={() => del(m)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {m.kind === "video" && (
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  video
                </span>
              )}
            </div>
          );
        })}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-accent hover:text-foreground"
        >
          <Plus className="h-6 w-6" />
          <span className="text-[10px]">Add</span>
        </button>
      </div>
    </section>
  );
}

/* ─────────── Sizes ─────────── */

function SizesSection({ productId, sizes }: { productId: string; sizes: Size[] }) {
  const qc = useQueryClient();
  const active = useMemo(() => new Set(sizes.map((s) => s.size)), [sizes]);
  const [custom, setCustom] = useState("");

  const toggle = useMutation({
    mutationFn: async (label: string) => {
      const existing = sizes.find((s) => s.size === label);
      if (existing) {
        const { error } = await supabase.from("product_sizes").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_sizes")
          .insert({ product_id: productId, size: label, sort_order: sizes.length });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-sizes", productId] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    setCustom("");
    if (!active.has(v)) toggle.mutate(v);
  };

  const options = Array.from(new Set([...DEFAULT_SIZES, ...sizes.map((s) => s.size)]));

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Sizes
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {options.map((label) => {
          const on = active.has(label);
          return (
            <button
              key={label}
              onClick={() => toggle.mutate(label)}
              className={`h-10 min-w-[3rem] rounded-lg border px-3 text-sm font-medium ${
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Custom size" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <AppButton variant="outline" onClick={addCustom}>Add</AppButton>
      </div>
    </section>
  );
}

/* ─────────── Listing ─────────── */

function ListingSection({
  productId, supplierId, listing,
}: {
  productId: string;
  supplierId: string | null;
  listing: Listing | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    supplier_price_rmb: listing?.supplier_price_rmb?.toString() ?? "",
    moq: listing?.moq?.toString() ?? "",
    available_qty: listing?.available_qty?.toString() ?? "",
    publish_status: listing?.publish_status ?? "draft",
  });
  useEffect(() => {
    setForm({
      supplier_price_rmb: listing?.supplier_price_rmb?.toString() ?? "",
      moq: listing?.moq?.toString() ?? "",
      available_qty: listing?.available_qty?.toString() ?? "",
      publish_status: listing?.publish_status ?? "draft",
    });
  }, [listing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Product has no supplier");
      const payload = {
        product_id: productId,
        supplier_id: supplierId,
        supplier_price_rmb: form.supplier_price_rmb ? Number(form.supplier_price_rmb) : null,
        moq: form.moq ? Number(form.moq) : null,
        available_qty: form.available_qty ? Number(form.available_qty) : null,
        publish_status: form.publish_status as "draft" | "published" | "archived",
      };
      if (listing) {
        const { error } = await supabase.from("listings").update(payload).eq("id", listing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("listings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-listing", productId] });
      toast.success("Listing saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Listing (supplier offer)
        </div>
        {listing && <span className="text-[10px] text-muted-foreground">{listing.code}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Price (RMB)">
          <Input type="number" inputMode="decimal" value={form.supplier_price_rmb} onChange={(e) => setForm({ ...form, supplier_price_rmb: e.target.value })} />
        </Field>
        <Field label="MOQ">
          <Input type="number" inputMode="numeric" value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} />
        </Field>
        <Field label="Avail. Qty">
          <Input type="number" inputMode="numeric" value={form.available_qty} onChange={(e) => setForm({ ...form, available_qty: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Publish status">
          <Select value={form.publish_status} onChange={(e) => setForm({ ...form, publish_status: e.target.value as never })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      </div>
      <AppButton className="mt-4 w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : listing ? "Update listing" : "Create listing"}
      </AppButton>
    </section>
  );
}

