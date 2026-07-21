import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppButton } from "@/components/AppButton";
import { StatusPill } from "@/components/StatusPill";
import { formatRelative, formatTime } from "@/lib/format";
import { SupplierPicker } from "@/components/SupplierPicker";
import { useState } from "react";
import { toast } from "sonner";
import { PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sessions")({
  component: SessionsPage,
});

type Session = {
  id: string;
  status: "active" | "ended";
  started_at: string;
  ended_at: string | null;
  supplier: { id: string; name: string; market: string | null } | null;
  product_count: { count: number }[];
};

function SessionsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [pickedSupplier, setPickedSupplier] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capture_sessions")
        .select("id,status,started_at,ended_at,supplier:suppliers(id,name,market),product_count:products(count)")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Session[];
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!pickedSupplier) throw new Error("Pick a supplier first");
      const { data, error } = await supabase
        .from("capture_sessions")
        .insert({ supplier_id: pickedSupplier, status: "active" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setStarting(false);
      setPickedSupplier(null);
      navigate({ to: "/sessions/$sessionId", params: { sessionId: id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell title="Capture Sessions">
      {!starting ? (
        <AppButton size="xl" className="mb-6 w-full" onClick={() => setStarting(true)}>
          <PlayCircle className="h-5 w-5" /> Start New Capture Session
        </AppButton>
      ) : (
        <div className="mb-6 space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-medium">Select supplier</div>
          <SupplierPicker value={pickedSupplier} onChange={(id) => setPickedSupplier(id || null)} />
          <div className="flex gap-2">
            <AppButton variant="outline" className="flex-1" onClick={() => setStarting(false)}>
              Cancel
            </AppButton>
            <AppButton
              className="flex-1"
              disabled={!pickedSupplier || start.isPending}
              onClick={() => start.mutate()}
            >
              {start.isPending ? "Starting…" : "Start session"}
            </AppButton>
          </div>
        </div>
      )}

      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Recent sessions
      </h2>
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="space-y-2">
        {sessions.map((s) => (
          <Link
            key={s.id}
            to="/sessions/$sessionId"
            params={{ sessionId: s.id }}
            className="block rounded-xl border border-border bg-card p-4 hover:bg-muted"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">
                  {s.supplier?.name ?? "No supplier"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Started {formatTime(s.started_at)} · {formatRelative(s.started_at)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-lg font-semibold text-foreground">
                    {s.product_count?.[0]?.count ?? 0}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    products
                  </div>
                </div>
                <StatusPill status={s.status} />
              </div>
            </div>
          </Link>
        ))}
        {!isLoading && sessions.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No sessions yet. Start one to begin capturing products.
          </div>
        )}
      </div>
    </AppShell>
  );
}
