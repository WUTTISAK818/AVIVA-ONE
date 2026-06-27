import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { anthropicEnabled, callClaudeJSON } from "@/lib/claude";
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
const VALID_CAT = new Set(["activity", "achievement", "issue", "plan"]);

interface DraftItem { category: string; description: string }
interface DraftOut { items: DraftItem[]; note?: string }

// AI "ร่างโครงรายงาน" ให้พนักงาน — จัดงานจริงที่ทำระหว่างวันเป็นรายงานที่ครบโครงสร้าง
// เป้าหมาย: แก้ปัญหา "ทำเยอะ ส่งน้อย" — AI ทำหัวข้อ + เติมจากข้อมูลจริง + เว้นช่อง [____] ให้กรอกเอง
// กฎเหล็ก: ไม่แต่งข้อมูล/ตัวเลขที่ไม่มี — ที่ไม่รู้ให้เป็นช่องว่าง
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let reportId = "";
  try {
    const body = await req.json();
    reportId = String(body.reportId ?? "");
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
    .select("id, employee_name, department, report_date, summary")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });

  // งานจริงที่บันทึกไว้ระหว่างวัน (auto-pull ดึงมาแล้วฝั่ง client) + คำบรรยายรูป
  const { data: items } = await db
    .from("work_report_items")
    .select("category, description")
    .eq("report_id", reportId)
    .order("created_at");
  const { data: atts } = await db
    .from("work_report_attachments")
    .select("caption")
    .eq("report_id", reportId);

  const rawLines = (items ?? [])
    .map((i: { category: string; description: string }) => `- [${CAT_LABEL[i.category] ?? i.category}] ${i.description}`)
    .join("\n");
  const captions = (atts ?? [])
    .map((a: { caption: string | null }) => a.caption?.trim())
    .filter(Boolean) as string[];
  const photoCount = (atts ?? []).length;

  const system =
    "คุณเป็นผู้ช่วยจัดทำ 'ร่างรายงานการปฏิบัติงานประจำวัน' ให้พนักงาน เพื่อให้รายงานครบถ้วน " +
    "ผู้บริหารเห็นภาพงานทั้งหมด (แก้ปัญหาพนักงานทำงานเยอะแต่บันทึกน้อย)\n" +
    "หลักการ:\n" +
    "1) จัดงานจริงที่ให้มาเป็นหัวข้อที่ชัดเจน เหมาะกับฝ่ายและปริมาณงาน (ก่อสร้าง=แยกตามหลัง/แปลง+ความคืบหน้า, ขาย=ตามลูกค้า/ดีล/การติดต่อ)\n" +
    "2) เติมรายละเอียด 'เฉพาะจากข้อมูลที่ให้มา' เท่านั้น — ห้ามแต่งตัวเลข/ข้อเท็จจริงที่ไม่มี\n" +
    "3) ส่วนที่ข้อมูลขาดแต่สำคัญ ให้ใส่ช่องว่าง '[____]' พร้อมคำใบ้สั้น ๆ เช่น '[ระบุ % ความคืบหน้า]' '[เหลือกี่จุด]' '[ผลการติดต่อ]'\n" +
    "4) เพิ่มหัวข้อที่มักถูกลืมเป็นช่องว่างเสมอ: หมวด issue ('ปัญหา/อุปสรรควันนี้: [____]') และ plan ('แผนพรุ่งนี้: [____]') ถ้ายังไม่มี\n" +
    "5) ถ้ามีรูปแต่ไม่มีคำบรรยาย ให้เตือนในช่องว่างว่าควรระบุรูปคืออะไร\n" +
    `ตอบเป็น JSON: {"items":[{"category":"activity|achievement|issue|plan","description":"..."}],"note":"คำแนะนำสั้นๆ ให้พนักงาน 1 ประโยค"} ` +
    "category ต้องเป็นหนึ่งใน activity/achievement/issue/plan เท่านั้น";

  const userMsg =
    `พนักงาน: ${report.employee_name} · ฝ่าย: ${report.department} · วันที่: ${report.report_date}\n` +
    `จำนวนรูปที่แนบ: ${photoCount}${captions.length ? ` (คำบรรยาย: ${captions.join(" · ")})` : " (ยังไม่มีคำบรรยาย)"}\n` +
    `สรุปที่พนักงานเขียนไว้: ${(report.summary ?? "").trim() || "(ยังไม่มี)"}\n` +
    `งานจริงที่บันทึกระหว่างวัน:\n${rawLines || "(ยังไม่มีรายการ — ช่วยสร้างโครงรายงานเปล่าตามฝ่ายให้กรอก)"}`;

  const { data, model, error } = await callClaudeJSON<DraftOut>({
    system,
    user: userMsg,
    model: "claude-opus-4-8",
    maxTokens: 1500,
    accessToken: token,
  });

  if (!data || !Array.isArray(data.items)) {
    return NextResponse.json({ error: error ?? "ร่างรายงานไม่สำเร็จ" }, { status: 502 });
  }

  // กรองให้เหลือเฉพาะรายการที่ถูกต้อง (กัน category เพี้ยน)
  const cleanItems = data.items
    .filter(it => it && typeof it.description === "string" && it.description.trim())
    .map(it => ({
      category: VALID_CAT.has(it.category) ? it.category : "activity",
      description: it.description.trim(),
    }))
    .slice(0, 30);

  return NextResponse.json({ items: cleanItems, note: data.note ?? "", model });
}
