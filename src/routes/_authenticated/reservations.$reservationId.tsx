import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { formatRelative } from "@/lib/format";
import { StageBadge } from "@/routes/_authenticated/reservations";
import { ArrowLeft, CheckCircle2, XCircle, MessageSquareWarning, Truck, CreditCard, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reservations/$reservationId")({
  component: ReservationDetail,
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
  updated_at: string;
  colour: { name: string } | null;
  listings: {
    id: string; code: string; moq: number | null; available_qty: number | null;
    group_buy_deadline: string | null;
    products: { id: string; name: string; internal_code: string; description: string | null; material: string | null } | null;
  } | null;
  buyer_profile: {
    business_name: string | null;
    contact_name: string | null;
    country: string | null;
    city: string | null;
    phone: string | null;
  } | null;
};

// Workflow transitions: stage -> allowed next stages
const NEXT: Record<string, { key: string; label: string; icon: React.ReactNode }[]> = {
  curator_review: [
    { key: "awaiting_supplier", label: "Approve → Supplier", icon: <Truck className="h-3.5 w-3.5" /> },
    { key: "needs_changes", label: "Request changes", icon: <MessageSquareWarning className="h-3.5 w-3.5" /> },
    { key: "rejected", label: "Reject", icon: <XCircle className="h-3.5 w-3.5" /> },
  ],
  needs_changes: [
    { key: "curator_review", label: "Back to review", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { key: "rejected", label: "Reject", icon: <XCircle className="h-3.5 w-3.5" /> },
  ],
  awaiting_supplier: [
    { key: "awaiting_payment", label: "Supplier confirmed → Payment", icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: "needs_changes", label: "Request changes", icon: <MessageSquareWarning className="h-3.5 w-3.5" /> },
    { key: "rejected", label: "Reject", icon: <XCircle className="h-3.5 w-3.5" /> },
  ],
  awaiting_payment: [
    { key: "confirmed", label: "Mark confirmed", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { key: "rejected", label: "Reject", icon: <XCircle className="h-3.5 w-3.5" /> },
  ],
  confirmed: [],
  rejected: [{ key: "curator_review", label: "Re-open", icon: <ShieldCheck className="h-3.5 w-3.5" /> }],
};

function ReservationDetail() {
  const { reservationId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: r, isLoading } = useQuery({
    queryKey: ["reservation", reservationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_buy_reservations")
        .select(
          "id,reservation_number,listing_id,buyer_id,quantity,status,workflow_stage,reservation_type,size_selection,colour_id,notes,curator_notes,created_at,updated_at," +
            "colour:product_colours(name)," +
            "listings(id,code,moq,available_qty,group_buy_deadline,products(id,name,internal_code,description,material))," +
            "buyer_profile:buyer_profiles(business_name,contact_name,country,city,phone)"
        )
        .eq("id", reservationId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Reservation | null;
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["reservation-timeline", reservationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("id,action,previous,next,created_at")
        .eq("entity_type", "group_buy_reservation")
        .eq("entity_id", reservationId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const [curatorNotes, setCuratorNotes] = useState<string>("");
  const [savedNotes, setSavedNotes] = useState<string | null>(null);

  // Load curator notes into state on first fetch
  if (r && savedNotes === null) {
    setSavedNotes(r.curator_notes ?? "");
    setCuratorNotes(r.curator_notes ?? "");
  }

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!r) return;
      const { error } = await supabase
        .from("group_buy_reservations")
        .update({ curator_notes: curatorNotes || null })
        .eq("id", r.id);
      if (error) throw error;
      await logAudit({
        module: "reservations",
        action: "notes_update",
        entityType: "group_buy_reservation",
        entityId: r.id,
        previous: { curator_notes: r.curator_notes },
        next: { curator_notes: curatorNotes },
      });
    },
    onSuccess: () => {
      toast.success("Notes saved");
      setSavedNotes(curatorNotes);
      qc.invalidateQueries({ queryKey: ["reservation-timeline", reservationId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const transition = useMutation({
    mutationFn: async (nextStage: string) => {
      if (!r) return;
      // High-level status mirrors the workflow for backward compatibility
      const status =
        nextStage === "confirmed" ? "confirmed" : nextStage === "rejected" ? "cancelled" : "pending";
      const { error } = await supabase
        .from("group_buy_reservations")
        .update({ workflow_stage: nextStage, status })
        .eq("id", r.id);
      if (error) throw error;
      await logAudit({
        module: "reservations",
        action: `stage:${r.workflow_stage}→${nextStage}`,
        entityType: "group_buy_reservation",
        entityId: r.id,
        previous: { workflow_stage: r.workflow_stage, status: r.status },
        next: { workflow_stage: nextStage, status },
      });
    },
    onSuccess: () => {
      toast.success("Stage updated");
      qc.invalidateQueries({ queryKey: ["reservation", reservationId] });
      qc.invalidateQueries({ queryKey: ["reservations-list"] });
      qc.invalidateQueries({ queryKey: ["reservation-timeline", reservationId] });
      qc.invalidateQueries({ queryKey: ["curator-dashboard"] });
      qc.invalidateQueries({ queryKey: ["action-center"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !r) {
    return (
      <AppShell title="Reservation">
        <div className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "Reservation not found."}</div>
      </AppShell>
    );
  }

  const p = r.listings?.products;
  const actions = NEXT[r.workflow_stage] ?? [];

  return (
    <AppShell title={r.reservation_number}>
      <button
        onClick={() => navigate({ to: "/reservations" })}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to reservations
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={r.workflow_stage} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {r.reservation_type === "full_moq" ? "Full MOQ" : "Group buy"}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">Placed {formatRelative(r.created_at)}</span>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Section title="Product">
            {p ? (
              <Link
                to="/products/$productId"
                params={{ productId: p.id }}
                className="text-sm font-semibold text-foreground hover:underline"
              >
                {p.name}
              </Link>
            ) : (
              <div className="text-sm text-muted-foreground">Unknown product</div>
            )}
            <Info label="Product code" value={p?.internal_code} />
            <Info label="Listing code" value={r.listings?.code} />
            <Info label="Quantity" value={String(r.quantity)} />
            <Info label="Colour" value={r.colour?.name ?? "—"} />
            <Info label="Sizes" value={r.size_selection ?? "—"} />
            <Info label="Listing MOQ" value={r.listings?.moq?.toString() ?? "—"} />
          </Section>
          <Section title="Buyer">
            <Info label="Business" value={r.buyer_profile?.business_name ?? "—"} />
            <Info label="Contact" value={r.buyer_profile?.contact_name ?? "—"} />
            <Info label="Country" value={r.buyer_profile?.country ?? "—"} />
            <Info label="City" value={r.buyer_profile?.city ?? "—"} />
            <Info label="Phone" value={r.buyer_profile?.phone ?? "—"} />
            <Info label="Buyer id" value={r.buyer_id.slice(0, 12) + "…"} />
          </Section>
        </div>

        {r.notes && (
          <div className="mt-4 rounded-xl bg-muted/40 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Buyer note</div>
            <div className="mt-1 text-sm italic text-foreground">"{r.notes}"</div>
          </div>
        )}
      </div>

      {actions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next steps</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((a) => (
              <AppButton
                key={a.key}
                size="sm"
                variant={a.key === "rejected" ? "outline" : "primary"}
                onClick={() => transition.mutate(a.key)}
                disabled={transition.isPending}
              >
                <span className="inline-flex items-center gap-1.5">{a.icon} {a.label}</span>
              </AppButton>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal notes</div>
        <textarea
          value={curatorNotes}
          onChange={(e) => setCuratorNotes(e.target.value)}
          rows={3}
          placeholder="Notes visible only to the curator team…"
          className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex justify-end">
          <AppButton
            size="sm"
            onClick={() => saveNotes.mutate()}
            disabled={saveNotes.isPending || curatorNotes === (savedNotes ?? "")}
          >
            Save notes
          </AppButton>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</div>
        {timeline.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">No changes yet. New actions will appear here.</div>
        ) : (
          <ol className="mt-3 relative space-y-3 border-l border-border pl-4">
            <li className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-foreground/60" />
              <div className="text-xs">
                <span className="font-medium text-foreground">Reservation placed</span>
                <span className="ml-2 text-muted-foreground">{formatRelative(r.created_at)}</span>
              </div>
            </li>
            {timeline.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-foreground/60" />
                <div className="text-xs">
                  <span className="font-medium text-foreground">{e.action}</span>
                  <span className="ml-2 text-muted-foreground">{formatRelative(e.created_at)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}
