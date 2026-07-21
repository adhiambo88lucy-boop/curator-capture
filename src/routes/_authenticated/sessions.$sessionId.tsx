import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { StatusPill } from "@/components/StatusPill";
import { formatRelative, formatTime } from "@/lib/format";
import { Plus, StopCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId")({
  component: SessionDetail,
});

function SessionDetail() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capture_sessions")
        .select("id,status,started_at,ended_at,notes,supplier:suppliers(id,name,market,building,floor,booth,contact_person,phone,wechat)")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["session-products", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,status,internal_code,created_at")
        .eq("capture_session_id", sessionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });


  if (isLoading) return <AppShell title="Session"><div className="text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!session) return <AppShell title="Session" back="/sessions"><div>Session not found.</div></AppShell>;

  const supplier = session.supplier as { name: string; market: string | null; building: string | null; floor: string | null; booth: string | null; contact_person: string | null; phone: string | null; wechat: string | null } | null;
  const active = session.status === "active";

  return (
    <AppShell title={supplier?.name ?? "Session"} back="/sessions">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Supplier</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{supplier?.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {[supplier?.market, supplier?.building, supplier?.floor, supplier?.booth].filter(Boolean).join(" · ") || "No location"}
            </div>
            {(supplier?.contact_person || supplier?.phone || supplier?.wechat) && (
              <div className="mt-2 text-xs text-muted-foreground">
                {supplier?.contact_person && <span>{supplier.contact_person}</span>}
                {supplier?.phone && <span> · {supplier.phone}</span>}
                {supplier?.wechat && <span> · WeChat: {supplier.wechat}</span>}
              </div>
            )}
          </div>
          <StatusPill status={session.status} />
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-lg bg-muted/50 py-3 text-center">
          <div>
            <div className="text-xl font-semibold">{products.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Products</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{formatTime(session.started_at)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Started</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{session.ended_at ? formatTime(session.ended_at) : "—"}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ended</div>
          </div>
        </div>
      </div>

      {active && (
        <div className="mt-4 flex gap-2">
          <AppButton
            size="xl"
            className="flex-1"
            onClick={() => navigate({ to: "/sessions/$sessionId/new-product", params: { sessionId } })}
          >
            <Plus className="h-5 w-5" /> Add Product
          </AppButton>
          <AppButton
            size="xl"
            variant="outline"
            onClick={() => navigate({ to: "/sessions/$sessionId/review", params: { sessionId } })}
          >
            <StopCircle className="h-5 w-5" />
          </AppButton>
        </div>
      )}

      <h2 className="mt-6 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Products captured ({products.length})
      </h2>
      <div className="space-y-2">
        {products.map((p) => (
          <Link
            key={p.id}
            to="/products/$productId"
            params={{ productId: p.id }}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-muted"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{p.name}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {p.internal_code} · {p.category} · {formatRelative(p.created_at)}
              </div>
            </div>
            <StatusPill status={p.status as string} />
          </Link>
        ))}
        {products.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No products yet — tap "Add Product" to start.
          </div>
        )}
      </div>
    </AppShell>
  );
}
