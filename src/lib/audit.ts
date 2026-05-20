import { supabase } from "./supabase";

export async function logAction(module: string, action: string, description: string, recordId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const performer = user?.user_metadata?.full_name ?? user?.email ?? "system";

  await supabase.from("audit_log").insert({
    module,
    action,
    description,
    performed_by: performer,
    record_id: recordId ?? null,
  });
}
