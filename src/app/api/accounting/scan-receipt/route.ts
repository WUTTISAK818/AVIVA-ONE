import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/app-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// หมวดบัญชีมาตรฐานของ AVIVA — ให้ AI จัดประเภทให้ตรง
const CATEGORIES = [
  "ค่าวัสดุก่อสร้าง", "ค่าแรง/ค่าจ้างผู้รับเหมา", "ค่าการตลาด/โฆษณา",
  "ค่าสาธารณูปโภค (น้ำ/ไฟ/เน็ต)", "เงินเดือน/สวัสดิการ", "ค่าใช้จ่ายสำนักงาน",
  "ค่าธรรมเนียม/ภาษี", "รับชำระงวด/เงินดาวน์", "รายได้จากการขาย", "อื่นๆ",
];

interface ScanResult {
  transaction_type: "income" | "expense";
  amount: number;
  date: string | null;
  vendor_name: string | null;
  category: string;
  description: string;
  confidence: "high" | "medium" | "low";
}

/**
 * สแกนใบเสร็จ/สลิปโอนเงิน → ดึงข้อมูลด้วย Claude Vision → จัดหมวดบัญชีอัตโนมัติ
 * รับ: { imageBase64 (raw base64 ไม่มี prefix), mediaType }  | ต้องแนบ Bearer token ผู้ใช้
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { imageBase64?: string; mediaType?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const { imageBase64, mediaType } = body;
  if (!imageBase64) return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });

  const apiKey = await getSetting("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY, token);
  if (!apiKey) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, { status: 503 });

  const system = `คุณเป็นนักบัญชีผู้เชี่ยวชาญของบริษัทอสังหาริมทรัพย์ไทย หน้าที่: อ่านรูปใบเสร็จ/สลิปโอนเงิน/บิล แล้วดึงข้อมูลการเงินออกมาให้ถูกต้อง และจัดประเภทบัญชี
หมวดบัญชีที่อนุญาต (เลือกหนึ่งที่ตรงที่สุด): ${CATEGORIES.join(", ")}
กฎ:
- transaction_type: "income" ถ้าเป็นเงินรับเข้า (สลิปโอนเข้า/รับชำระ), "expense" ถ้าเป็นรายจ่าย (ใบเสร็จซื้อของ/บิล)
- amount: ยอดเงินรวมสุทธิเป็นตัวเลขล้วน (ไม่มีคอมมา ไม่มีสัญลักษณ์)
- date: วันที่ในเอกสารรูปแบบ YYYY-MM-DD (แปลง พ.ศ.->ค.ศ. ถ้าจำเป็น) ถ้าไม่พบให้เป็น null
- vendor_name: ชื่อร้าน/ผู้รับเงิน/คู่ค้า ถ้าไม่พบให้ null
- description: สรุปสั้นๆว่าเป็นค่าอะไร
- confidence: ความมั่นใจในการอ่าน (high/medium/low)
ตอบเป็น JSON เดียวเท่านั้น: {"transaction_type","amount","date","vendor_name","category","description","confidence"}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        system,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
            { type: "text", text: "อ่านเอกสารนี้แล้วดึงข้อมูลบัญชีออกมาเป็น JSON ตามรูปแบบที่กำหนด" },
          ],
        }],
      }),
    });
    clearTimeout(timeout);
    const json = await res.json();
    if (!res.ok) return NextResponse.json({ error: json?.error?.message || `HTTP ${res.status}` }, { status: 502 });
    const text: string = (json.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: ScanResult | null = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
      if (s >= 0 && e > s) { try { parsed = JSON.parse(cleaned.slice(s, e + 1)); } catch { parsed = null; } }
    }
    if (!parsed || typeof parsed.amount !== "number") return NextResponse.json({ error: "อ่านเอกสารไม่สำเร็จ ลองถ่ายใหม่ให้ชัดขึ้น" }, { status: 422 });
    if (!CATEGORIES.includes(parsed.category)) parsed.category = "อื่นๆ";
    return NextResponse.json({ ok: true, result: parsed });
  } catch (err) {
    clearTimeout(timeout);
    return NextResponse.json({ error: err instanceof Error ? err.message : "UNKNOWN" }, { status: 500 });
  }
}
