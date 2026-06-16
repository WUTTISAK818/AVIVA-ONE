import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaudeText, anthropicEnabled } from "@/lib/claude";
import { serverDb } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// แยกเจตนาสำหรับ "Action Mode" ของน้อง Viva
// รองรับ: create_pr (ขอซื้อ) · create_claim (แจ้งซ่อม) · create_leave (ขอลา)
// คืน JSON เท่านั้น — การสร้างจริงทำฝั่ง client หลังผู้ใช้กดยืนยัน (ใช้ RLS ของผู้ใช้เอง)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PR_CATEGORIES = ["ฟิล์มกรองแสง/ตกแต่งสำนักงาน", "อุปกรณ์สำนักงาน", "ไอที/คอมพิวเตอร์", "ซ่อมบำรุง", "การตลาด/สื่อ", "อื่น ๆ"];
const ISSUE_TYPES = ["โครงสร้าง", "ระบบไฟฟ้า", "ระบบประปา", "หลังคา/รางน้ำ", "ประตู/หน้าต่าง", "พื้น/กระเบื้อง", "สี/ผนัง", "อื่นๆ"];
const LEAVE_TYPES = ["ลาพักร้อน", "ลาป่วย", "ลากิจ", "ลาครอบครัว", "ลาอื่นๆ"];

type Intent = "create_pr" | "create_claim" | "create_leave" | "none";

interface ActionResult {
  intent: Intent;
  ready: boolean;
  reply: string;
  pr?: { item: string; amount: number | null; category: string; reason: string | null };
  claim?: { customerName: string; houseNumber: string | null; issueType: string; description: string; assignedTo: string | null; scheduledDate: string | null; estimatedCompletionDate: string | null };
  leave?: { employeeName: string; leaveType: string; dateFrom: string | null; dateTo: string | null; reason: string | null };
}

const NONE: ActionResult = { intent: "none", ready: false, reply: "" };

const todayTh = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];

// heuristic สำรอง (เมื่อยังไม่ตั้ง Claude key) — รองรับเฉพาะ create_pr แบบง่าย
function heuristic(message: string): ActionResult {
  const m = message.toLowerCase();
  const isHowTo = /(ทำยังไง|ทำอย่างไร|เริ่มที่ไหน|ขั้นตอน|how|วิธี)/.test(m);
  if (isHowTo) return NONE;
  if (!/(ซื้อ|จัดซื้อ|สั่งซื้อ|ขอซื้อ)/.test(m)) return NONE;
  const numMatch = message.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|พัน|หมื่น)?/i);
  let amount: number | null = null;
  if (numMatch) {
    let n = parseFloat(numMatch[1]);
    const unit = (numMatch[2] ?? "").toLowerCase();
    if (unit === "k" || unit === "พัน") n *= 1000; else if (unit === "หมื่น") n *= 10000;
    if (n > 0) amount = n;
  }
  const ready = amount != null && amount > 0;
  return {
    intent: "create_pr", ready, reply: ready ? "ยืนยันสร้างคำขอซื้อตามรายละเอียดนี้ไหมคะ" : "ได้ค่ะ ขอทราบราคาประมาณ (บาท) ของรายการนี้หน่อยค่ะ",
    pr: { item: message.trim(), amount, category: "อื่น ๆ", reason: null },
  };
}

