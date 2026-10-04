import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { isManagerRole } from "@/lib/roles";
import { sendLineToEmail } from "@/lib/line-log";

export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const OPEN_STATUSES = ["submitted", "late"];

interface SendBackItem { id: string; reason: string }

function thaiDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("th-TH", {
    timeZone: "UTC", day: "numeric", month: "long", year: "numeric",
  });
}

/**
 * รับทราบ/ตีกลับรายงานประจำวันหลายฉบับในคำขอเดียว (Pom สั่ง 4 ต.ค. 69)
 *
 * ทำสองอย่างที่ของเดิมทำไม่ได้:
 *  1) รับทราบทั้งวันในการกดครั้งเดียว และบันทึกไว้ว่ารับทราบด้วยวิธีไหน (individual/bulk)
 *     เพื่อให้การตรวจย้อนหลังแยกออกได้ว่าอ่านรายฉบับหรือกดรวม
 *  2) แจ้งถึง "ตัวพนักงานคนนั้น" (to_user_email + LINE ส่วนตัว)
 *     ของเดิมแจ้งแบบ to_dept = ทั้งแผนก ฝ่ายขาย 2 คนจึงได้แจ้งเตือนของกันและกัน
 *     อ่านแล้วไม่รู้ว่า "รายงานของคุณ" หมายถึงใคร
 */
export async function POST(req: NextRequest) {
  const { user, error } = await verifyAuth(req);
  if (error || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data: dbUser } = await db.from("users").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!isManagerRole(dbUser?.role)) {
    return NextResponse.json({ error: "เฉพาะผู้บริหาร/ผู้จัดการเท่านั้น" }, { status: 403 });
  }
  const managerName = (dbUser?.full_name as string | null) || user.email || "ผู้บริหาร";

  let body: { acknowledge?: string[]; sendBack?: SendBackItem[]; comment?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const ackIds = (body.acknowledge ?? []).filter(Boolean);
  const backs = (body.sendBack ?? []).filter(s => s?.id && s?.reason?.trim());
  const comment = (body.comment ?? "").trim();
  const method = body.method === "individual" ? "individual" : "bulk";

  if (ackIds.length === 0 && backs.length === 0) {
    return NextResponse.json({ error: "ไม่มีรายการให้ดำเนินการ" }, { status: 400 });
  }
  // ตีกลับต้องมีเหตุผลทุกฉบับ — ไม่งั้นพนักงานไม่รู้ว่าต้องแก้อะไร (กติกาเดิม คงไว้)
  if ((body.sendBack ?? []).some(s => !s?.reason?.trim())) {
    return NextResponse.json({ error: "การตีกลับต้องระบุเหตุผลทุกฉบับ" }, { status: 400 });
  }

  const touchedIds = [...ackIds, ...backs.map(b => b.id)];
  const { data: targets } = await db
    .from("work_reports")
    .select("id, user_email, employee_name, department, report_date, acknowledged_by")
    .in("id", touchedIds)
    .in("status", OPEN_STATUSES);
  const byId = new Map((targets ?? []).map(t => [t.id as string, t]));

  const now = new Date().toISOString();
  const acknowledged: string[] = [];
  const sentBack: string[] = [];
  const skipped: string[] = [];
  let lineSent = 0;

  // ── รับทราบ ──
  for (const id of ackIds) {
    const t = byId.get(id);
    if (!t) { skipped.push(id); continue; }
    if (t.acknowledged_by) { skipped.push(id); continue; }   // รับทราบไปแล้ว ไม่เขียนทับ
    const { data: changed } = await db.from("work_reports").update({
      acknowledged_by: managerName,
      acknowledged_at: now,
      ack_method: method,
      manager_comment: comment || null,
      // รับทราบแล้ว = จบ → ล้างสถานะ "ตีกลับ" ที่อาจค้าง (กันป้ายขัดกัน)
      returned_at: null,
      return_reason: null,
      updated_at: now,
    }).eq("id", id).is("acknowledged_by", null).select("id");
    if (!changed || changed.length === 0) { skipped.push(id); continue; }
    acknowledged.push(id);

    const dateLabel = thaiDate(t.report_date as string);
    const title = "✅ ผู้บริหารรับทราบรายงานของคุณแล้ว";
    const message = `รายงานวันที่ ${dateLabel}\nรับทราบโดย ${managerName}${comment ? `\nความเห็น: ${comment}` : ""}`;
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info",
      to_user_email: t.user_email, from_dept: "ผู้บริหาร",
      title, message, is_read: false, link: "/reports/my-reports", record_id: id,
    }).then(() => {}, () => {});
    const res = await sendLineToEmail(db, t.user_email as string, `${title}\n${message}`, {
      kind: "report_acknowledged", refType: "work_report", refId: id, title,
    });
    if (res.ok) lineSent++;
  }

  // ── ตีกลับให้แก้ ──
  for (const b of backs) {
    const t = byId.get(b.id);
    if (!t || t.acknowledged_by) { skipped.push(b.id); continue; }
    const reason = b.reason.trim();
    const { data: changed } = await db.from("work_reports").update({
      returned_at: now, return_reason: reason, updated_at: now,
    }).eq("id", b.id).is("acknowledged_by", null).select("id");
    if (!changed || changed.length === 0) { skipped.push(b.id); continue; }
    sentBack.push(b.id);

    const dateLabel = thaiDate(t.report_date as string);
    const title = "↩️ รายงานของคุณถูกตีกลับให้แก้ไข";
    const message = `รายงานวันที่ ${dateLabel}\nเหตุผล: ${reason}\n\nแก้ไขได้ที่เมนู "งานรายวัน" แล้วส่งใหม่`;
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "warning",
      to_user_email: t.user_email, from_dept: "ผู้บริหาร",
      title, message, is_read: false, link: "/reports", record_id: b.id,
    }).then(() => {}, () => {});
    const res = await sendLineToEmail(db, t.user_email as string, `${title}\n${message}`, {
      kind: "report_returned", refType: "work_report", refId: b.id, title,
    });
    if (res.ok) lineSent++;
  }

  return NextResponse.json({
    ok: true, method,
    acknowledged: acknowledged.length,
    sentBack: sentBack.length,
    skipped: skipped.length,
    lineSent,
  });
}
