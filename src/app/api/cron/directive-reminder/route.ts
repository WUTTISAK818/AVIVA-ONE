import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLineToEmail } from "@/lib/line-log";
import { addDaysStr, thaiDateOf, thaiDateStr } from "@/lib/thai-date";
import { daysBetweenStr } from "@/lib/lead-priority";
import { CLOSE_INSTRUCTION } from "@/lib/directive-next-step";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

interface DirectiveRow {
  id: string;
  created_by: string;
  created_by_name: string | null;
  assigned_to: string;
  assigned_to_name: string | null;
  message: string;
  status: string;
  due_date: string | null;
  created_at: string;
  acknowledged_at: string | null;
  reminder_stage: number | null;
}

/** ส่งถึงคนเดียว: กระดิ่งในแอป + push + LINE ส่วนตัว (บันทึกผลการส่ง LINE ไว้ตรวจย้อนหลังเสมอ) */
async function notifyOne(
  db: SupabaseClient, email: string, title: string, body: string,
  directiveId?: string, askReply = false,
) {
  await db.from("notifications").insert({
    project_id: PROJECT_ID, type: "info", to_user_email: email, from_dept: "ระบบคำสั่งงาน",
    title, message: body, is_read: false, link: "/directives",
  });
  await sendPush({ userEmail: email }, { title, body, url: "/directives", tag: "directive-reminder" }).catch(() => {});

  // ตอบกลับใน LINE ว่า "รับทราบ" ได้เลย ไม่ต้องเปิดแอปไปหาปุ่ม (Pom 30 ก.ย. 69)
  const text = `${title}\n\n${body}` + (askReply ? '\n\n— ตอบกลับข้อความนี้ว่า "รับทราบ" เพื่อยืนยันได้เลย' : "");
  await sendLineToEmail(db, email, text, {
    kind: "directive_reminder", toEmail: email, refType: "directive", refId: directiveId ?? null, title,
  });
}

