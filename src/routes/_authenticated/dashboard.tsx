import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative } from "@/lib/format";
import { PlayCircle, Package, Users, ClipboardCheck, Flame, Sparkles, ArrowRight, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function DashboardPage() {
  const today = startOfTodayISO();

  const { data: stats } = useQuery({
    queryKey: ["curator-dashboard", today],
    queryFn: async () => {
      const [productsToday, activeSessions, pendingReservations, todaysSessions, recentProducts, listingsForGB] =
        await Promise.all([
          supabase.from("products").select("id", { count: "exact", head: true }).gte("created_at", today),
          supabase.from("capture_sessions").select("id,supplier_id", { count: "exact" }).eq("status", "active"),
          supabase.from("group_buy_reservations").select("id", { count: "exact", head: true }).eq("workflow_stage", "curator_review"),
          supabase.from("capture_sessions").select("supplier_id").gte("started_at", today),
          supabase
            .from("products")
            .select("id,name,internal_code,created_at,status")
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("listings")
            .select("id,moq,group_buy_deadline,product:products(id,name,internal_code)")
            .eq("group_buy_enabled", true)
            .eq("publish_status", "published")
            .limit(30),
        ]);

      const uniqSuppliersToday = new Set(
        (todaysSessions.data ?? []).map((s) => s.supplier_id).filter(Boolean),
      ).size;

      // Group buys near completion — resolve progress per listing via RPC.
      const gbListings = listingsForGB.data ?? [];
      const progressPairs = await Promise.all(
        gbListings.map(async (l) => {
          const { data } = await supabase.rpc("get_group_buy_progress", { _listing_id: l.id });
          const reserved = Number(data ?? 0);
          const moq = Number(l.moq ?? 0);
          const pct = moq > 0 ? Math.min(100, (reserved / moq) * 100) : 0;
          return { listing: l, reserved, moq, pct };
        }),
      );
      const nearCompletion = progressPairs
        .filter((p) => p.moq > 0 && p.pct >= 60 && p.pct < 100)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5);

      return {
        productsToday: productsToday.count ?? 0,
        activeSessions: activeSessions.count ?? 0,
        pendingReservations: pendingReservations.count ?? 0,
        suppliersVisitedToday: uniqSuppliersToday,
        recentProducts: recentProducts.data ?? [],
        nearCompletion,
      };
    },
    staleTime: 30_000,
  });

  return (
    <AppShell title="Dashboard">
      <p className="mb-5 text-sm text-muted-foreground">
        Welcome back. Here is what's happening across the Curator Console today.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          to="/products"
          icon={<Package className="h-4 w-4" />}
          label="Products added today"
          value={stats?.productsToday ?? "—"}
        />
        <StatCard
          to="/sessions"
          icon={<PlayCircle className="h-4 w-4" />}
          label="Active capture sessions"
          value={stats?.activeSessions ?? "—"}
        />
        <StatCard
          to="/reservations"
          icon={<ClipboardCheck className="h-4 w-4" />}
          label="Reservations awaiting review"
          value={stats?.pendingReservations ?? "—"}
          accent={Boolean(stats?.pendingReservations)}
        />
        <StatCard
          to="/suppliers"
          icon={<Users className="h-4 w-4" />}
          label="Suppliers visited today"
          value={stats?.suppliersVisitedToday ?? "—"}
        />
        <StatCard
          to="/action-center"
          icon={<Flame className="h-4 w-4" />}
          label="Group buys near completion"
          value={stats?.nearCompletion.length ?? "—"}
        />
        <StatCard
          to="/action-center"
          icon={<ListChecks className="h-4 w-4" />}
          label="Open action items"
          value="Open"
        />
      </div>

      <section className="mt-8">
        <SectionHeader title="Group buys near completion" href="/action-center" />
        {stats?.nearCompletion.length ? (
          <ul className="space-y-2">
            {stats.nearCompletion.map((g) => (
              <li key={g.listing.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {g.listing.product?.internal_code} · {g.listing.product?.name}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {g.reserved} / {g.moq} reserved
                      {g.listing.group_buy_deadline ? ` · closes ${formatRelative(g.listing.group_buy_deadline)}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{g.pct.toFixed(0)}%</div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-foreground" style={{ width: `${g.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyRow text="No group buys close to hitting their MOQ." />
        )}
      </section>

      <section className="mt-8">
        <SectionHeader title="Recently added products" href="/products" />
        {stats?.recentProducts.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {stats.recentProducts.map((p) => (
              <li key={p.id}>
                <Link
                  to="/products/$productId"
                  params={{ productId: p.id }}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {p.internal_code} · {formatRelative(p.created_at)}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyRow text="No products captured yet." />
        )}
      </section>

      <section className="mt-8">
        <SectionHeader title="Recent activity" />
        <ActivityTimeline />
      </section>
    </AppShell>
  );
}

function StatCard({
  to,
  icon,
  label,
  value,
  accent,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`rounded-2xl border p-4 transition hover:border-foreground/40 hover:shadow-sm ${
        accent ? "border-foreground/40 bg-foreground/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
    </Link>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      {href && (
        <Link to={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          View <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function ActivityTimeline() {
  const { data = [] } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("id,module,action,entity_type,entity_id,created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
    staleTime: 30_000,
  });

  if (!data.length) return <EmptyRow text="No recent activity yet." />;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {data.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-foreground/60" />
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium text-foreground">{e.module}</span>
            <span className="text-muted-foreground">{e.action}</span>
            {e.entity_type && <span className="text-muted-foreground">· {e.entity_type}</span>}
            <span className="ml-auto text-muted-foreground">{formatRelative(e.created_at)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
