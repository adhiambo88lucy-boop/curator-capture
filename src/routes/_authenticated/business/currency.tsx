import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BusinessShell } from "@/components/BusinessShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/business/currency")({
  component: CurrencyPage,
});

type Currency = { code: string; name: string; symbol: string; active: boolean };
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

  return (
    <BusinessShell title="Currency Center">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Customers never see exchange rates — only final prices in their selected currency.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {currencies.map((c) => {
          const l = latest.get(c.code);
          const d = draft[c.code] ?? {};
          return (
            <div key={c.code} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{c.symbol} {c.code}</div>
                  <div className="text-xs text-muted-foreground">{c.name}</div>
                </div>
                <button
                  onClick={() => toggleActive.mutate(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                >
                  {c.active ? "Active" : "Inactive"}
                </button>
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
