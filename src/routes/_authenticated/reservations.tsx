import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useState } from "react";
import { Users, Check, X, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reservations")({
  component: ReservationsPage,
});

type Reservation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  quantity: number;
  status: "pending" | "confirmed" | "cancelled";
  notes: string | null;
  created_at: string;
  listings: {
    id: string; code: string; moq: number | null;
    products: { id: string; name: string; internal_code: string } | null;
  } | null;
};

const FILTERS: { key: Reservation["status"] | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

function ReservationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("pending");

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["reservations", filter],
    queryFn: async () => {
      let q = supabase
        .from("group_buy_reservations")
        .select("id,listing_id,buyer_id,quantity,status,notes,created_at,listings(id,code,moq,products(id,name,internal_code))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Reservation[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ r, status }: { r: Reservation; status: Reservation["status"] }) => {
      const { error } = await supabase.from("group_buy_reservations").update({ status }).eq("id", r.id);
      if (error) throw error;
      await logAudit({
        module: "reservations",
        action: "status_change",
        entityType: "group_buy_reservation",
        entityId: r.id,
        previous: { status: r.status },
        next: { status },
      });
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Group by listing to show group-buy progress vs MOQ
  const groups = new Map<string, { name: string; code: string; moq: number | null; productCode: string; items: Reservation[] }>();
  for (const r of reservations) {
    const key = r.listing_id;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(r);
    } else {
      groups.set(key, {
        name: r.listings?.products?.name ?? "Unknown product",
        code: r.listings?.code ?? "",
        moq: r.listings?.moq ?? null,
        productCode: r.listings?.products?.internal_code ?? "",
        items: [r],
      });
    }
  }

  return (
    <AppShell title="Reservations">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === f.key ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:bg-muted"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No reservations in this view.
        </div>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([listingId, g]) => {
            const totalActive = g.items
              .filter((r) => r.status === "pending" || r.status === "confirmed")
              .reduce((sum, r) => sum + r.quantity, 0);
            const pct = g.moq ? Math.min(100, Math.round((totalActive / g.moq) * 100)) : 0;
            return (
              <div key={listingId} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.productCode} · {g.code}</div>
                    <Link to="/products/$productId" params={{ productId: g.items[0].listings?.products?.id ?? "" }} className="font-semibold hover:underline">
                      {g.name}
                    </Link>
                  </div>
                  {g.moq ? (
                    <div className="text-right text-xs">
                      <div className="font-medium text-foreground">{totalActive} / {g.moq}</div>
                      <div className="text-muted-foreground">{pct}% of MOQ</div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No MOQ set</div>
                  )}
                </div>
                {g.moq && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="mt-3 divide-y divide-border">
                  {g.items.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <StatusBadge status={r.status} />
                          <span className="text-foreground">Qty {r.quantity}</span>
                          <span className="text-muted-foreground">· buyer {r.buyer_id.slice(0, 8)}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                        {r.notes && <div className="mt-1 truncate text-[11px] italic text-muted-foreground">"{r.notes}"</div>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {r.status !== "confirmed" && (
                          <AppButton size="sm" onClick={() => update.mutate({ r, status: "confirmed" })} disabled={update.isPending}>
                            <Check className="mr-1 h-3.5 w-3.5" /> Confirm
                          </AppButton>
                        )}
                        {r.status !== "cancelled" && (
                          <button
                            onClick={() => update.mutate({ r, status: "cancelled" })}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" /> Decline
                          </button>
                        )}
                        {r.status === "confirmed" && (
                          <button
                            onClick={() => update.mutate({ r, status: "fulfilled" })}
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                          >
                            Mark fulfilled
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: Reservation["status"] }) {
  const map: Record<Reservation["status"], { c: string; icon: React.ReactNode; label: string }> = {
    pending: { c: "bg-amber-100 text-amber-700", icon: <Clock className="h-3 w-3" />, label: "Pending" },
    confirmed: { c: "bg-emerald-100 text-emerald-700", icon: <Check className="h-3 w-3" />, label: "Confirmed" },
    cancelled: { c: "bg-muted text-muted-foreground", icon: <X className="h-3 w-3" />, label: "Cancelled" },
    fulfilled: { c: "bg-sky-100 text-sky-700", icon: <Users className="h-3 w-3" />, label: "Fulfilled" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m.c}`}>
      {m.icon} {m.label}
    </span>
  );
}
