import { supabase } from "./supabase";

export async function logAction(
  module: string,
  action: string,
  description: string,
  recordId?: string,
  meta?: { role?: string; department?: string }
) {
  const { data: { user } } = await supabase.auth.getUser();
  const performer = user?.user_metadata?.full_name ?? user?.email ?? "system";

  await supabase.from("audit_log").insert({
    module,
    action,
    description,
    performed_by: performer,
    performed_by_role: meta?.role ?? (user?.user_metadata?.role as string | undefined) ?? null,
    performed_by_dept: meta?.department ?? (user?.user_metadata?.department as string | undefined) ?? null,
    record_id: recordId ?? null,
    timestamp: new Date().toISOString(),
  });
}
