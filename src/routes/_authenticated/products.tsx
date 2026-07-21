import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { Field, Input, Select } from "@/components/ui/field";
import { useState } from "react";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
});

const STATUSES = ["all", "discovered", "watchlist", "draft", "published", "archived"];

function ProductsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", status],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id,name,category,status,internal_code,created_at,supplier:suppliers(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") query = query.eq("status", status as never);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = products.filter((p) =>
    !q ||
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.internal_code.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell title="Products">
      <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
        <Field label="Search"><Input placeholder="Name or code" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="space-y-2">
        {filtered.map((p) => (
          <Link
            key={p.id}
            to="/products/$productId"
            params={{ productId: p.id }}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-muted"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{p.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {p.internal_code} · {p.category} · {(p.supplier as { name: string } | null)?.name ?? "no supplier"} · {formatRelative(p.created_at)}
              </div>
            </div>
            <StatusPill status={p.status as string} />
          </Link>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No products match.
          </div>
        )}
      </div>
    </AppShell>
  );
}

