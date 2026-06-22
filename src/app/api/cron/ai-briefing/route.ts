import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateDeptBriefing, generateExecutiveBriefing, loadExpert } from "@/lib/dept-data";
import { anthropicEnabled } from "@/lib/claude";
import { EXPERT_DEPTS } from "@/lib/ai-experts";

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

// Cron: สร้างบรีฟประจำสัปดาห์/เดือนของทุกฝ่ายอัตโนมัติ + สรุปรวมเสนอผู้บริหาร
// (Phase 2 seed — ผู้เชี่ยวชาญแต่ละฝ่ายสร้างบรีฟ แล้ว "ที่ปรึกษา AI" สังเคราะห์รวมให้ผู้บริหาร)
export async function GET(req: NextRequest) {
  try {
    if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!(await anthropicEnabled())) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });

    const db = admin();
    const period = req.nextUrl.searchParams.get("period") === "monthly" ? "monthly" : "weekly";

    const results: Record<string, string> = {};
    for (const dept of EXPERT_DEPTS) {
      try {
        const expert = await loadExpert(db, dept);
        if (!expert.is_active) { results[dept] = "skipped (inactive)"; continue; }
        const { briefing, error } = await generateDeptBriefing(db, dept, period, "cron");
        results[dept] = briefing ? "ok" : `error: ${error ?? "unknown"}`;
      } catch (deptErr: any) {
        results[dept] = `failed: ${deptErr?.message ?? "unknown"}`;
      }
    }

    // สภา AI: สังเคราะห์รวมเสนอผู้บริหาร + แจ้งเตือน
    try {
      const { briefing: exec } = await generateExecutiveBriefing(db, period, "cron");
      if (exec) {
        const { error } = await db.from("notifications").insert({
          project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร",
          title: `บรีฟผู้บริหาร${period === "monthly" ? "รายเดือน" : "รายสัปดาห์"}พร้อมแล้ว`,
          message: exec.title ?? "สภา AI สรุปภาพรวมเสนอผู้บริหาร", is_read: false,
        });
        if (error) results.executive = `error: ${error.message}`;
        else results.executive = "ok";
      }
    } catch (execErr: any) {
      results.executive = `failed: ${execErr?.message ?? "unknown"}`;
    }

    return NextResponse.json({ ok: true, period, depts: results });
  } catch (err: any) {
    return NextResponse.json({ error: `cron failed: ${err?.message ?? "unknown"}` }, { status: 500 });
  }
}
