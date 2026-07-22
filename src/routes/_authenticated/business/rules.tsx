import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BusinessShell } from "@/components/BusinessShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/business/rules")({
  component: RulesPage,
});

interface Setting { key: string; value: unknown; description: string | null }

const FIELDS: { key: string; label: string; type: "number" | "text" | "boolean" | "select"; options?: string[] }[] = [
  { key: "commercial.default_markup_pct", label: "Default markup %", type: "number" },
  { key: "commercial.group_buy_fee_pct", label: "Default group buy fee %", type: "number" },
  { key: "commercial.min_profit", label: "Minimum acceptable profit", type: "number" },
  { key: "commercial.min_margin_pct", label: "Minimum acceptable margin %", type: "number" },
  { key: "commercial.max_manual_markup_pct", label: "Maximum manual markup %", type: "number" },
  { key: "commercial.rounding_mode", label: "Price rounding", type: "select", options: ["nearest_1","nearest_5","nearest_10","nearest_50"] },
  { key: "commercial.auto_pricing_enabled", label: "Automatic pricing enabled", type: "boolean" },
  { key: "commercial.default_shipping_method", label: "Default shipping method", type: "select", options: ["sea","air","express"] },
  { key: "commercial.default_currency", label: "Default customer currency", type: "text" },
  { key: "commercial.exchange_rate_stale_days", label: "Warn: exchange rate age (days)", type: "number" },
  { key: "commercial.shipping_rate_stale_days", label: "Warn: shipping rate age (days)", type: "number" },
  { key: "commercial.default_weight_kg", label: "Fallback product weight (kg)", type: "number" },
];

function RulesPage() {
  const qc = useQueryClient();
  const { data: settings = [] } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key,value,description");
      if (error) throw error;
      return (data ?? []) as Setting[];
    },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));
  const [dirty, setDirty] = useState<Record<string, unknown>>({});

  const save = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(dirty);
      for (const [key, value] of entries) {
        const previous = map.get(key);
        const { error } = await supabase.from("app_settings").update({ value: value as never }).eq("key", key);
        if (error) throw error;
        await logAudit({ module: "rules", action: "update", entityType: "app_settings", entityId: key, previous, next: value });
      }
    },
    onSuccess: () => {
      toast.success("Rules saved");
      setDirty({});
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const get = (k: string) => (k in dirty ? dirty[k] : map.get(k));

  return (
    <BusinessShell title="Commercial Rules">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Company-wide defaults. Every module reads these values — never hardcode a business rule.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const v = get(f.key);
          return (
            <label key={f.key} className="block rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{f.label}</div>
              {f.type === "boolean" ? (
                <select
                  value={String(v)}
                  onChange={(e) => setDirty((d) => ({ ...d, [f.key]: e.target.value === "true" }))}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : f.type === "select" ? (
                <select
                  value={String(v ?? "")}
                  onChange={(e) => setDirty((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  step="any"
                  value={String(v ?? "")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = f.type === "number" ? (raw === "" ? null : Number(raw)) : raw;
                    setDirty((d) => ({ ...d, [f.key]: next }));
                  }}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              )}
            </label>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <AppButton onClick={() => save.mutate()} disabled={save.isPending || Object.keys(dirty).length === 0}>
          {save.isPending ? "Saving…" : `Save ${Object.keys(dirty).length || ""} change${Object.keys(dirty).length === 1 ? "" : "s"}`}
        </AppButton>
      </div>
    </BusinessShell>
  );
}
