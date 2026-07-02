import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// สรุปสถานะรายงานประจำวัน "วันนี้" (เวลาไทย UTC+7) สำหรับ widget ผู้บริหารบนหน้าหลัก
// total = พนักงาน active ที่ต้องส่งรายงาน (ยกเว้นฝ่ายสวน) · submitted = ส่งแล้ว(รวมล่าช้า) · late = ส่งล่าช้า
export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req, ["manager"]);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const todayThai = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const db = getSupabaseAdmin();

    const [{ count: expected }, { data: reports }] = await Promise.all([
      db.from("employees")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .neq("department", "ฝ่ายสวน"),
      db.from("work_reports")
        .select("id, status")
        .eq("report_type", "daily")
        .eq("report_date", todayThai)
        .in("status", ["submitted", "late"]),
    ]);

    const submitted = reports?.length ?? 0;
    const late = reports?.filter(r => r.status === "late").length ?? 0;

    return NextResponse.json({ total: expected ?? 0, submitted, late, date: todayThai });
  } catch (err) {
    console.error("Error fetching report summary:", err);
    return NextResponse.json({ error: "Failed to fetch report summary" }, { status: 500 });
  }
}
