import { NextRequest, NextResponse } from "next/server";
import { calculateMonthlyPayroll, calculateAllForMonth, getMonthlyPayrollSummary } from "@/lib/attendance-service";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, error } = await verifyAuth(req, ["manager"]);
  if (error || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });

  try {
    const { month, year, employee_id, action } = await req.json();
    if (!month || !year) {
      return NextResponse.json({ error: "month and year are required" }, { status: 400 });
    }

    // action='calculate' → คำนวณจริง (upsert) · ไม่ระบุ → ดูสรุปที่มีอยู่ (read-only)
    if (action === "calculate") {
      if (employee_id) {
        const result = await calculateMonthlyPayroll({ month, year, employee_id });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      } else {
        const bulk = await calculateAllForMonth(year, month);
        if (!bulk.ok) return NextResponse.json({ error: bulk.error }, { status: 400 });
        return NextResponse.json({ success: true, data: bulk.data, details: bulk.details });
      }
    }

    const summary = await getMonthlyPayrollSummary(year, month);
    if (!summary.ok) return NextResponse.json({ error: summary.error }, { status: 400 });
    return NextResponse.json({ success: true, data: summary.data, details: summary.details });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