function buildSystem(userName: string): string {
  return `คุณคือตัวแยกเจตนาของผู้ช่วย "น้อง Viva" ในแอป AVIVA ONE
ผู้ใช้ปัจจุบันชื่อ: ${userName}
วันที่วันนี้ (เวลาไทย): ${todayTh()}

ดูข้อความพนักงานว่ากำลัง "สั่งให้ Viva ทำงานแทน" อย่างใดอย่างหนึ่งหรือไม่:
1) create_pr  = สั่งซื้อ/เปิดคำขอซื้อของ
2) create_claim = แจ้งซ่อม/เปิดเคลมประกันให้ลูกค้า
3) create_leave = ขอลา/ยื่นใบลา

ตอบกลับเป็น JSON อย่างเดียว (ห้ามมีข้อความนอก JSON) ตาม schema:
{"intent":"create_pr"|"create_claim"|"create_leave"|"none","ready":boolean,"reply":string,
 "pr":{"item":string,"amount":number|null,"category":string,"reason":string|null},
 "claim":{"customerName":string,"houseNumber":string|null,"issueType":string,"description":string,"assignedTo":string|null,"scheduledDate":string|null,"estimatedCompletionDate":string|null},
 "leave":{"employeeName":string,"leaveType":string,"dateFrom":string|null,"dateTo":string|null,"reason":string|null}}
ใส่เฉพาะ object ของ intent ที่ตรง (อันอื่นไม่ต้องใส่ก็ได้)

กติกาสำคัญ:
- intent ตรงเฉพาะเมื่อผู้ใช้ "สั่งให้ทำ" เช่น "ซื้อมือถือให้ฝ่ายขาย", "แจ้งซ่อมหลังคารั่วบ้านคุณสมชาย", "ขอลาพักร้อนพรุ่งนี้"
- ถ้าผู้ใช้แค่ "ถามวิธี/ขั้นตอน" (เช่น "ขอลายังไง", "แจ้งซ่อมเริ่มที่ไหน") ให้ intent="none" (ปล่อยให้ระบบตอบแบบแนะนำ)
- วันที่ทุกช่องเป็นรูปแบบ YYYY-MM-DD; แปลงคำเช่น "พรุ่งนี้/วันจันทร์/18-19 มิย" เป็นวันที่จริงโดยอ้างวันนี้ด้านบน
- create_pr: category เลือกจาก [${PR_CATEGORIES.join(" | ")}]; ready=true เมื่อมี item และ amount>0; ถ้าไม่มี amount → ready=false, reply=ถามราคาประมาณ
- create_claim: issueType เลือกจาก [${ISSUE_TYPES.join(" | ")}]; ready=true เมื่อมี customerName และ description; ถ้าขาด → ready=false, reply=ถามข้อมูลที่ขาด (เช่น ชื่อลูกค้า/อาการ)
- create_leave: leaveType เลือกจาก [${LEAVE_TYPES.join(" | ")}]; ถ้าผู้ใช้ลาเอง employeeName = "${userName}"; ready=true เมื่อมี employeeName, dateFrom, dateTo; ถ้าขาดวัน → ready=false, reply=ถามช่วงวันลา
- เมื่อ ready=true → reply = สรุปสั้น ๆ ว่าจะทำรายการให้ (ผู้ใช้จะเห็นปุ่มยืนยันต่อ)
- intent="none" → ready=false, reply=""
- ใช้ประวัติสนทนาเติมข้อมูลที่ผู้ใช้ทยอยบอก`;
}

function num(v: unknown): number | null { return typeof v === "number" && v > 0 ? v : null; }
function str(v: unknown): string { return typeof v === "string" ? v : ""; }
function strN(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : null; }

function parse(text: string): ActionResult | null {
  try {
    const s = text.indexOf("{"); const e = text.lastIndexOf("}");
    if (s < 0 || e < 0) return null;
    const o = JSON.parse(text.slice(s, e + 1));
    const intent: Intent = ["create_pr", "create_claim", "create_leave", "none"].includes(o.intent) ? o.intent : "none";
    const reply = str(o.reply);
    if (intent === "create_pr") {
      const pr = o.pr ?? {};
      const amount = num(pr.amount);
      return { intent, ready: !!o.ready && !!str(pr.item).trim() && amount != null, reply,
        pr: { item: str(pr.item).trim(), amount, category: str(pr.category) || "อื่น ๆ", reason: strN(pr.reason) } };
    }
    if (intent === "create_claim") {
      const c = o.claim ?? {};
      const customerName = str(c.customerName).trim();
      const description = str(c.description).trim();
      return { intent, ready: !!o.ready && !!customerName && !!description, reply,
        claim: { customerName, houseNumber: strN(c.houseNumber), issueType: str(c.issueType) || "อื่นๆ", description, assignedTo: strN(c.assignedTo), scheduledDate: strN(c.scheduledDate), estimatedCompletionDate: strN(c.estimatedCompletionDate) } };
    }
    if (intent === "create_leave") {
      const l = o.leave ?? {};
      const employeeName = str(l.employeeName).trim();
      const dateFrom = strN(l.dateFrom); const dateTo = strN(l.dateTo);
      return { intent, ready: !!o.ready && !!employeeName && !!dateFrom && !!dateTo, reply,
        leave: { employeeName, leaveType: str(l.leaveType) || "ลาอื่นๆ", dateFrom, dateTo, reason: strN(l.reason) } };
    }
    return { intent: "none", ready: false, reply: "" };
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let message = "";
  let history: { role: string; content: string }[] = [];
  try {
    const body = await req.json();
    message = body.message;
    if (Array.isArray(body.history)) history = body.history.slice(-6);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || !message.trim() || message.length > 2000) {
    return NextResponse.json({ error: "No message" }, { status: 400 });
  }

  if (!(await anthropicEnabled(token))) {
    return NextResponse.json(heuristic(message));
  }

  let userName = "พนักงาน";
  try {
    const { data: dbUser } = await serverDb(token).from("users").select("full_name").eq("id", user.id).single();
    if (dbUser?.full_name) userName = dbUser.full_name;
  } catch { /* default */ }

  const msgs = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" as const : "user" as const, content: h.content })),
    { role: "user" as const, content: message },
  ];
  const { text } = await callClaudeText({
    system: buildSystem(userName),
    messages: msgs,
    model: "claude-haiku-4-5",
    maxTokens: 400,
    timeoutMs: 20_000,
    accessToken: token,
  });

  return NextResponse.json((text ? parse(text) : null) ?? heuristic(message));
}
