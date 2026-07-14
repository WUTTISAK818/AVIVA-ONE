import { NextRequest, NextResponse } from "next/server";
import { approvePayroll } from "@/lib/attendance-service";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, error } = await verifyAuth(req, ["manager"]);
  if (error || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  try {
    const { payroll_id } = await req.json();
    if (!payroll_id) return NextResponse.json({ error: "payroll_id is required" }, { status: 400 });
    const result = await approvePayroll(payroll_id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
