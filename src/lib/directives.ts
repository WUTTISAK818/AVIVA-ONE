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
  due_date: string | null;
  status: DirectiveStatus;
  response_note: string | null;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  done_at: string | null;
}

// สั่งงานตรงถึงพนักงาน 1 คนเสมอ (ไม่ใช่ทั้งแผนก) — บันทึกลง DB + แจ้งเตือนกระดิ่งในแอป (เฉพาะคนนี้) + LINE ส่วนตัว (best-effort)
export async function sendDirective(opts: {
  createdByEmail: string;
  createdByName: string;
  assignedToEmail: string;
  assignedToName: string;
  department?: string | null;
  message: string;
  referenceNote?: string | null;
  dueDate?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("directives").insert({
    created_by: opts.createdByEmail,
    created_by_name: opts.createdByName,
    assigned_to: opts.assignedToEmail,
    assigned_to_name: opts.assignedToName,
    department: opts.department ?? null,
    message: opts.message,
    reference_note: opts.referenceNote ?? null,
    due_date: opts.dueDate ?? null,
  });
  if (error) return { ok: false, error: error.message };

  const title = `คำสั่งงานจาก ${opts.createdByName}`;
  const dueLine = opts.dueDate ? ` · กำหนดเสร็จ ${new Date(opts.dueDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : "";
  const body = (opts.referenceNote ? `${opts.message} (${opts.referenceNote})` : opts.message) + dueLine;

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

// อัปเดตสถานะ (พนักงานผู้รับกดเอง) — ถ้าปิดงาน "เสร็จแล้ว" จะแจ้งกลับไปหาผู้สั่งงานพร้อมรายงานปิดงานทันที
export async function updateDirectiveStatus(
  directive: Pick<Directive, "id" | "created_by" | "created_by_name" | "assigned_to_name" | "message">,
  status: DirectiveStatus,
  responseNote?: string,
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (responseNote !== undefined) patch.response_note = responseNote;
  if (status === "acknowledged") patch.acknowledged_at = new Date().toISOString();
  if (status === "done") patch.done_at = new Date().toISOString();

  const { error } = await supabase.from("directives").update(patch).eq("id", directive.id);
  if (error) return { ok: false, error: error.message };

  if (status === "done") {
    const title = `${directive.assigned_to_name || "พนักงาน"} ปิดงานแล้ว`;
    const body = responseNote ? `${directive.message}\n\nรายงานปิดงาน: ${responseNote}` : directive.message;
    await createNotification({
      type: "info",
      title,
      message: body,
      to_user_email: directive.created_by,
      link: "/directives",
    }).catch(() => {});
    await notifyPersonalLine(title, body, "/directives", [directive.created_by]).catch(() => {});
  }

  return { ok: true };
}
