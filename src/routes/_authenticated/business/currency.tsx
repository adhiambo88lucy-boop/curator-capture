import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BusinessShell } from "@/components/BusinessShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { Star, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business/currency")({
  component: CurrencyPage,
});

type Currency = { code: string; name: string; symbol: string; active: boolean; is_default: boolean };
type Rate = { id: string; currency_code: string; rate_to_rmb: number; margin_pct: number; effective_at: string; notes: string | null };

function CurrencyPage() {
  const qc = useQueryClient();
  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("*").order("code");
      if (error) throw error;
      return (data ?? []) as Currency[];
    },
  });
  const { data: rates = [] } = useQuery({
    queryKey: ["exchange_rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exchange_rates").select("*").order("effective_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Rate[];
    },
  });

  const latest = new Map<string, Rate>();
  for (const r of rates) if (!latest.has(r.currency_code)) latest.set(r.currency_code, r);

  const [draft, setDraft] = useState<Record<string, { rate?: string; margin?: string; notes?: string }>>({});
  const [newC, setNewC] = useState({ code: "", name: "", symbol: "" });
  const [edit, setEdit] = useState<Record<string, { name?: string; symbol?: string }>>({});

  const submitRate = useMutation({
    mutationFn: async (code: string) => {
      const d = draft[code] ?? {};
      const rate_to_rmb = Number(d.rate);
      const margin_pct = Number(d.margin ?? 0);
      if (!Number.isFinite(rate_to_rmb) || rate_to_rmb <= 0) throw new Error("Enter a positive rate");
      const { data: userData } = await supabase.auth.getUser();
      const prev = latest.get(code);
      const { error } = await supabase.from("exchange_rates").insert({
        currency_code: code, rate_to_rmb, margin_pct,
        notes: d.notes ?? null, created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
      await logAudit({ module: "currency", action: "rate_update", entityType: "currency", entityId: code, previous: prev, next: { rate_to_rmb, margin_pct } });
    },
    onSuccess: (_data, code) => {
      toast.success(`Rate updated for ${code}`);
      setDraft((d) => ({ ...d, [code]: {} }));
      qc.invalidateQueries({ queryKey: ["exchange_rates"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Currency) => {
      const { error } = await supabase.from("currencies").update({ active: !c.active }).eq("code", c.code);
      if (error) throw error;
      await logAudit({ module: "currency", action: "toggle_active", entityType: "currency", entityId: c.code, previous: { active: c.active }, next: { active: !c.active } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currencies"] }),
  });

  const createCurrency = useMutation({
    mutationFn: async () => {
      const code = newC.code.trim().toUpperCase();
      const name = newC.name.trim();
      const symbol = newC.symbol.trim();
      if (!code || !name || !symbol) throw new Error("Code, name and symbol required");
      const { error } = await supabase.from("currencies").insert({ code, name, symbol, active: true });
      if (error) throw error;
      await logAudit({ module: "currency", action: "currency_create", entityType: "currency", entityId: code, next: { code, name, symbol } });
    },
    onSuccess: () => {
      toast.success("Currency added");
      setNewC({ code: "", name: "", symbol: "" });
      qc.invalidateQueries({ queryKey: ["currencies"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateCurrency = useMutation({
    mutationFn: async (c: Currency) => {
      const e = edit[c.code] ?? {};
      const patch = { name: e.name ?? c.name, symbol: e.symbol ?? c.symbol };
      const { error } = await supabase.from("currencies").update(patch).eq("code", c.code);
      if (error) throw error;
      await logAudit({ module: "currency", action: "currency_update", entityType: "currency", entityId: c.code, previous: { name: c.name, symbol: c.symbol }, next: patch });
    },
    onSuccess: (_d, c) => {
      toast.success(`${c.code} updated`);
      setEdit((s) => ({ ...s, [c.code]: {} }));
      qc.invalidateQueries({ queryKey: ["currencies"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteCurrency = useMutation({
    mutationFn: async (c: Currency) => {
      if (c.is_default) throw new Error("Set another currency as default first");
      if (!confirm(`Delete currency ${c.code}? This cannot be undone.`)) throw new Error("Cancelled");
      const { error } = await supabase.from("currencies").delete().eq("code", c.code);
      if (error) throw error;
      await logAudit({ module: "currency", action: "currency_delete", entityType: "currency", entityId: c.code, previous: c });
    },
    onSuccess: () => {
      toast.success("Currency deleted");
      qc.invalidateQueries({ queryKey: ["currencies"] });
    },
    onError: (e) => {
      if ((e as Error).message !== "Cancelled") toast.error((e as Error).message);
    },
  });

  const setDefault = useMutation({
    mutationFn: async (c: Currency) => {
      // Clear all, set one, and mirror to app_settings for pricing engine.
      const { error: clr } = await supabase.from("currencies").update({ is_default: false }).neq("code", "___");
      if (clr) throw clr;
      const { error: set } = await supabase.from("currencies").update({ is_default: true, active: true }).eq("code", c.code);
      if (set) throw set;
      const { error: as } = await supabase
        .from("app_settings")
        .upsert({ key: "commercial.default_currency", value: c.code as unknown as never }, { onConflict: "key" });
      if (as) throw as;
      await logAudit({ module: "currency", action: "set_default", entityType: "currency", entityId: c.code, next: { is_default: true } });
    },
    onSuccess: (_d, c) => {
      toast.success(`${c.code} is now the default`);
      qc.invalidateQueries({ queryKey: ["currencies"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <BusinessShell title="Currency Center">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Customers never see exchange rates — only final prices in the default currency. Manage currencies, rates and platform margin here without touching code.
      </p>

      <div className="mb-6 rounded-2xl border border-dashed border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Add currency
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input placeholder="Code (USD)" value={newC.code} onChange={(e) => setNewC({ ...newC, code: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" maxLength={6} />
          <input placeholder="Name (US Dollar)" value={newC.name} onChange={(e) => setNewC({ ...newC, name: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="Symbol ($)" value={newC.symbol} onChange={(e) => setNewC({ ...newC, symbol: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" maxLength={4} />
        </div>
        <AppButton size="sm" onClick={() => createCurrency.mutate()} disabled={createCurrency.isPending} className="mt-3">Add currency</AppButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {currencies.map((c) => {
          const l = latest.get(c.code);
          const d = draft[c.code] ?? {};
          const e = edit[c.code] ?? {};
          const dirty = (e.name !== undefined && e.name !== c.name) || (e.symbol !== undefined && e.symbol !== c.symbol);
          return (
            <div key={c.code} className={`rounded-2xl border p-5 ${c.is_default ? "border-foreground/40 bg-foreground/5" : "border-border bg-card"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{c.symbol} {c.code}</div>
                    {c.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                        <Star className="h-2.5 w-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <input value={e.name ?? c.name} onChange={(x) => setEdit((s) => ({ ...s, [c.code]: { ...s[c.code], name: x.target.value } }))} className="rounded-md border border-input bg-background px-2 py-1 text-xs" />
                    <input value={e.symbol ?? c.symbol} onChange={(x) => setEdit((s) => ({ ...s, [c.code]: { ...s[c.code], symbol: x.target.value } }))} className="rounded-md border border-input bg-background px-2 py-1 text-xs" maxLength={4} />
                  </div>
                  {dirty && (
                    <button onClick={() => updateCurrency.mutate(c)} className="mt-1 text-[11px] font-medium text-foreground underline">Save changes</button>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => toggleActive.mutate(c)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {c.active ? "Active" : "Inactive"}
                  </button>
                  {!c.is_default && (
                    <button
                      onClick={() => setDefault.mutate(c)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Set as default
                    </button>
                  )}
                  {!c.is_default && (
                    <button
                      onClick={() => deleteCurrency.mutate(c)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs">
                <div>Latest rate: <span className="font-medium text-foreground">{l ? `${l.rate_to_rmb} ${c.code} = 1 RMB · +${l.margin_pct}% margin` : "—"}</span></div>
                {l && <div className="text-muted-foreground">Effective {new Date(l.effective_at).toLocaleString()}</div>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input placeholder="New rate → RMB" value={d.rate ?? ""} onChange={(e) => setDraft((s) => ({ ...s, [c.code]: { ...s[c.code], rate: e.target.value } }))} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <input placeholder="Margin %" value={d.margin ?? ""} onChange={(e) => setDraft((s) => ({ ...s, [c.code]: { ...s[c.code], margin: e.target.value } }))} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <input placeholder="Notes" value={d.notes ?? ""} onChange={(e) => setDraft((s) => ({ ...s, [c.code]: { ...s[c.code], notes: e.target.value } }))} className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <AppButton onClick={() => submitRate.mutate(c.code)} className="mt-3 w-full" disabled={submitRate.isPending}>Record new rate</AppButton>

              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted-foreground">History</summary>
                <div className="mt-2 space-y-1 text-xs">
                  {rates.filter((r) => r.currency_code === c.code).slice(0, 10).map((r) => (
                    <div key={r.id} className="flex justify-between border-b border-border/50 py-1">
                      <span>{r.rate_to_rmb} · +{r.margin_pct}%</span>
                      <span className="text-muted-foreground">{new Date(r.effective_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </BusinessShell>
  );
}