// บันไดเตือนคำสั่งงาน — เตือนสูงสุด 3 ครั้งต่อ 1 คำสั่ง แล้วหยุด (Pom อนุมัติ 28 ก.ย. 69)
//   ขั้น 1 = สั่งไปแล้วเกิน 1 วันยังไม่กดรับทราบ → เตือนผู้รับ
//   ขั้น 2 = ครบกำหนดวันนี้                      → เตือนผู้รับ
//   ขั้น 3 = เลยกำหนดแล้ว 1 วัน                  → เตือนผู้รับ + รายงานผู้สั่ง แล้วหยุดเตือน
//   ขั้น 4 = ค้างเกิน 3 วันโดยไม่ได้กำหนดวันเสร็จ  → บอกผู้สั่งให้กำหนดวันเสร็จหรือยกเลิก แล้วหยุด
//   ขั้น 5 = รับทราบแล้วเกิน 2 วันแต่ยังไม่กดปิดงาน → บอกผู้รับว่าต้องกดปุ่มไหน + บอกผู้สั่งว่างานอาจเสร็จแล้วแต่ไม่มีใครกดปิด
//            (Pom สั่ง 6 ต.ค. 69 — เคสแปลง V29: ฟ้าทำเสร็จจริง 3 ต.ค. แต่คำสั่งงานค้างขึ้น "เลยกำหนด 7 วัน"
//             เพราะไม่มีใครกด "ทำเสร็จแล้ว · ส่งให้ตรวจรับ" และระบบไม่เคยบอกว่าต้องกดอะไร)
// กันเตือนซ้ำด้วย reminder_stage (ส่งเฉพาะขั้นที่สูงกว่าที่เคยส่งแล้ว)
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const today = thaiDateStr();
  const yesterday = addDaysStr(today, -1);

  const { data, error } = await db.from("directives")
    .select("id, created_by, created_by_name, assigned_to, assigned_to_name, message, status, due_date, created_at, acknowledged_at, reminder_stage")
    .not("status", "in", '("closed","cancelled")');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as DirectiveRow[];
  const sentLog: { id: string; stage: number; to: string[] }[] = [];
  let unacknowledged = 0, overdue = 0, pendingReview = 0;

  for (const d of rows) {
    const acked = !!d.acknowledged_at;
    const ageDays = daysBetweenStr(thaiDateOf(new Date(d.created_at)), today);
    const short = d.message.length > 120 ? `${d.message.slice(0, 120)}…` : d.message;

    if (!acked) unacknowledged++;
    if (d.status === "done") pendingReview++;
    if (d.due_date && d.due_date < today) overdue++;

    // งานที่พนักงานส่งมาให้ตรวจรับแล้ว ไม่ต้องไปจี้พนักงานอีก (ค้างที่ผู้สั่ง)
    if (d.status === "done") continue;

    // รับทราบแล้วแต่ยังไม่ปิดงาน — นับจากวันที่กดรับทราบ
    const ackedDays = d.acknowledged_at
      ? daysBetweenStr(thaiDateOf(new Date(d.acknowledged_at)), today)
      : 0;

    const stage = Math.max(
      !acked && ageDays >= 1 ? 1 : 0,
      d.due_date === today ? 2 : 0,
      d.due_date === yesterday ? 3 : 0,
      !d.due_date && !acked && ageDays >= 3 ? 4 : 0,
      acked && ackedDays >= 2 ? 5 : 0,
    );
    if (stage === 0 || stage <= (d.reminder_stage ?? 0)) continue;

    const to: string[] = [];
    if (stage === 1) {
      await notifyOne(db, d.assigned_to,
        `⏰ ยังไม่ได้กดรับทราบคำสั่งงาน (สั่งมา ${ageDays} วัน)`,
        `${short}\n\nจาก: ${d.created_by_name ?? "ผู้สั่งงาน"}`, d.id, true);
      to.push(d.assigned_to);
    } else if (stage === 2) {
      await notifyOne(db, d.assigned_to,
        "📅 คำสั่งงานนี้ครบกำหนดวันนี้",
        `${short}\n\nจาก: ${d.created_by_name ?? "ผู้สั่งงาน"}\n\nทำเสร็จแล้วตอบกลับว่า "เสร็จแล้ว" ตามด้วยรายงานผลงานสั้น ๆ ได้เลย`, d.id, !acked);
      to.push(d.assigned_to);
    } else if (stage === 3) {
      await notifyOne(db, d.assigned_to,
        "🔴 คำสั่งงานเลยกำหนดแล้ว 1 วัน",
        `${short}\n\nจาก: ${d.created_by_name ?? "ผู้สั่งงาน"}\n\nระบบแจ้งผู้สั่งงานแล้ว และนี่เป็นการเตือนอัตโนมัติครั้งสุดท้าย`, d.id, !acked);
      await notifyOne(db, d.created_by,
        `🔴 งานที่สั่ง ${d.assigned_to_name ?? "พนักงาน"} เลยกำหนดแล้ว 1 วัน`,
        `${short}\n\nกำหนดเสร็จ: ${d.due_date}\nสถานะล่าสุด: ${acked ? "รับทราบแล้ว" : "ยังไม่กดรับทราบ"}\n\nระบบจะไม่เตือนซ้ำอีก — ติดตามเองหรือยกเลิกคำสั่งได้ในแท็บ "ที่ฉันสั่ง"`, d.id);
      to.push(d.assigned_to, d.created_by);
    } else if (stage === 5) {
      // ตัวนี้ไม่ได้จี้ว่า "ทำไมยังไม่ทำ" แต่บอกว่า "ถ้าทำเสร็จแล้วต้องกดอะไร"
      await notifyOne(db, d.assigned_to,
        "📌 งานนี้ทำเสร็จแล้วหรือยัง? อย่าลืมกดปิดงาน",
        `${short}\n\nจาก: ${d.created_by_name ?? "ผู้สั่งงาน"}\n\n${CLOSE_INSTRUCTION}`, d.id);
      await notifyOne(db, d.created_by,
        `📌 งานที่สั่ง ${d.assigned_to_name ?? "พนักงาน"} อาจเสร็จแล้วแต่ยังไม่ได้กดปิด`,
        `${short}\n\nรับทราบตั้งแต่ ${ackedDays} วันก่อน แต่ยังไม่ได้กด "ทำเสร็จแล้ว · ส่งให้ตรวจรับ"\n` +
        `ปุ่ม "ตรวจรับ · ปิดจ็อบ" ของคุณจะขึ้นก็ต่อเมื่อผู้รับกดส่งมาก่อน\n\n` +
        `ระบบแจ้งวิธีกดให้ ${d.assigned_to_name ?? "ผู้รับงาน"} แล้ว และจะไม่เตือนซ้ำอีก`, d.id);
      to.push(d.assigned_to, d.created_by);
    } else {
      await notifyOne(db, d.created_by,
        `⏳ คำสั่งงานค้าง ${ageDays} วัน ยังไม่มีใครกดรับทราบ`,
        `${short}\n\nผู้รับ: ${d.assigned_to_name ?? d.assigned_to}\nงานนี้ไม่ได้กำหนดวันเสร็จ ระบบจึงเตือนตามกำหนดให้ไม่ได้\n\nแนะนำ: เปิดแท็บ "ที่ฉันสั่ง" → สั่งใหม่พร้อมกำหนดวันเสร็จ หรือกดยกเลิกคำสั่งนี้`, d.id);
      to.push(d.created_by);
    }

    await db.from("directives")
      .update({ reminder_stage: stage, last_reminder_at: new Date().toISOString() })
      .eq("id", d.id).lt("reminder_stage", stage);
    sentLog.push({ id: d.id, stage, to });
  }

  // สรุปเช้าถึงผู้บริหาร — เห็นยอดคำสั่งงานค้างทั้งองค์กรในที่เดียว
  if (rows.length > 0) {
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบคำสั่งงาน",
      title: `📋 คำสั่งงานที่ยังไม่จบ ${rows.length} ชิ้น`,
      message: [
        `ยังไม่กดรับทราบ ${unacknowledged} ชิ้น`,
        `เลยกำหนดแล้ว ${overdue} ชิ้น`,
        `รอผู้สั่งตรวจรับ ${pendingReview} ชิ้น`,
        sentLog.length > 0 ? `วันนี้ระบบเตือนอัตโนมัติไป ${sentLog.length} ชิ้น` : "วันนี้ไม่มีรายการถึงรอบเตือน",
      ].join("\n"),
      is_read: false, link: "/directives",
    });
  }

  return NextResponse.json({
    ok: true, date: today, open: rows.length,
    unacknowledged, overdue, pendingReview, reminded: sentLog.length, sentLog,
  });
}
