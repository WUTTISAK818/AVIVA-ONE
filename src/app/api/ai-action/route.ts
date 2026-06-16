import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaudeText, anthropicEnabled } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// แยกเจตนาของผู้ใช้สำหรับ "Action Mode" ของน้อง Viva
// ปัจจุบันรองรับ action เดียว: create_pr (สร้างคำขอซื้อแทน)
// คืน JSON เท่านั้น — การ "สร้างจริง" ทำฝั่ง client หลังผู้ใช้กดยืนยัน (ใช้สิทธิ์/RLS ของผู้ใช้เอง)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PR_CATEGORIES = [
  "ฟิล์มกรองแสง/ตกแต่งสำนักงาน",
  "อุปกรณ์สำนักงาน",
  "ไอที/คอมพิวเตอร์",
  "ซ่อมบำรุง",
  "การตลาด/สื่อ",
  "อื่น ๆ",
];

interface ActionResult {
  intent: "create_pr" | "none";
  ready: boolean;
  item: string;
  amount: number | null;
  category: string;
  reason: string | null;
  reply: string;
}

const NONE: ActionResult = { intent: "none", ready: false, item: "", amount: null, category: "อื่น ๆ", reason: null, reply: "" };

// heuristic สำรอง (เมื่อยังไม่ได้ตั้ง Claude key) — ตรวจคำสั่งซื้อแบบง่าย
function heuristic(message: string): ActionResult {
  const m = message.toLowerCase();
  const isHowTo = /(ทำยังไง|ทำอย่างไร|เริ่มที่ไหน|ขั้นตอน|how|วิธี)/.test(m);
  const isBuyCmd = /(ซื้อ|จัดซื้อ|สั่งซื้อ|ขอซื้อ)/.test(m) && !isHowTo;
  if (!isBuyCmd) return NONE;
  // ดึงตัวเลขราคา (รองรับ 9,000 / 9000 / 9k บาท)
  const numMatch = message.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|พัน|หมื่น)?/i);
  let amount: number | null = null;
  if (numMatch) {
    let n = parseFloat(numMatch[1]);
    const unit = (numMatch[2] ?? "").toLowerCase();
    if (unit === "k" || unit === "พัน") n *= 1000;
    else if (unit === "หมื่น") n *= 10000;
    if (n > 0) amount = n;
  }
  const ready = amount != null && amount > 0;
  return {
    intent: "create_pr", ready,
    item: message.trim(), amount, category: "อื่น ๆ", reason: null,
    reply: ready ? "ยืนยันสร้างคำขอซื้อตามรายละเอียดนี้ไหมคะ" : "ได้ค่ะ ขอทราบราคาประมาณ (บาท) ของรายการนี้หน่อยค่ะ",
  };
}

const SYSTEM = `คุณคือตัวแยกเจตนาของผู้ช่วย "น้อง Viva" ในแอป AVIVA ONE
หน้าที่: ดูข้อความพนักงานว่ากำลัง "สั่งให้ Viva สร้างคำขอซื้อ (Purchase Request) แทน" หรือไม่

ตอบกลับเป็น JSON อย่างเดียว (ห้ามมีข้อความอื่นนอก JSON) ตาม schema นี้:
{"intent":"create_pr"|"none","ready":boolean,"item":string,"amount":number|null,"category":string,"reason":string|null,"reply":string}

กติกา:
- intent="create_pr" เฉพาะเมื่อผู้ใช้ "สั่งให้ทำ/ให้ซื้อ/ให้เปิดคำขอ" เช่น "ซื้อมือถือให้ฝ่ายขาย", "เปิดคำขอซื้อปริ้นเตอร์", "วีว่าจัดซื้อโต๊ะให้หน่อย"
- ถ้าผู้ใช้แค่ "ถามวิธี/ขั้นตอน" (เช่น "ขอซื้อมือถือเริ่มที่ไหน", "ขออนุมัติซื้อของทำยังไง") ให้ intent="none" (ปล่อยให้ระบบตอบแบบแนะนำวิธีแทน)
- item = ชื่อสิ่งที่จะซื้อแบบสั้น กระชับ (เช่น "โทรศัพท์มือถือ (ฝ่ายขาย)")
- amount = ราคาประมาณเป็นตัวเลขบาท ถ้าผู้ใช้ยังไม่บอก ให้ null
- category = เลือกจากรายการนี้เท่านั้น: ${PR_CATEGORIES.join(" | ")}
- reason = เหตุผล/แผนกที่ใช้งาน ถ้ามี ไม่งั้น null
- ready = true เมื่อมี item ชัดเจน "และ" amount เป็นตัวเลข > 0
- ถ้า intent="create_pr" แต่ยังไม่มี amount → ready=false, reply = ถามราคาประมาณอย่างสุภาพ (ลงท้าย "ค่ะ")
- ถ้า intent="create_pr" และ ready=true → reply = สรุปสั้น ๆ ว่าจะสร้างคำขอ (ผู้ใช้จะเห็นปุ่มยืนยันต่อ)
- ถ้า intent="none" → ready=false, reply="" (string ว่าง)
- ใช้ประวัติสนทนาเติมข้อมูลที่ขาด เช่น ผู้ใช้บอกชื่อของก่อน แล้วบอกราคาทีหลัง ให้รวมเป็นคำขอเดียว`;

function parseJson(text: string): ActionResult | null {
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s < 0 || e < 0) return null;
    const obj = JSON.parse(text.slice(s, e + 1));
    if (obj.intent !== "create_pr" && obj.intent !== "none") return null;
    return {
      intent: obj.intent,
      ready: !!obj.ready && typeof obj.amount === "number" && obj.amount > 0,
      item: typeof obj.item === "string" ? obj.item : "",
      amount: typeof obj.amount === "number" && obj.amount > 0 ? obj.amount : null,
      category: typeof obj.category === "string" ? obj.category : "อื่น ๆ",
      reason: typeof obj.reason === "string" && obj.reason.trim() ? obj.reason.trim() : null,
      reply: typeof obj.reply === "string" ? obj.reply : "",
    };
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

  // ยังไม่ได้ตั้ง Claude → ใช้ heuristic
  if (!(await anthropicEnabled(token))) {
    return NextResponse.json(heuristic(message));
  }

  const msgs = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" as const : "user" as const, content: h.content })),
    { role: "user" as const, content: message },
  ];
  const { text } = await callClaudeText({
    system: SYSTEM,
    messages: msgs,
    model: "claude-haiku-4-5",
    maxTokens: 300,
    timeoutMs: 20_000,
    accessToken: token,
  });

  const parsed = text ? parseJson(text) : null;
  return NextResponse.json(parsed ?? heuristic(message));
}
