import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId/review")({
  component: ReviewSession,
});

type ProductStatus = "published" | "watchlist" | "archived" | "draft" | "discovered";

function ReviewSession() {
  const { sessionId } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Record<string, ProductStatus>>({});

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["session-review", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,status,internal_code")
        .eq("capture_session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = (id: string, status: ProductStatus) => setAssignments((a) => ({ ...a, [id]: status }));

  const finish = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(assignments);
      for (const [id, status] of updates) {
        const { error } = await supabase.from("products").update({ status }).eq("id", id);
        if (error) throw error;
      }
      const { error: sessErr } = await supabase
        .from("capture_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (sessErr) throw sessErr;
    },
    onSuccess: () => {
      toast.success("Session closed");
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      router.navigate({ to: "/sessions" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setAll = (status: ProductStatus) => {
    const next: Record<string, ProductStatus> = {};
    products.forEach((p) => (next[p.id] = status));
    setAssignments(next);
  };

  return (
    <AppShell title="Review & Close" back={`/sessions/${sessionId}`}>
      <p className="mb-4 text-sm text-muted-foreground">
        Assign an outcome to each product before closing this capture session.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <AppButton size="sm" variant="outline" onClick={() => setAll("published")}>Publish all</AppButton>
        <AppButton size="sm" variant="outline" onClick={() => setAll("watchlist")}>Watchlist all</AppButton>
        <AppButton size="sm" variant="outline" onClick={() => setAll("archived")}>Archive all</AppButton>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="space-y-2">
        {products.map((p) => {
          const chosen = assignments[p.id] ?? (p.status as ProductStatus);
          return (
            <div key={p.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{p.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{p.internal_code} · {p.category}</div>
                </div>
                <StatusPill status={chosen} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {(["published", "watchlist", "archived"] as ProductStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(p.id, s)}
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-medium capitalize transition ${chosen === s ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-muted"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!isLoading && products.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No products captured in this session.
          </div>
        )}
      </div>

      <div className="mt-6">
        <AppButton size="xl" className="w-full" onClick={() => finish.mutate()} disabled={finish.isPending}>
          {finish.isPending ? "Closing…" : "Close session"}
        </AppButton>
      </div>
    </AppShell>
  );
}
