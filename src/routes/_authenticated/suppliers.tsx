import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { AppShell as _AS } from "@/components/AppShell";
import { Field, Input } from "@/components/ui/field";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: SuppliersPage,
});

void _AS;

function SuppliersPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: "", contact_person: "", phone: "", wechat: "",
    market: "", building: "", floor: "", booth: "", notes: "",
  });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name,market,building,floor,booth,contact_person,phone,wechat,status,notes")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name required");
      const payload = {
        name: draft.name.trim(),
        contact_person: draft.contact_person || null,
        phone: draft.phone || null,
        wechat: draft.wechat || null,
        market: draft.market || null,
        building: draft.building || null,
        floor: draft.floor || null,
        booth: draft.booth || null,
        notes: draft.notes || null,
      };
      const { error } = await supabase.from("suppliers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setCreating(false);
      setDraft({ name: "", contact_person: "", phone: "", wechat: "", market: "", building: "", floor: "", booth: "", notes: "" });
      toast.success("Supplier added");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Removed");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell title="Suppliers" action={
      !creating ? (
        <AppButton size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New</AppButton>
      ) : null
    }>
      {creating && (
        <div className="mb-4 space-y-3 rounded-2xl border border-border bg-card p-4">
          <Field label="Supplier name" required>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Contact"><Input value={draft.contact_person} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} /></Field>
            <Field label="Phone"><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
            <Field label="WeChat"><Input value={draft.wechat} onChange={(e) => setDraft({ ...draft, wechat: e.target.value })} /></Field>
            <Field label="Market"><Input value={draft.market} onChange={(e) => setDraft({ ...draft, market: e.target.value })} /></Field>
            <Field label="Building"><Input value={draft.building} onChange={(e) => setDraft({ ...draft, building: e.target.value })} /></Field>
            <Field label="Floor"><Input value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} /></Field>
            <Field label="Booth"><Input value={draft.booth} onChange={(e) => setDraft({ ...draft, booth: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
          <div className="flex gap-2">
            <AppButton variant="outline" className="flex-1" onClick={() => setCreating(false)}>Cancel</AppButton>
            <AppButton className="flex-1" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Save"}
            </AppButton>
          </div>
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="space-y-2">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{s.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {[s.market, s.building, s.floor, s.booth].filter(Boolean).join(" · ") || "—"}
                </div>
                {(s.contact_person || s.phone || s.wechat) && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {[s.contact_person, s.phone, s.wechat && `WeChat: ${s.wechat}`].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <button
                onClick={() => { if (confirm(`Delete ${s.name}?`)) del.mutate(s.id); }}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && suppliers.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No suppliers yet.
          </div>
        )}
      </div>
    </AppShell>
  );
}

