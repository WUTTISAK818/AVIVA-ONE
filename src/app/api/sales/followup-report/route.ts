import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { buildFollowupReport, type FollowupPeriod } from "@/lib/sales-followup-report";

export const dynamic = "force-dynamic";

// รายงานการติดตามลูกค้าเก่า รายสัปดาห์/รายเดือน — ใช้ในแท็บ "ผลงานทีม" ของหน้าขาย
// เฉพาะผู้บริหาร/ผู้จัดการ เพราะเป็นการเทียบผลงานระหว่างพนักงานขาย
export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req, ["manager"]);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("period");
  const period: FollowupPeriod = raw === "week" ? "week" : "month";

  try {
    const report = await buildFollowupReport(getSupabaseAdmin(), period);
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "สร้างรายงานไม่สำเร็จ" }, { status: 500 });
  }
}
