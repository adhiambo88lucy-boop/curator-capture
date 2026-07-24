import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { formatRelative } from "@/lib/format";
import { Flame, Users, Clock, CheckCircle2, PauseCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/group-buys")({
  component: GroupBuysPage,
});

type Listing = {
  id: string;
  code: string;
  moq: number | null;
  available_qty: number | null;
  group_buy_enabled: boolean;
  group_buy_deadline: string | null;
  publish_status: string;
  updated_at: string;
  products: { id: string; name: string; internal_code: string } | null;
};

function GroupBuysPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"active" | "closing" | "completed" | "all">("active");

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["group-buys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id,code,moq,available_qty,group_buy_enabled,group_buy_deadline,publish_status,updated_at,products(id,name,internal_code)"
        )
        .eq("group_buy_enabled", true)
        .eq("publish_status", "published")
        .order("group_buy_deadline", { ascending: true, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Listing[];
    },
  });

  const listingIds = listings.map((l) => l.id);
  const { data: reservations = [] } = useQuery({
    queryKey: ["group-buys-reservations", listingIds],
    enabled: listingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_buy_reservations")
        .select("listing_id,quantity,status,workflow_stage,buyer_id")
        .in("listing_id", listingIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byListing = new Map<string, { reserved: number; participants: Set<string>; pending: number }>();
  for (const r of reservations) {
    const bucket = byListing.get(r.listing_id) ?? { reserved: 0, participants: new Set<string>(), pending: 0 };
    if (r.status !== "cancelled" && r.workflow_stage !== "rejected") {
      bucket.reserved += r.quantity;
      bucket.participants.add(r.buyer_id);
      if (r.workflow_stage === "curator_review") bucket.pending += 1;
    }
    byListing.set(r.listing_id, bucket);
  }

  const now = Date.now();
  const enriched = listings.map((l) => {
    const s = byListing.get(l.id) ?? { reserved: 0, participants: new Set<string>(), pending: 0 };
    const moq = l.moq ?? 0;
    const pct = moq > 0 ? Math.min(100, (s.reserved / moq) * 100) : 0;
    const deadlineMs = l.group_buy_deadline ? new Date(l.group_buy_deadline).getTime() : null;
    const hoursLeft = deadlineMs ? (deadlineMs - now) / 3_600_000 : null;
    const remaining = Math.max(0, moq - s.reserved);
    const status =
      pct >= 100 ? "completed" : hoursLeft !== null && hoursLeft <= 0 ? "expired" : hoursLeft !== null && hoursLeft <= 48 ? "closing" : "active";
    return { listing: l, reserved: s.reserved, participants: s.participants.size, pending: s.pending, moq, pct, hoursLeft, remaining, status };
  });

  const filtered = enriched.filter((e) => {
    if (filter === "all") return true;
    if (filter === "active") return e.status === "active" || e.status === "closing";
    if (filter === "closing") return e.status === "closing" || e.status === "expired";
    if (filter === "completed") return e.status === "completed";
    return true;
  });

  const pauseGB = useMutation({
    mutationFn: async (l: Listing) => {
      const { error } = await supabase.from("listings").update({ group_buy_enabled: false }).eq("id", l.id);
      if (error) throw error;
      await logAudit({
        module: "group_buy",
        action: "disable",
        entityType: "listing",
        entityId: l.id,
        previous: { group_buy_enabled: true },
        next: { group_buy_enabled: false },
      });
    },
    onSuccess: () => {
      toast.success("Group buy paused");
      qc.invalidateQueries({ queryKey: ["group-buys"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell title="Group Buy Coordination">
      <p className="mb-4 text-sm text-muted-foreground">
        Monitor every group buy: participants, progress against MOQ and deadlines. Buyer reservations flow into this view automatically.
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["active", "closing", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize ${filter === f ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:bg-muted"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No group buys in this view.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => (
            <div key={g.listing.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {g.listing.products?.internal_code} · {g.listing.code}
                  </div>
                  <Link
                    to="/products/$productId"
                    params={{ productId: g.listing.products?.id ?? "" }}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {g.listing.products?.name ?? "Product"}
                  </Link>
                </div>
                <StatusPill status={g.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Metric label="MOQ" value={g.moq || "—"} />
                <Metric label="Reserved" value={g.reserved} />
                <Metric label="Remaining" value={g.remaining} />
                <Metric label="Participants" value={g.participants} icon={<Users className="h-3 w-3" />} />
                <Metric
                  label="Deadline"
                  value={g.listing.group_buy_deadline ? formatRelative(g.listing.group_buy_deadline) : "—"}
                  icon={<Clock className="h-3 w-3" />}
                />
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${g.pct >= 100 ? "bg-emerald-500" : g.status === "closing" ? "bg-amber-500" : "bg-foreground"}`}
                  style={{ width: `${g.pct}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{g.pct.toFixed(0)}% of MOQ</span>
                {g.pending > 0 && (
                  <Link to="/reservations" className="font-medium text-foreground hover:underline">
                    {g.pending} pending review →
                  </Link>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/products/$productId"
                  params={{ productId: g.listing.products?.id ?? "" }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Open product
                </Link>
                <button
                  onClick={() => pauseGB.mutate(g.listing)}
                  disabled={pauseGB.isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <PauseCircle className="h-3.5 w-3.5" /> Pause group buy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; icon: React.ReactNode; label: string }> = {
    active: { c: "bg-sky-100 text-sky-700", icon: <Users className="h-3 w-3" />, label: "Active" },
    closing: { c: "bg-amber-100 text-amber-700", icon: <Flame className="h-3 w-3" />, label: "Closing soon" },
    completed: { c: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="h-3 w-3" />, label: "MOQ reached" },
    expired: { c: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" />, label: "Expired" },
  };
  const m = map[status] ?? map.active;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m.c}`}>
      {m.icon} {m.label}
    </span>
  );
}
