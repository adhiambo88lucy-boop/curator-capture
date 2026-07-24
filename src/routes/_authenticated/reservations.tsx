import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reservations")({
  component: ReservationsPage,
});

type Reservation = {
  id: string;
  reservation_number: string;
  listing_id: string;
  buyer_id: string;
  quantity: number;
  status: "pending" | "confirmed" | "cancelled";
  workflow_stage: string;
  reservation_type: string;
  size_selection: string | null;
  colour_id: string | null;
  notes: string | null;
  curator_notes: string | null;
  created_at: string;
  colour: { name: string } | null;
  listings: {
    id: string; code: string; moq: number | null;
    products: { id: string; name: string; internal_code: string } | null;
  } | null;
  buyer_profile: { business_name: string | null; contact_name: string | null; country: string | null } | null;
};

const STAGES = [
  { key: "all", label: "All" },
  { key: "curator_review", label: "Curator review" },
  { key: "needs_changes", label: "Needs changes" },
  { key: "awaiting_supplier", label: "Awaiting supplier" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "confirmed", label: "Confirmed" },
  { key: "rejected", label: "Rejected" },
] as const;

const STAGE_STYLES: Record<string, string> = {
  curator_review: "bg-amber-100 text-amber-700",
  needs_changes: "bg-orange-100 text-orange-700",
  awaiting_supplier: "bg-sky-100 text-sky-700",
  awaiting_payment: "bg-violet-100 text-violet-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-muted text-muted-foreground",
};

export function StageBadge({ stage }: { stage: string }) {
  const label = stage.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STAGE_STYLES[stage] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function ReservationsPage() {
  const [stage, setStage] = useState<(typeof STAGES)[number]["key"]>("curator_review");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["reservations-list", stage],
    queryFn: async () => {
      let q = supabase
        .from("group_buy_reservations")
        .select(
          "id,reservation_number,listing_id,buyer_id,quantity,status,workflow_stage,reservation_type,size_selection,colour_id,notes,curator_notes,created_at," +
            "colour:product_colours(name)," +
            "listings(id,code,moq,products(id,name,internal_code))," +
            "buyer_profile:buyer_profiles(business_name,contact_name,country)"
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (stage !== "all") q = q.eq("workflow_stage", stage);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Reservation[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [
        r.reservation_number,
        r.listings?.products?.name,
        r.listings?.products?.internal_code,
        r.listings?.code,
        r.buyer_profile?.business_name,
        r.buyer_profile?.contact_name,
        r.buyer_profile?.country,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(s))
    );
  }, [rows, search]);

  return (
    <AppShell title="Reservations">
      <p className="mb-4 text-sm text-muted-foreground">
        Operational inbox for every buyer reservation. Approve, request changes or reject at each stage.
      </p>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search R-, product, buyer, country…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STAGES.map((f) => (
          <button
            key={f.key}
            onClick={() => setStage(f.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${stage === f.key ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:bg-muted"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No reservations match this view.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                to="/reservations/$reservationId"
                params={{ reservationId: r.id }}
                className="block rounded-2xl border border-border bg-card p-4 hover:border-foreground/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{r.reservation_number}</span>
                      <StageBadge stage={r.workflow_stage} />
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {r.reservation_type === "full_moq" ? "Full MOQ" : "Group buy"}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-semibold text-foreground">
                      {r.listings?.products?.name ?? "Unknown product"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.listings?.products?.internal_code ?? ""} · {r.listings?.code ?? ""} · Qty {r.quantity}
                      {r.colour?.name ? ` · ${r.colour.name}` : ""}
                      {r.size_selection ? ` · Sizes ${r.size_selection}` : ""}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {r.buyer_profile?.business_name ?? r.buyer_profile?.contact_name ?? `Buyer ${r.buyer_id.slice(0, 8)}`}
                      {r.buyer_profile?.country ? ` · ${r.buyer_profile.country}` : ""}
                      {" · "}{formatRelative(r.created_at)}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
