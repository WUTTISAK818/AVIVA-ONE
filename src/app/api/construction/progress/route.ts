import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { isManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

/** สถานะที่ผังก่อสร้างใช้ — ผูกกับ % ให้ตรงกันเสมอ จะได้ไม่มีกรณี 100% แต่ยังขึ้นว่ายังไม่เริ่ม */
function statusFor(progress: number): string {
  if (progress >= 100) return "completed";
  if (progress > 0) return "in_progress";
  return "not_started";
}

interface UnitUpdate { plotCode: string; progress: number }

/**
 * วิศวกรหน้างานอัปเดตความคืบหน้าแปลงจากรายงานประจำวันของตัวเอง (Pom แจ้ง 6 ต.ค. 69)
 *
 * ปัญหาเดิม: ผังในหน้าฝ่ายก่อสร้างอ่านจากตาราง `houses` ซึ่งไม่มีใครแก้มาตั้งแต่ 18-19 มิ.ย. 69
 * ขณะที่วิศวกรส่งรายงานหน้างานพร้อมรูปทุกวัน — ผังจึงขึ้นว่า V28/V29 "ยังไม่เริ่ม 0%"
 * ทั้งที่ทาสีรอบสองไปแล้ว ส่วน `construction_reports` มีข้อมูลแค่แถวเดียวตั้งแต่ 26 มิ.ย.
 *
 * ตั้งใจให้ "คนกรอกตัวเลขเอง" ไม่ใช่ให้ระบบเดา % จากข้อความ เพราะเปอร์เซ็นต์ในรายงาน
 * เป็นของ "เนื้องานย่อย" (เช่น ทาสีจริงภายในครั้งที่ 2 = 45%) ไม่ใช่ความคืบหน้าของทั้งหลัง
 * ระบบช่วยแค่จับว่าวันนี้ทำแปลงไหนบ้าง แล้วเอาค่าปัจจุบันมาตั้งต้นให้แก้
 */
export async function POST(req: NextRequest) {
  const { user, error } = await verifyAuth(req);
  if (error || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data: dbUser } = await db.from("users").select("role, full_name").eq("id", user.id).maybeSingle();
  const role = (dbUser?.role as string | null) ?? "";
  // วิศวกร/ฝ่ายก่อสร้าง อัปเดตได้เอง (เป็นคนที่รู้หน้างานจริง) · ผู้บริหารแก้ได้เสมอ
  const allowed = isManagerRole(role) || ["engineer", "foreman", "site_engineer"].includes(role.toLowerCase().trim());
  if (!allowed) return NextResponse.json({ error: "เฉพาะวิศวกรหน้างานหรือผู้บริหารเท่านั้น" }, { status: 403 });

  const byName = (dbUser?.full_name as string | null) || user.email || "ไม่ระบุ";

  let body: { updates?: UnitUpdate[]; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 }); }

  const updates = (body.updates ?? []).filter(u =>
    u?.plotCode && Number.isFinite(Number(u.progress)) && Number(u.progress) >= 0 && Number(u.progress) <= 100);
  if (updates.length === 0) return NextResponse.json({ error: "ไม่มีรายการให้อัปเดต" }, { status: 400 });

  const note = (body.note ?? "").trim();
  const codes = updates.map(u => u.plotCode.toUpperCase());

  const { data: houses } = await db.from("houses")
    .select("id, plot_code, progress, construction_status")
    .eq("project_id", PROJECT_ID).in("plot_code", codes);
  const byCode = new Map((houses ?? []).map(h => [(h.plot_code as string).toUpperCase(), h]));

  const changed: { plotCode: string; from: number; to: number; status: string }[] = [];
  const notFound: string[] = [];
  const now = new Date().toISOString();

  for (const u of updates) {
    const code = u.plotCode.toUpperCase();
    const house = byCode.get(code);
    if (!house) { notFound.push(code); continue; }

    const to = Math.round(Number(u.progress));
    const from = Number(house.progress ?? 0);
    const status = statusFor(to);
    if (to === from && status === house.construction_status) continue;   // ไม่มีอะไรเปลี่ยน ไม่ต้องเขียน

    await db.from("houses").update({
      progress: to, construction_status: status, updated_by: byName, updated_at: now,
    }).eq("id", house.id);

    // เก็บประวัติไว้ด้วย — ผังบอกแค่สถานะล่าสุด ส่วนตารางนี้บอกว่าใครอัปเดตเมื่อไหร่จากงานอะไร
    await db.from("construction_reports").insert({
      house_id: house.id, progress: to, reported_by: byName,
      work_type: "อัปเดตจากรายงานประจำวัน",
      work_detail: note || null,
    }).then(() => {}, () => {});

    changed.push({ plotCode: code, from, to, status });
  }

  // แจ้งผู้บริหารเมื่อแปลงไหนเสร็จ 100% — เป็นจุดที่ต้องเริ่มงานส่งมอบ/ตรวจรับ
  const finished = changed.filter(c => c.to >= 100 && c.from < 100);
  if (finished.length > 0) {
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ฝ่ายก่อสร้าง",
      title: `🏠 ก่อสร้างเสร็จ 100% — ${finished.map(f => f.plotCode).join(", ")}`,
      message: `${byName} อัปเดตจากรายงานหน้างาน${note ? `\n\n${note}` : ""}`,
      is_read: false, link: "/construction",
    }).then(() => {}, () => {});
  }

  return NextResponse.json({ ok: true, changed, notFound });
}
