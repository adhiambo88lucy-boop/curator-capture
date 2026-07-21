import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId/new-product")({
  component: NewProduct,
});

function emptyForm() {
  return { name: "", category_id: "", subcategory_id: "", description: "", material: "", tags: "", internal_notes: "" };
}

function NewProduct() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm());

  const { data: session } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("capture_sessions").select("id,supplier:suppliers(id,name)").eq("id", sessionId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cats-with-subs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,sort_order,subcategories(id,name,sort_order)").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const supplier = session?.supplier as { id: string; name: string } | null;
  const activeCat = categories.find((c) => c.id === form.category_id);
  const subs = useMemo(() => ((activeCat?.subcategories ?? []) as Array<{ id: string; name: string; sort_order: number }>).sort((a, b) => a.sort_order - b.sort_order), [activeCat]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Product name required");
      if (!form.category_id) throw new Error("Category required");
      if (!supplier) throw new Error("Session has no supplier");
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const categoryName = activeCat?.name ?? "Other";
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: form.name.trim(),
          category: categoryName,
          category_id: form.category_id,
          subcategory_id: form.subcategory_id || null,
          description: form.description || null,
          material: form.material || null,
          internal_notes: form.internal_notes || null,
          tags,
          capture_session_id: sessionId,
          supplier_id: supplier.id,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
  });

  const saveAndContinue = async (mode: "another" | "detail" | "done") => {
    try {
      const id = await create.mutateAsync();
      toast.success("Product saved");
      if (mode === "another") setForm(emptyForm());
      else if (mode === "detail") navigate({ to: "/products/$productId", params: { productId: id } });
      else navigate({ to: "/sessions/$sessionId", params: { sessionId } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="New Product" back={`/sessions/${sessionId}`}>
      <div className="mb-4 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Supplier: <span className="font-medium text-foreground">{supplier?.name ?? "—"}</span>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); saveAndContinue("detail"); }} className="space-y-4">
        <Field label="Product name" required>
          <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summer Dress" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category" required>
            <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value, subcategory_id: "" })}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Subcategory">
            <Select value={form.subcategory_id} onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })} disabled={!form.category_id}>
              <option value="">—</option>
              {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Material" hint="Optional">
          <Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Cotton, polyester…" />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Buyer-facing description…" />
        </Field>
        <Field label="Internal notes" hint="Admin only — not shown to buyers">
          <Textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} placeholder="Supplier haggling notes, quality flags…" />
        </Field>
        <Field label="Tags" hint="Comma separated">
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="summer, floral, bestseller" />
        </Field>

        <div className="space-y-2 pt-2">
          <AppButton type="button" size="xl" className="w-full" disabled={create.isPending} onClick={() => saveAndContinue("detail")}>
            <Camera className="h-5 w-5" /> Save & Add Photos
          </AppButton>
          <div className="grid grid-cols-2 gap-2">
            <AppButton type="button" variant="outline" size="lg" disabled={create.isPending} onClick={() => saveAndContinue("another")}>
              Save & Add Another
            </AppButton>
            <AppButton type="button" variant="ghost" size="lg" disabled={create.isPending} onClick={() => saveAndContinue("done")}>
              Save & Done
            </AppButton>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
