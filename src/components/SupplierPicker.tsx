import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppButton } from "@/components/AppButton";
import { Field, Input } from "@/components/ui/field";
import { toast } from "sonner";

export type SupplierRow = {
  id: string;
  name: string;
  market: string | null;
  building: string | null;
  floor: string | null;
  booth: string | null;
};

interface Props {
  value: string | null;
  onChange: (id: string, supplier: SupplierRow) => void;
}

export function SupplierPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name,market,building,floor,booth")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as SupplierRow[];
    },
  });

  const selected = suppliers.find((s) => s.id === value);
  const filtered = suppliers.filter((s) =>
    (s.name + " " + (s.market ?? "") + " " + (s.building ?? ""))
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const [draft, setDraft] = useState({ name: "", market: "", building: "", floor: "", booth: "" });
  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Supplier name is required");
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: draft.name.trim(),
          market: draft.market || null,
          building: draft.building || null,
          floor: draft.floor || null,
          booth: draft.booth || null,
        })
        .select("id,name,market,building,floor,booth")
        .single();
      if (error) throw error;
      return data as SupplierRow;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      onChange(s.id, s);
      setCreating(false);
      setDraft({ name: "", market: "", building: "", floor: "", booth: "" });
      toast.success("Supplier created");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    if (value && !selected && suppliers.length) {
      const s = suppliers.find((x) => x.id === value);
      if (s) onChange(s.id, s);
    }
  }, [value, selected, suppliers, onChange]);

  if (selected) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-foreground">{selected.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground truncate">
              {[selected.market, selected.building, selected.floor, selected.booth]
                .filter(Boolean)
                .join(" · ") || "No location set"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange("", { id: "", name: "", market: null, building: null, floor: null, booth: null })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <Field label="Supplier name" required>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Market"><Input value={draft.market} onChange={(e) => setDraft({ ...draft, market: e.target.value })} /></Field>
          <Field label="Building"><Input value={draft.building} onChange={(e) => setDraft({ ...draft, building: e.target.value })} /></Field>
          <Field label="Floor"><Input value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} /></Field>
          <Field label="Booth"><Input value={draft.booth} onChange={(e) => setDraft({ ...draft, booth: e.target.value })} /></Field>
        </div>
        <div className="flex gap-2">
          <AppButton type="button" variant="outline" onClick={() => setCreating(false)} className="flex-1">Cancel</AppButton>
          <AppButton type="button" onClick={() => create.mutate()} disabled={create.isPending} className="flex-1">
            {create.isPending ? "Saving…" : "Save supplier"}
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search suppliers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-1">
        {filtered.length === 0 && (
          <div className="p-3 text-center text-xs text-muted-foreground">No matches</div>
        )}
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id, s)}
            className="block w-full rounded-md p-2.5 text-left hover:bg-muted"
          >
            <div className="text-sm font-medium text-foreground">{s.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {[s.market, s.building, s.floor, s.booth].filter(Boolean).join(" · ") || "—"}
            </div>
          </button>
        ))}
      </div>
      <AppButton type="button" variant="outline" onClick={() => setCreating(true)} className="w-full">
        <Plus className="h-4 w-4" /> New supplier
      </AppButton>
    </div>
  );
}
