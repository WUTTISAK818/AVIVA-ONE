import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { isManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

// ค้นหาข้อความในรายงานย้อนหลัง (สรุป + รายการย่อย + ชื่อคนส่ง)
// ผู้บริหาร: ค้นได้ทุกคน · พนักงาน: ค้นเฉพาะรายงานของตัวเอง
export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ error: "คำค้นต้องยาวอย่างน้อย 2 ตัวอักษร" }, { status: 400 });
  }

  try {
    const db = getSupabaseAdmin();

    // สิทธิ์: อ่าน role จาก users แล้วจำกัดขอบเขตของพนักงานทั่วไป
    const { data: dbUser } = await db.from("users").select("role").eq("id", user.id).maybeSingle();
    const managerView = isManagerRole(dbUser?.role);
    const ownEmail = (user.email ?? "").toLowerCase();

    // กัน wildcard ของ ILIKE ในคำค้นผู้ใช้
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;

    // 1) เจอในหัวรายงาน (สรุป/ชื่อคน)
    let headQ = db
      .from("work_reports")
      .select("id, report_date, employee_name, department, status, summary")
      .eq("report_type", "daily")
      .in("status", ["submitted", "late"])
      .or(`summary.ilike.${like},employee_name.ilike.${like}`)
      .order("report_date", { ascending: false })
      .limit(30);
    if (!managerView) headQ = headQ.eq("user_email", ownEmail);
    const { data: headHits } = await headQ;

    // 2) เจอในรายการย่อย → โยงกลับหัวรายงาน
    const { data: itemHits } = await db
      .from("work_report_items")
      .select("report_id, description")
      .ilike("description", like)
      .limit(60);

    const itemSnippets = new Map<string, string>();
    (itemHits ?? []).forEach(it => {
      if (!itemSnippets.has(it.report_id)) itemSnippets.set(it.report_id, it.description);
    });

    const headIds = new Set((headHits ?? []).map(r => r.id));
    const extraIds = [...itemSnippets.keys()].filter(id => !headIds.has(id)).slice(0, 30);

    let extraReports: any[] = [];
    if (extraIds.length > 0) {
      let extraQ = db
        .from("work_reports")
        .select("id, report_date, employee_name, department, status, summary")
        .eq("report_type", "daily")
        .in("status", ["submitted", "late"])
        .in("id", extraIds);
      if (!managerView) extraQ = extraQ.eq("user_email", ownEmail);
      extraReports = (await extraQ).data ?? [];
    }

    const results = [...(headHits ?? []), ...extraReports]
      .map(r => ({
        id: r.id,
        reportDate: r.report_date,
        employeeName: r.employee_name,
        department: r.department,
        status: r.status,
        snippet: itemSnippets.get(r.id) ?? r.summary ?? "",
      }))
      .sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1))
      .slice(0, 30);

    return NextResponse.json({ q, count: results.length, results });
  } catch (err) {
    console.error("Error searching reports:", err);
    return NextResponse.json({ error: "ค้นหาไม่สำเร็จ" }, { status: 500 });
  }
}
