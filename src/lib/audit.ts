import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  module: string;
  action: string;
  entityType?: string;
  entityId?: string;
  previous?: unknown;
  next?: unknown;
}

/** Record a commercial change. Fails silently (logs to console) to avoid blocking the user flow. */
export async function logAudit(e: AuditEntry): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user?.id;
  if (!actor) return;
  const { error } = await supabase.from("audit_log").insert({
    module: e.module,
    action: e.action,
    entity_type: e.entityType ?? null,
    entity_id: e.entityId ?? null,
    previous: (e.previous as never) ?? null,
    next: (e.next as never) ?? null,
    actor,
  });
  if (error) console.warn("[audit] failed to record", error.message);
}
