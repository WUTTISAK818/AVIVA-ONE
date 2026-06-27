import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { anthropicEnabled, callClaudeText } from "@/lib/claude";
import { serverDb } from "@/lib/server-db";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CAT_LABEL: Record<string, string> = {
  activity: "กิจกรรม",
  achievement: "ผลสำเร็จ",
  issue: "ปัญหา/อุปสรรค",
  plan: "แผนงานพรุ่งนี้",
};

// AI TL;DR ต่อรายงานประจำวัน — สรุปให้ผู้บริหารอ่านเร็ว (ใช้ Haiku + cache ใน DB คุมค่าใช้จ่าย)
// สรุป "จากเนื้อหาที่พนักงานส่งเท่านั้น" ไม่แต่งเติม — กัน hallucination
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let reportId = "";
  let force = false;
  try {
    const body = await req.json();
    reportId = String(body.reportId ?? "");
    force = body.force === true;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!reportId) return NextResponse.json({ error: "reportId required" }, { status: 400 });

  if (!(await anthropicEnabled(token))) {
    return NextResponse.json(
      { error: "AI ยังไม่พร้อมใช้งาน — ตั้งค่า API key ที่ ตั้งค่า → ผู้เชี่ยวชาญ AI ก่อนค่ะ" },
      { status: 503 },
    );
  }

  const db = serverDb(token);

  const { data: report } = await db
    .from("work_reports")
    .select("id, employee_name, department, report_date, summary, updated_at, ai_summary, ai_summary_at")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });

  // คืน cache ถ้ามีและรายงานไม่เปลี่ยนหลังสรุป (กันเรียกซ้ำสิ้นเปลือง)
  const fresh = report.ai_summary && report.ai_summary_at &&
    new Date(report.ai_summary_at).getTime() >= new Date(report.updated_at ?? 0).getTime();
  if (report.ai_summary && fresh && !force) {
    return NextResponse.json({ summary: report.ai_summary, cached: true });
  }

  const { data: items } = await db
    .from("work_report_items")
    .select("category, description")
    .eq("report_id", reportId)
    .order("created_at");

  const { data: atts } = await db
    .from("work_report_attachments")
    .select("caption")
    .eq("report_id", reportId);

  const itemLines = (items ?? [])
    .map((i: { category: string; description: string }) => `- [${CAT_LABEL[i.category] ?? i.category}] ${i.description}`)
    .join("\n");
  const captions = (atts ?? [])
    .map((a: { caption: string | null }) => a.caption?.trim())
    .filter(Boolean);
  const photoLine = captions.length
    ? `\nรูปประกอบ (${captions.length} รูป): ${captions.join(" · ")}`
    : `\nรูปประกอบ: ${(atts ?? []).length} รูป (ไม่มีคำบรรยาย)`;

  // ไม่มีเนื้อหาให้สรุป — ไม่เรียก AI สิ้นเปลือง
  if (!itemLines && !(report.summary ?? "").trim()) {
    return NextResponse.json({ summary: "", empty: true });
  }

  const system =
    "คุณเป็นผู้ช่วยสรุปรายงานการปฏิบัติงานประจำวันของพนักงาน ให้ผู้บริหารอ่านเข้าใจเร็วที่สุด " +
    "กฎเหล็ก: สรุป 'เฉพาะจากเนื้อหาที่ให้มา' เท่านั้น ห้ามเดา ห้ามเติมข้อมูลที่ไม่มี ห้ามแต่งตัวเลข " +
    "ตอบเป็นภาษาไทย กระชับ รูปแบบ:\n" +
    "บรรทัดแรก: ภาพรวม 1 ประโยคว่าวันนี้ทำอะไรหลัก ๆ\n" +
    "ตามด้วย bullet เฉพาะที่มีจริง: '✅ ผลสำเร็จ:' / '⚠️ ต้องติดตาม:' (ปัญหา/ค้าง) / '📌 แผนพรุ่งนี้:' " +
    "ถ้าหมวดไหนไม่มีข้อมูลให้ข้ามไป ห้ามใส่หัวข้อเปล่า ความยาวรวมไม่เกิน 5 บรรทัด ห้ามมีคำนำ/คำต่อท้าย";

  const userMsg =
    `พนักงาน: ${report.employee_name} (${report.department})\n` +
    `วันที่: ${report.report_date}\n` +
    `สรุปที่พนักงานเขียน: ${(report.summary ?? "").trim() || "(ไม่มี)"}\n` +
    `รายการงาน:\n${itemLines || "(ไม่มี)"}` +
    photoLine;

  const { text, model, error } = await callClaudeText({
    system,
    messages: [{ role: "user", content: userMsg }],
    model: "claude-haiku-4-5",
    maxTokens: 500,
    accessToken: token,
  });

  if (!text) {
    return NextResponse.json({ error: error ?? "สรุปไม่สำเร็จ" }, { status: 502 });
  }

  // เก็บ cache (best-effort — ถ้าเขียนไม่ได้ก็ยังคืนผลให้ผู้ใช้)
  await db.from("work_reports")
    .update({ ai_summary: text, ai_summary_at: new Date().toISOString() })
    .eq("id", reportId);

  return NextResponse.json({ summary: text, model, cached: false });
}
