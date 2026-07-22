import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BusinessShell } from "@/components/BusinessShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/business/audit")({
  component: AuditPage,
});

type Row = { id: string; module: string; action: string; entity_type: string | null; entity_id: string | null; previous: unknown; next: unknown; actor: string | null; created_at: string };

function AuditPage() {
  const { data = [] } = useQuery({
    queryKey: ["audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <BusinessShell title="Audit Log">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">Last 200 commercial changes. Every rate, markup and rule update is recorded here.</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Module</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t border-border/60 align-top">
                <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-2 font-medium">{r.module}</td>
                <td className="px-4 py-2">{r.action}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{r.entity_type ?? ""} {r.entity_id ?? ""}</td>
                <td className="px-4 py-2 text-xs">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-1 text-[10px]">{r.previous ? JSON.stringify(r.previous, null, 0) : "—"}</pre>
                    <pre className="whitespace-pre-wrap break-words rounded bg-foreground/5 p-1 text-[10px]">{r.next ? JSON.stringify(r.next, null, 0) : "—"}</pre>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </BusinessShell>
  );
}
