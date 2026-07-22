import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BusinessShell } from "@/components/BusinessShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business/shipping")({
  component: ShippingPage,
});

type Company = { id: string; name: string; active: boolean; internal_notes: string | null; updated_at: string };
type Rate = { id: string; company_id: string; method: string; rate: number; unit: string; est_days_min: number | null; est_days_max: number | null; active: boolean; internal_notes: string | null; updated_at: string };

function ShippingPage() {
  const qc = useQueryClient();
  const { data: companies = [] } = useQuery({
    queryKey: ["shipping_companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_companies").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });
  const { data: rates = [] } = useQuery({
    queryKey: ["shipping_rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_rates").select("*");
      if (error) throw error;
      return (data ?? []) as Rate[];
    },
  });

  const [newCompany, setNewCompany] = useState("");
  const createCompany = useMutation({
    mutationFn: async () => {
      if (!newCompany.trim()) throw new Error("Enter a name");
      const { data, error } = await supabase.from("shipping_companies").insert({ name: newCompany.trim() }).select().single();
      if (error) throw error;
      await logAudit({ module: "shipping", action: "company_create", entityType: "shipping_company", entityId: data.id, next: data });
    },
    onSuccess: () => { setNewCompany(""); qc.invalidateQueries({ queryKey: ["shipping_companies"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateRate = useMutation({
    mutationFn: async (r: Rate) => {
      const prev = rates.find((x) => x.id === r.id);
      const { error } = await supabase.from("shipping_rates").update({
        rate: r.rate, unit: r.unit, est_days_min: r.est_days_min, est_days_max: r.est_days_max, active: r.active, internal_notes: r.internal_notes,
      }).eq("id", r.id);
      if (error) throw error;
      await logAudit({ module: "shipping", action: "rate_update", entityType: "shipping_rate", entityId: r.id, previous: prev, next: r });
    },
    onSuccess: () => { toast.success("Rate saved"); qc.invalidateQueries({ queryKey: ["shipping_rates"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const addRate = useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase.from("shipping_rates").insert({ company_id: companyId, method: "sea", rate: 0, unit: "kg" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipping_rates"] }),
  });

  return (
    <BusinessShell title="Shipping Center">
      <div className="mb-6 flex items-end gap-2">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Add company</div>
          <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company name" className="mt-1 w-full max-w-sm rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <AppButton onClick={() => createCompany.mutate()}>Add</AppButton>
      </div>

      <div className="space-y-6">
        {companies.map((c) => {
          const companyRates = rates.filter((r) => r.company_id === c.id);
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Updated {new Date(c.updated_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={async () => { await supabase.from("shipping_companies").update({ active: !c.active }).eq("id", c.id); qc.invalidateQueries({ queryKey: ["shipping_companies"] }); }}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                >{c.active ? "Active" : "Inactive"}</button>
              </div>
              <div className="mt-4 space-y-2">
                {companyRates.map((r) => (
                  <RateRow key={r.id} rate={r} onSave={(x) => updateRate.mutate(x)} />
                ))}
                <button onClick={() => addRate.mutate(c.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" /> Add rate
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </BusinessShell>
  );
}

function RateRow({ rate, onSave }: { rate: Rate; onSave: (r: Rate) => void }) {
  const [r, setR] = useState<Rate>(rate);
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-6">
      <select value={r.method} onChange={(e) => setR({ ...r, method: e.target.value })} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
        <option value="sea">Sea</option><option value="air">Air</option><option value="express">Express</option>
      </select>
      <input type="number" step="any" value={r.rate} onChange={(e) => setR({ ...r, rate: Number(e.target.value) })} placeholder="Rate" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
      <input value={r.unit} onChange={(e) => setR({ ...r, unit: e.target.value })} placeholder="Unit" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
      <input type="number" value={r.est_days_min ?? ""} onChange={(e) => setR({ ...r, est_days_min: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Days min" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
      <input type="number" value={r.est_days_max ?? ""} onChange={(e) => setR({ ...r, est_days_max: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Days max" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
      <div className="flex gap-1">
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={r.active} onChange={(e) => setR({ ...r, active: e.target.checked })} />
          Active
        </label>
        <button onClick={() => onSave(r)} className="ml-auto rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background">Save</button>
      </div>
      <input value={r.internal_notes ?? ""} onChange={(e) => setR({ ...r, internal_notes: e.target.value })} placeholder="Internal notes" className="col-span-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
    </div>
  );
}
