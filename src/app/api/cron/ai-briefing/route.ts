import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateDeptBriefing, loadExpert } from "@/lib/dept-data";
import { callClaudeJSON, ANTHROPIC_ENABLED } from "@/lib/claude";
import { EXPERT_DEPTS, DEPT_LABEL, type DeptBriefing } from "@/lib/ai-experts";

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
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ANTHROPIC_ENABLED) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });

  const db = admin();
  const period = req.nextUrl.searchParams.get("period") === "monthly" ? "monthly" : "weekly";

  const deptSummaries: string[] = [];
  const results: Record<string, string> = {};

  for (const dept of EXPERT_DEPTS) {
    const expert = await loadExpert(db, dept);
    if (!expert.is_active) { results[dept] = "skipped (inactive)"; continue; }
    const { briefing, error } = await generateDeptBriefing(db, dept, period, "cron");
    if (briefing) {
      results[dept] = "ok";
      deptSummaries.push(`[${DEPT_LABEL[dept]}] ${briefing.title}: ${briefing.summary}`);
    } else {
      results[dept] = `error: ${error ?? "unknown"}`;
    }
  }

  // สรุปรวมเสนอผู้บริหาร
  let execOk = false;
  if (deptSummaries.length > 0) {
    const { data: exec, model } = await callClaudeJSON<DeptBriefing>({
      system:
        `คุณคือ "ที่ปรึกษา AI ของผู้บริหาร" โครงการอสังหาฯ AVIVA ONE ` +
        `รับบรีฟจากผู้เชี่ยวชาญแต่ละฝ่ายมาสังเคราะห์เป็นภาพรวมเชิงกลยุทธ์สำหรับผู้บริหาร ` +
        `ชี้เรื่องข้ามฝ่ายที่ต้องตัดสินใจ ความเสี่ยง และโอกาส ตอบภาษาไทย กระชับ\n` +
        `ตอบ JSON: {"title","summary","highlights":[{"title","detail","priority","action"}],"weekly_plan":[{"label","task","why"}],"monthly_plan":[{"label","task","why"}]}`,
      user: `บรีฟจากแต่ละฝ่ายสัปดาห์นี้:\n${deptSummaries.join("\n")}\n\nสรุปภาพรวมเสนอผู้บริหาร`,
    });
    if (exec) {
      await db.from("ai_briefings").insert({
        project_id: PROJECT_ID, scope: "executive", dept: null, period_type: period,
        title: exec.title ?? "สรุปเสนอผู้บริหาร", summary: exec.summary ?? "",
        highlights: exec.highlights ?? [], weekly_plan: exec.weekly_plan ?? [],
        monthly_plan: exec.monthly_plan ?? [], raw: exec, model, generated_by: "cron",
      });
      execOk = true;
    }
  }

  return NextResponse.json({ ok: true, period, depts: results, executive: execOk });
}
