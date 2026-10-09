import { supabase } from "./supabase";
import { createNotification, notifyPersonalLine } from "./notify";
import { CLOSE_INSTRUCTION } from "./directive-next-step";
import { thaiDbError } from "./db-errors";

// สายสถานะคำสั่งงาน — "done" คือพนักงานรายงานว่าเสร็จ (ยังไม่จบ) · "closed" คือผู้สั่งตรวจรับแล้วปิดจ็อบ (จบจริง)
export type DirectiveStatus = "sent" | "acknowledged" | "in_progress" | "done" | "closed" | "cancelled";

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
  closed_at: string | null;
  closed_by: string | null;
  close_note: string | null;
  returned_at: string | null;
  return_note: string | null;
  return_count: number;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  /** ขั้นบันไดเตือนอัตโนมัติที่ส่งไปแล้ว (0 = ยังไม่เคยเตือน) — cron เขียนฝั่งเดียว */
  reminder_stage?: number | null;
  last_reminder_at?: string | null;
}

/** คำอธิบายบันไดเตือนอัตโนมัติ ใช้แสดงในไทม์ไลน์ให้ผู้ใช้รู้ว่าระบบเตือนไปกี่ครั้งแล้ว */
export const REMINDER_STAGE_LABEL: Record<number, string> = {
  1: "เตือนผู้รับ: ยังไม่กดรับทราบ",
  2: "เตือนผู้รับ: ครบกำหนดวันนี้",
  3: "เตือนครั้งสุดท้าย: เลยกำหนด 1 วัน (แจ้งผู้สั่งด้วย)",
  4: "แจ้งผู้สั่ง: งานค้างและไม่ได้กำหนดวันเสร็จ",
  5: "เตือนผู้รับ: รับทราบแล้วแต่ยังไม่กดปิดงาน (แจ้งผู้สั่งด้วย)",
};

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
  // บอกวิธีปิดงานไปตั้งแต่ข้อความแรก — ไม่ให้พนักงานต้องเดาว่าทำเสร็จแล้วต้องกดอะไร
  const body = (opts.referenceNote ? `${opts.message} (${opts.referenceNote})` : opts.message) + dueLine
    + `\n\n${CLOSE_INSTRUCTION}`;

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

  // ปิดจ็อบแล้วห้ามย้อนสถานะ — พนักงานแก้ได้เฉพาะงานที่ยังไม่ถูกผู้สั่งปิดรับ
  // "รับทราบ" บังคับว่าต้องมาจาก sent เท่านั้น เพื่อให้แจ้งผู้สั่งได้ครั้งเดียว
  // (เปิดอ่านซ้ำ/กดปุ่มซ้ำต้องไม่ยิงแจ้งเตือนใหม่)
  let q = supabase.from("directives").update(patch).eq("id", directive.id);
  q = status === "acknowledged"
    ? q.eq("status", "sent")
    : q.not("status", "in", '("closed","cancelled")');
  const { data: changed, error } = await q.select("id");
  if (error) return { ok: false, error: thaiDbError(error, "อัปเดตสถานะ") };
  if (!changed || changed.length === 0) {
    // รับทราบซ้ำไม่ใช่ความผิดพลาด แค่ไม่มีอะไรให้เปลี่ยน
    if (status === "acknowledged") return { ok: true };
    return { ok: false, error: "งานนี้ถูกปิดจ็อบหรือยกเลิกไปแล้ว — แก้สถานะไม่ได้" };
  }

  // แจ้งผู้สั่งงานว่าผู้รับเปิดอ่านและรับงานแล้ว
  // เดิมไม่มีขั้นนี้: Pom สั่งงาน 27 ก.ย. ฟ้ากดรับทราบ 2 ต.ค. แต่ Pom ไม่ได้รับแจ้งอะไรเลย
  // จึงไม่รู้ว่างานถูกรับไปทำแล้วหรือยังเงียบอยู่
  if (status === "acknowledged") {
    const title = `👀 ${directive.assigned_to_name || "ผู้รับงาน"} รับทราบคำสั่งงานแล้ว`;
    const body = `${directive.message}\n\nรับงานไปแล้ว กำลังดำเนินการ — ระบบจะแจ้งอีกครั้งเมื่อรายงานว่าเสร็จ`;
    await createNotification({
      type: "info", title, message: body,
      to_user_email: directive.created_by, link: "/directives",
    }).catch(() => {});
    await notifyPersonalLine(title, body, "/directives", [directive.created_by]).catch(() => {});
  }

  if (status === "done") {
    const title = `${directive.assigned_to_name || "พนักงาน"} รายงานว่าทำเสร็จแล้ว — รอคุณตรวจรับ`;
    const body = (responseNote ? `${directive.message}\n\nรายงานผลงาน: ${responseNote}` : directive.message)
      + "\n\nเปิดหน้าคำสั่งงาน → แท็บ \"ที่ฉันสั่ง\" เพื่อตรวจรับและปิดจ็อบ (หรือตีกลับให้แก้)";
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


type ReviewTarget = Pick<Directive, "id" | "assigned_to" | "assigned_to_name" | "created_by_name" | "message" | "return_count">;

/** ผู้สั่งงานตรวจรับแล้ว "ปิดจ็อบ" — ปิดได้เฉพาะงานที่พนักงานรายงานเสร็จแล้ว (status = done)
 *  ใช้เงื่อนไขสถานะเดิมใน update กันกดซ้ำ/กดพร้อมกัน 2 หน้าต่าง (QA-STANDARD ส่วน D) */
export async function closeDirective(
  directive: ReviewTarget,
  closedByEmail: string,
  closeNote?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("directives")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: closedByEmail,
      close_note: (closeNote ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", directive.id).eq("status", "done").select("id");
  if (error) return { ok: false, error: thaiDbError(error, "ปิดจ็อบ") };
  if (!data || data.length === 0) return { ok: false, error: "งานนี้ถูกปิดจ็อบไปแล้ว หรือสถานะเปลี่ยนไปแล้ว — รีเฟรชหน้าอีกครั้ง" };

  const title = `✅ ${directive.created_by_name || "ผู้สั่งงาน"} ตรวจรับและปิดจ็อบแล้ว`;
  const body = (closeNote ?? "").trim()
    ? `${directive.message}\n\nความเห็นผู้สั่งงาน: ${closeNote!.trim()}`
    : `${directive.message}\n\nงานนี้ปิดเรียบร้อย ขอบคุณครับ`;
  await createNotification({ type: "success", title, message: body, to_user_email: directive.assigned_to, link: "/directives" }).catch(() => {});
  await notifyPersonalLine(title, body, "/directives", [directive.assigned_to]).catch(() => {});
  return { ok: true };
}

/** ผู้สั่งงานตรวจแล้วยังไม่ผ่าน — ตีกลับให้แก้ พร้อมเหตุผล (บังคับ) แล้วงานกลับไปสถานะ "กำลังทำ" */
export async function returnDirective(
  directive: ReviewTarget,
  returnNote: string,
): Promise<{ ok: boolean; error?: string }> {
  const reason = returnNote.trim();
  if (!reason) return { ok: false, error: "กรุณาเขียนเหตุผลที่ตีกลับ เพื่อให้พนักงานรู้ว่าต้องแก้อะไร" };

  const { data, error } = await supabase
    .from("directives")
    .update({
      status: "in_progress",
      returned_at: new Date().toISOString(),
      return_note: reason,
      return_count: (directive.return_count ?? 0) + 1,
      done_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", directive.id).eq("status", "done").select("id");
  if (error) return { ok: false, error: thaiDbError(error, "ตีกลับให้แก้") };
  if (!data || data.length === 0) return { ok: false, error: "สถานะงานเปลี่ยนไปแล้ว — รีเฟรชหน้าอีกครั้ง" };

  const title = `🔁 ${directive.created_by_name || "ผู้สั่งงาน"} ตีกลับให้แก้`;
  const body = `${directive.message}\n\nสิ่งที่ต้องแก้: ${reason}`;
  await createNotification({ type: "activity", title, message: body, to_user_email: directive.assigned_to, link: "/directives" }).catch(() => {});
  await notifyPersonalLine(title, body, "/directives", [directive.assigned_to]).catch(() => {});
  return { ok: true };
}

/** จำนวนงานที่พนักงานรายงานเสร็จแล้วและรอผู้สั่งตรวจรับ — ใช้ขึ้นป้ายเตือนบนหน้าหลัก/หน้าคำสั่งงาน */
export async function countPendingReview(createdByEmail: string): Promise<number> {
  const { count } = await supabase
    .from("directives")
    .select("id", { count: "exact", head: true })
    .eq("created_by", createdByEmail)
    .eq("status", "done");
  return count ?? 0;
}


/** ผู้สั่งงานยกเลิกคำสั่งงาน — ต้องมีเหตุผลเสมอ เพื่อให้ผู้รับรู้ว่าทำไมไม่ต้องทำแล้ว
 *  ยกเลิกได้ทุกสถานะยกเว้นงานที่ปิดจ็อบไปแล้ว (งานนั้นจบสมบูรณ์แล้ว ย้อนไม่ได้) */
export async function cancelDirective(
  directive: Pick<Directive, "id" | "assigned_to" | "created_by_name" | "message">,
  cancelledByEmail: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const why = reason.trim();
  if (!why) return { ok: false, error: "กรุณาเขียนเหตุผลที่ยกเลิก เพื่อให้ผู้รับงานเข้าใจ" };

  const { data, error } = await supabase
    .from("directives")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledByEmail,
      cancel_reason: why,
      updated_at: new Date().toISOString(),
    })
    .eq("id", directive.id)
    .not("status", "in", '("closed","cancelled")')
    .select("id");
  if (error) return { ok: false, error: thaiDbError(error, "ยกเลิกคำสั่งงาน") };
  if (!data || data.length === 0) return { ok: false, error: "งานนี้ปิดจ็อบหรือยกเลิกไปแล้ว — รีเฟรชหน้าอีกครั้ง" };

  const title = `🚫 ${directive.created_by_name || "ผู้สั่งงาน"} ยกเลิกคำสั่งงานนี้แล้ว`;
  const body = `${directive.message}\n\nเหตุผล: ${why}\n\nไม่ต้องดำเนินการต่อแล้วครับ`;
  await createNotification({ type: "activity", title, message: body, to_user_email: directive.assigned_to, link: "/directives" }).catch(() => {});
  await notifyPersonalLine(title, body, "/directives", [directive.assigned_to]).catch(() => {});
  return { ok: true };
}
