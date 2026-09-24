import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ทำงานฝั่งเซิร์ฟเวอร์เท่านั้น — เลข ปชช. ถูกแปลงเป็น HMAC ด้วย "pepper" ที่เป็นความลับ
// แล้วส่งกลับเฉพาะค่า hash (ไม่เก็บเลขจริง ไม่ log) — pepper ไม่หลุดไปฝั่งเบราว์เซอร์
// แนะนำ: ตั้งค่า WINVOTE_ID_PEPPER ใน Vercel เพื่อความปลอดภัยสูงสุด (มี fallback ฝั่ง server ให้ทำงานได้ทันที)
const PEPPER =
  process.env.WINVOTE_ID_PEPPER ||
  "cpn-winvote-server-pepper-2568-korat-v1";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gfnelofmgzqfwvlbaabd.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbmVsb2ZtZ3pxZnd2bGJhYWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzEwMDAsImV4cCI6MjA5NjE0NzAwMH0.zpAG-5MorIEhBjd21V5XTl6snJ_RWDewV9jqR0NfyOQ"
);

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  rateLimitMap.set(ip, [...recent, now]);
  return true;
}

// checksum เลขบัตร ปชช. ไทย (กันข้อมูลขยะ)
function validThaiId(id: string): boolean {
  if (!/^[0-9]{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(id.charAt(i), 10) * (13 - i);
  return ((11 - (sum % 11)) % 10) === parseInt(id.charAt(12), 10);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: { national_id?: string; invite_code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const clean = (body.national_id ?? "").replace(/\D/g, "");
  if (!validThaiId(clean)) return NextResponse.json({ error: "เลขบัตรประชาชนไม่ถูกต้อง" }, { status: 400 });

  // ต้องผ่านอย่างใดอย่างหนึ่ง: (1) ล็อกอินเป็นเจ้าหน้าที่ หรือ (2) มีรหัสเชิญที่ใช้ได้ — กันการยิงขอ hash มั่ว
  let allowed = false;
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) allowed = true;
  }
  if (!allowed && body.invite_code) {
    const { data } = await supabase.schema("winvote").rpc("validate_invite", { p_code: body.invite_code.trim() });
    if ((data as { valid?: boolean } | null)?.valid) allowed = true;
  }
  if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hash = createHmac("sha256", PEPPER).update(clean).digest("hex");
  return NextResponse.json({ hash, last4: clean.slice(-4) });
}
