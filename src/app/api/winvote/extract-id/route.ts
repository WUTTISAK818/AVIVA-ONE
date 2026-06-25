import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  rateLimitMap.set(ip, [...recent, now]);
  return true;
}

const EXTRACT_PROMPT = `คุณคือระบบอ่านข้อมูลจากบัตรประชาชนไทย (Thai national ID card)
อ่านข้อความจากรูปภาพบัตร แล้วตอบกลับเป็น JSON object เท่านั้น ตาม schema นี้:
{
  "national_id": "เลขประจำตัวประชาชน 13 หลัก เฉพาะตัวเลขไม่มีช่องว่างหรือขีด",
  "full_name": "ชื่อ-นามสกุลภาษาไทย รวมคำนำหน้า เช่น นาย/นาง/นางสาว",
  "date_of_birth": "วันเกิดรูปแบบ YYYY-MM-DD (ค.ศ.) แปลงจากปี พ.ศ. ให้เป็น ค.ศ. โดยลบ 543",
  "gender": "male หรือ female หรือ other (เดาจากคำนำหน้าชื่อถ้าไม่มีระบุ)",
  "address": "ที่อยู่ตามบัตรเต็มรูปแบบ"
}
ถ้าอ่านฟิลด์ใดไม่ได้ ให้ใส่ค่าเป็น null ห้ามแต่งข้อมูลขึ้นเอง`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  // ต้องล็อกอิน
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image } = await req.json();
  if (!image) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OCR ไม่พร้อมใช้งาน (ไม่ได้ตั้งค่า OPENAI_API_KEY) กรุณากรอกข้อมูลด้วยตนเอง" },
      { status: 503 }
    );
  }

  // รูปแบบ data URL: data:image/jpeg;base64,xxx  (รับทั้งแบบมี/ไม่มี prefix)
  const imageUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 600,
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "อ่านข้อมูลจากบัตรนี้และตอบเป็น JSON" },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: "บริการอ่านบัตรขัดข้องชั่วคราว กรุณาลองใหม่หรือกรอกเอง" }, { status: 502 });
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "ไม่สามารถอ่านข้อมูลจากบัตรได้ กรุณาถ่ายใหม่หรือกรอกเอง" }, { status: 422 });
    }
    let fields;
    try {
      fields = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "ผลลัพธ์ไม่ถูกต้อง กรุณาลองใหม่" }, { status: 422 });
    }
    // ไม่เก็บรูปบัตร — ส่งคืนเฉพาะข้อความที่อ่านได้
    return NextResponse.json({ fields });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการอ่านบัตร กรุณาลองใหม่" }, { status: 500 });
  }
}
