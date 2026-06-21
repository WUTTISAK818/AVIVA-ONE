import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// @basic-id ของ LINE OA เช่น @123abcd (ใช้สร้างลิงก์ oaMessage แบบ prefill token)
const LINE_OA_ID = process.env.LINE_OA_ID;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // client ที่ผูก JWT ผู้ใช้ -> RLS เห็นเป็นผู้ใช้คนนั้น (privileged role เท่านั้นที่ insert ได้)
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resident_id } = await req.json();
  if (!resident_id) return NextResponse.json({ error: "resident_id required" }, { status: 400 });

  // ดึงเบอร์ของชาวบ้าน (และตรวจสิทธิ์เข้าถึงผ่าน RLS)
  const { data: resident, error: rErr } = await supabase
    .schema("winvote").from("residents")
    .select("id, phone, phone_verified")
    .eq("id", resident_id)
    .single();
  if (rErr || !resident) return NextResponse.json({ error: "ไม่พบข้อมูลชาวบ้าน" }, { status: 404 });
  if (resident.phone_verified) return NextResponse.json({ alreadyVerified: true });

  const verifyToken = crypto.randomBytes(12).toString("hex");
  const { error: insErr } = await supabase.schema("winvote").from("phone_verifications").insert({
    resident_id: resident.id,
    phone: resident.phone,
    token: verifyToken,
    status: "pending",
    created_by: user.email ?? user.id,
  });
  if (insErr) return NextResponse.json({ error: "สร้างคำขอยืนยันไม่สำเร็จ" }, { status: 500 });

  // ถ้ายังไม่ได้ตั้งค่า LINE OA -> คืน needsSetup (graceful fallback)
  if (!LINE_OA_ID) {
    return NextResponse.json({ token: verifyToken, needsSetup: true });
  }

  // ลิงก์เปิดแชต OA พร้อม prefill ข้อความ = token; ชาวบ้านแตะ "ส่ง" = ยืนยัน (ไม่ต้องกรอกรหัส)
  const lineUrl = `https://line.me/R/oaMessage/${LINE_OA_ID}/?${encodeURIComponent(verifyToken)}`;
  return NextResponse.json({ token: verifyToken, line_url: lineUrl, needsSetup: false });
}
