import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BusinessShell } from "@/components/BusinessShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { Plus, Trash2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business/categories")({
  component: CategoriesPage,
});

type Category = { id: string; name: string; slug: string; sort_order: number };
type Sub = { id: string; category_id: string; name: string; slug: string; sort_order: number };
type CatOverride = {
  category_id: string;
  markup_pct: number | null;
  group_buy_fee_pct: number | null;
  notes: string | null;
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function CategoriesPage() {
  const qc = useQueryClient();
  const [newCat, setNewCat] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subcategories").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Sub[];
    },
  });
  const { data: overrides = [] } = useQuery({
    queryKey: ["cat-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase.from("category_pricing_overrides").select("*");
      if (error) throw error;
      return (data ?? []) as CatOverride[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["cats"] });
    qc.invalidateQueries({ queryKey: ["subs"] });
    qc.invalidateQueries({ queryKey: ["cat-overrides"] });
  };

  const addCategory = useMutation({
    mutationFn: async () => {
      const name = newCat.trim();
      if (!name) throw new Error("Enter a name");
      const { error } = await supabase.from("categories").insert({ name, slug: slugify(name) });
      if (error) throw error;
      await logAudit({ module: "categories", action: "create", entityType: "category", next: { name } });
    },
    onSuccess: () => { setNewCat(""); invalidateAll(); toast.success("Category added"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (c: Category) => {
      if (!confirm(`Delete category "${c.name}"? This also deletes its subcategories.`)) throw new Error("cancelled");
      const { error } = await supabase.from("categories").delete().eq("id", c.id);
      if (error) throw error;
      await logAudit({ module: "categories", action: "delete", entityType: "category", entityId: c.id, previous: c });
    },
    onSuccess: invalidateAll,
    onError: (e) => { if ((e as Error).message !== "cancelled") toast.error((e as Error).message); },
  });

  return (
    <BusinessShell title="Categories & Pricing Overrides">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Manage categories, subcategories and category-level pricing overrides. Pricing follows
        <span className="mx-1 font-medium text-foreground">Company → Category → Product</span>.
        Leave a field blank to inherit from the parent level.
      </p>

      <div className="mb-6 flex items-end gap-2">
        <label className="flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">New category</div>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="e.g. Handbags"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <AppButton onClick={() => addCategory.mutate()} disabled={addCategory.isPending}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </AppButton>
      </div>

      <div className="space-y-4">
        {categories.map((c) => (
          <CategoryCard
            key={c.id}
            category={c}
            subs={subs.filter((s) => s.category_id === c.id)}
            override={overrides.find((o) => o.category_id === c.id) ?? null}
            onDelete={() => deleteCategory.mutate(c)}
            onChanged={invalidateAll}
          />
        ))}
        {categories.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No categories yet.
          </div>
        )}
      </div>
    </BusinessShell>
  );
}

function CategoryCard({
  category, subs, override, onDelete, onChanged,
}: {
  category: Category;
  subs: Sub[];
  override: CatOverride | null;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [markup, setMarkup] = useState(override?.markup_pct?.toString() ?? "");
  const [gbFee, setGbFee] = useState(override?.group_buy_fee_pct?.toString() ?? "");
  const [notes, setNotes] = useState(override?.notes ?? "");
  const [newSub, setNewSub] = useState("");

  const markupMode: "auto" | "manual" = markup === "" ? "auto" : "manual";
  const gbMode: "auto" | "manual" = gbFee === "" ? "auto" : "manual";

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        category_id: category.id,
        markup_pct: markup === "" ? null : Number(markup),
        group_buy_fee_pct: gbFee === "" ? null : Number(gbFee),
        notes: notes || null,
      };
      const { error } = await supabase.from("category_pricing_overrides").upsert(payload);
      if (error) throw error;
      await logAudit({
        module: "pricing", action: "category_override_update",
        entityType: "category", entityId: category.id,
        previous: override, next: payload,
      });
    },
    onSuccess: () => { toast.success("Saved"); onChanged(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("category_pricing_overrides").delete().eq("category_id", category.id);
      if (error) throw error;
      await logAudit({
        module: "pricing", action: "category_override_reset",
        entityType: "category", entityId: category.id, previous: override,
      });
    },
    onSuccess: () => {
      setMarkup(""); setGbFee(""); setNotes("");
      toast.success("Reset to inherited");
      onChanged();
    },
  });

  const addSub = useMutation({
    mutationFn: async () => {
      const name = newSub.trim();
      if (!name) throw new Error("Enter a name");
      const { error } = await supabase.from("subcategories").insert({ category_id: category.id, name, slug: slugify(name) });
      if (error) throw error;
    },
    onSuccess: () => { setNewSub(""); onChanged(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteSub = useMutation({
    mutationFn: async (s: Sub) => {
      if (!confirm(`Delete subcategory "${s.name}"?`)) throw new Error("cancelled");
      const { error } = await supabase.from("subcategories").delete().eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: (e) => { if ((e as Error).message !== "cancelled") toast.error((e as Error).message); },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{category.slug}</div>
          <div className="text-lg font-semibold">{category.name}</div>
        </div>
        <button
          onClick={onDelete}
          className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete category"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <FieldWithMode
          label="Markup %"
          mode={markupMode}
          value={markup}
          onChange={setMarkup}
          onReset={() => setMarkup("")}
          placeholder="inherits company default"
        />
        <FieldWithMode
          label="Group buy fee %"
          mode={gbMode}
          value={gbFee}
          onChange={setGbFee}
          onReset={() => setGbFee("")}
          placeholder="inherits company default"
        />
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        {override && (
          <button
            onClick={() => reset.mutate()}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" /> Reset to company default
          </button>
        )}
        <AppButton onClick={() => save.mutate()} disabled={save.isPending}>Save</AppButton>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Subcategories</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {subs.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
              {s.name}
              <button onClick={() => deleteSub.mutate(s)} aria-label="Remove" className="text-muted-foreground hover:text-destructive">×</button>
            </span>
          ))}
          {subs.length === 0 && <span className="text-xs text-muted-foreground">None yet.</span>}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            placeholder="New subcategory"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <AppButton onClick={() => addSub.mutate()} disabled={addSub.isPending}>Add</AppButton>
        </div>
      </div>
    </div>
  );
}

function FieldWithMode({
  label, mode, value, onChange, onReset, placeholder,
}: {
  label: string;
  mode: "auto" | "manual";
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${mode === "manual" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
          {mode}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
        {mode === "manual" && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Reset to inherited"
            title="Reset to inherited"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </label>
  );
}
