import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLineQuota } from "@/lib/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const WARN_PCT = 80;

function admin(): SupabaseClient {
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

// ตรวจโควตา LINE ทุกเช้า 08:40 น. (v8.14 · Pom อนุมัติ 17 พ.ย. 69)
// เหตุ: โควตาข้อความรายเดือนหมดเงียบ ๆ 2 เดือนติด (18 ต.ค. และ 13 พ.ย.) — แจ้งเตือน LINE ทุกอย่างไม่ถึงใคร
// ครึ่งเดือน โดยไม่มีใครรู้จนรอบตรวจของ ONE ไปเจอ
//  - บันทึกยอดทุกวันลง audit_log (module line / action line_quota_check) ไว้ตรวจย้อน + ยืนยันผลการอัปเกรดแพ็กเกจ
//  - ใช้เกิน 80% หรือหมดแล้ว → แจ้งกระดิ่งผู้บริหาร (ไม่ใช้ LINE เพราะอาจส่งไม่ออกแล้ว)
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const q = await getLineQuota();

  const pct = q.ok && q.type === "limited" && q.limit ? Math.round(((q.used ?? 0) / q.limit) * 100) : null;
  const summary = !q.ok
    ? `อ่านโควตา LINE ไม่ได้ (${q.error})`
    : q.type === "none"
      ? `โควตา LINE: ไม่จำกัด · ใช้ไปเดือนนี้ ${q.used ?? 0} ข้อความ`
      : `โควตา LINE: ${q.limit} ข้อความ/เดือน · ใช้ไป ${q.used ?? 0} (${pct}%)`;

  await db.from("audit_log").insert({
    module: "line", action: "line_quota_check", description: summary,
    performed_by: "ระบบ (ตรวจโควตา LINE)",
  });

  let alerted = false;
  if (pct !== null && pct >= WARN_PCT) {
    const left = Math.max(0, (q.limit ?? 0) - (q.used ?? 0));
    const title = pct >= 100 ? "🔴 โควตา LINE เดือนนี้หมดแล้ว — แจ้งเตือน LINE ส่งไม่ออก" : `🟠 โควตา LINE ใช้ไป ${pct}% แล้ว`;
    const message = `${summary}\nเหลือ ${left} ข้อความจนถึงต้นเดือนหน้า · ระหว่างนี้ดูแจ้งเตือนจากกระดิ่งในแอปแทน\nถ้าหมดบ่อย ให้พิจารณาอัปเกรดแพ็กเกจ LINE OA`;
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบ",
      title, message, is_read: false, link: "/settings",
    });
    alerted = true;
  }

  return NextResponse.json({ ok: q.ok, quota: q, pct, alerted });
}
