import { supabase } from "./supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// ประเภทแจ้งเตือนที่ส่งเข้า LINE ส่วนตัวด้วย (รออนุมัติ/ผลอนุมัติ/เคลม/หมุดหมาย) — เว้น "info" กัน spam
const LINE_TYPES = new Set(["approval", "claim", "success"]);

/** ยิงแจ้งเตือนเข้า LINE ส่วนตัวของผู้ใช้ที่ผูกบัญชีไว้ (best-effort, ไม่ throw) */
export async function notifyPersonalLine(title: string, body: string, url?: string, emails?: string[]) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch("/api/notify/personal-line", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ title, body, url, emails }),
    });
  } catch { /* best-effort */ }
}

export async function createNotification(opts: {
  type: "approval" | "claim" | "document" | "success" | "info";
  title: string;
  message: string;
  from_dept?: string;
  to_dept?: string;
  record_id?: string;
}) {
  await supabase.from("notifications").insert({
    project_id: PROJECT_ID,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    from_dept: opts.from_dept ?? null,
    to_dept: opts.to_dept ?? null,
    is_read: false,
    record_id: opts.record_id ?? null,
  });
  // เคสสำคัญ → ส่งเข้า LINE ส่วนตัวของผู้ที่ผูกบัญชีด้วย (best-effort)
  if (LINE_TYPES.has(opts.type)) {
    await notifyPersonalLine(opts.title, opts.message, opts.record_id ? `/crm?lead=${opts.record_id}` : undefined);
  }
}

/**
 * แจ้งเตือนหมุดหมายการขาย (จอง/ทำสัญญา/อนุมัติกู้/โอนแล้ว):
 * บันทึกลง DB (เด้ง real-time ในแอป) + ส่ง push เข้ามือถือฝ่ายขาย + ผู้บริหาร
 * push เป็น best-effort — ถ้าไม่มี VAPID/ยังไม่ได้ subscribe จะข้ามเงียบๆ
 */
export async function notifyMilestone(opts: {
  title: string;
  message: string;
  record_id?: string;
  url?: string;
}) {
  await createNotification({
    type: "success",
    title: opts.title,
    message: opts.message,
    from_dept: "ฝ่ายขาย",
    to_dept: "ผู้บริหาร",
    record_id: opts.record_id,
  });
  const url = opts.url ?? (opts.record_id ? `/crm?lead=${opts.record_id}` : "/crm");
  // ส่งออกหลายช่องทาง (web push ฝ่ายขาย+ผู้บริหาร + LINE กลุ่มทีมขาย) — best-effort
  await fetch("/api/notify/milestone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: opts.title, body: opts.message, url }),
  }).catch(() => {});
}
