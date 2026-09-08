import { supabase } from "./supabase";
import { createNotification, notifyPersonalLine } from "./notify";

export type DirectiveStatus = "sent" | "acknowledged" | "in_progress" | "done";

export interface Directive {
  id: string;
  created_by: string;
  created_by_name: string | null;
  assigned_to: string;
  assigned_to_name: string | null;
  department: string | null;
  message: string;
  reference_note: string | null;
  status: DirectiveStatus;
  response_note: string | null;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  done_at: string | null;
}

// สั่งงานตรงถึงพนักงาน — บันทึกลง DB + แจ้งเตือนกระดิ่งในแอป (เฉพาะคนนี้) + LINE ส่วนตัว (best-effort)
export async function sendDirective(opts: {
  createdByEmail: string;
  createdByName: string;
  assignedToEmail: string;
  assignedToName: string;
  department?: string | null;
  message: string;
  referenceNote?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("directives").insert({
    created_by: opts.createdByEmail,
    created_by_name: opts.createdByName,
    assigned_to: opts.assignedToEmail,
    assigned_to_name: opts.assignedToName,
    department: opts.department ?? null,
    message: opts.message,
    reference_note: opts.referenceNote ?? null,
  });
  if (error) return { ok: false, error: error.message };

  const title = `คำสั่งงานจาก ${opts.createdByName}`;
  const body = opts.referenceNote ? `${opts.message} (${opts.referenceNote})` : opts.message;

  await createNotification({
    type: "info",
    title,
    message: body,
    to_user_email: opts.assignedToEmail,
    link: "/directives",
  }).catch(() => {});

  await notifyPersonalLine(title, body, "/directives", [opts.assignedToEmail]).catch(() => {});

  return { ok: true };
}

export async function updateDirectiveStatus(
  id: string,
  status: DirectiveStatus,
  responseNote?: string,
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (responseNote !== undefined) patch.response_note = responseNote;
  if (status === "acknowledged") patch.acknowledged_at = new Date().toISOString();
  if (status === "done") patch.done_at = new Date().toISOString();

  const { error } = await supabase.from("directives").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
