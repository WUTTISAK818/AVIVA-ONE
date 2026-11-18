// แจ้งเตือนของ "คำขอแก้ไขข้อมูลลูกค้า" (ฝั่งเบราว์เซอร์) — กระดิ่ง + LINE ทุกขั้น
//  - ถึงผู้บริหาร: แจ้งแผนก "ผู้บริหาร" (กระดิ่ง + LINE ส่วนตัวของผู้บริหารทุกคน) ลิงก์ไปหน้าอนุมัติ
//  - ถึงผู้ขอ: แจ้งรายคนเท่านั้น (to_user_email + LINE ส่วนตัวของคนนั้น) ไม่กระจายทั้งฝ่ายขาย
import { createNotification, notifyPersonalLine } from "./notify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitEditRequest, isExpiredEdit, formatEditValue, type LeadEditRequest, type Actor } from "./lead-edit-request";

export async function notifyEditExecutives(title: string, message: string, leadId: string) {
  await createNotification({
    type: "approval", title, message,
    from_dept: "ฝ่ายขาย", to_dept: "ผู้บริหาร",
    record_id: leadId, link: "/approvals",
  });
}

export async function notifyEditRequester(email: string | null | undefined, title: string, message: string, leadId: string) {
  if (!email) return;
  const link = `/crm?lead=${leadId}`;
  await createNotification({
    type: "info", title, message,
    from_dept: "ผู้บริหาร", to_user_email: email,
    record_id: leadId, link,
  });
  await notifyPersonalLine(title, message, link, [email], "edit_request");
}


/**
 * คำขอที่หมดเวลาแก้ไขแล้วแต่ยังค้างสถานะ "editing" — ใครเปิดเจอก่อน (ผู้ขอเอง/ผู้บริหาร) ระบบส่งตรวจให้ทันที
 * ไม่ต้องรอ cron รอบเช้า · กันชนกันด้วยเงื่อนไขสถานะใน submitEditRequest (ส่งได้ครั้งเดียว)
 * คืนจำนวนรายการที่ถูกดำเนินการ (ผู้เรียกควรโหลดรายการใหม่ถ้า > 0)
 */
export async function processExpiredEditRequests(db: SupabaseClient, reqs: LeadEditRequest[], me: { email: string; isManager: boolean }): Promise<number> {
  const mine = reqs.filter((r) => isExpiredEdit(r) && (me.isManager || r.requested_by_email.toLowerCase() === me.email.toLowerCase()));
  if (mine.length === 0) return 0;
  const { data: leadRows } = await db.from("leads").select("id, lead_code, customer_name").in("id", mine.map((r) => r.lead_id));
  const leadById = new Map(((leadRows ?? []) as { id: string; lead_code: string | null; customer_name: string | null }[]).map((l) => [l.id, l]));
  const actor: Actor = { name: "ระบบ (หมดเวลาแก้ไข)" };
  let done = 0;
  for (const r of mine) {
    const res = await submitEditRequest(db, r, { auto: true, by: actor });
    if (!res.ok) continue;
    done++;
    const l = leadById.get(r.lead_id);
    const who = `${l?.lead_code ?? ""} ${l?.customer_name ?? ""}`.trim();
    if (res.closedNoChange) {
      await notifyEditRequester(r.requested_by_email, `⌛ หมดเวลาแก้ไข — ${who}`,
        "ไม่มีข้อมูลที่ถูกแก้ ระบบปิดคำขอให้แล้ว ถ้ายังต้องแก้ ให้ยื่นคำขอใหม่", r.lead_id);
      continue;
    }
    const diff = res.diff ?? [];
    await notifyEditExecutives(`📝 รอตรวจการแก้ไขข้อมูลลูกค้า — ${who}`,
      `${r.requested_by_name ?? r.requested_by_email} หมดเวลาแก้ไข ระบบส่งตรวจให้ (${diff.length} ช่อง)\n` +
      diff.map((d) => `• ${d.label}: ${formatEditValue(d.field, d.before)} → ${formatEditValue(d.field, d.after)}`).join("\n"),
      r.lead_id);
    await notifyEditRequester(r.requested_by_email, `📤 หมดเวลาแก้ไข ระบบส่งให้ผู้บริหารตรวจแล้ว — ${who}`,
      `ส่งตรวจ ${diff.length} ช่อง · รอผู้บริหารตรวจ`, r.lead_id);
  }
  return done;
}
