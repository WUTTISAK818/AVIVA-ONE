import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateDeptBriefing } from "@/lib/dept-data";
import { ANTHROPIC_ENABLED } from "@/lib/claude";
import { EXPERT_DEPTS } from "@/lib/ai-experts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY);

// ผู้ช่วยเชิงรุกประจำฝ่าย — กดเพื่อให้ AI สร้างบรีฟ (รายการน่าสนใจ + แผนสัปดาห์/เดือน)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let dept = "";
  let periodType: "adhoc" | "weekly" | "monthly" = "adhoc";
  try {
    const body = await req.json();
    dept = String(body.dept ?? "");
    if (["weekly", "monthly"].includes(body.periodType)) periodType = body.periodType;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!EXPERT_DEPTS.includes(dept)) {
    return NextResponse.json({ error: "Unknown department" }, { status: 400 });
  }

  if (!ANTHROPIC_ENABLED) {
    return NextResponse.json(
      { error: "AI ยังไม่พร้อมใช้งาน — กรุณาตั้งค่า ANTHROPIC_API_KEY ในระบบก่อนค่ะ" },
      { status: 503 },
    );
  }

  const { data: dbUser } = await supabaseAdmin
    .from("users").select("full_name").eq("id", user.id).single();

  const { briefing, model, error } = await generateDeptBriefing(
    supabaseAdmin, dept, periodType, dbUser?.full_name ?? user.email ?? "user",
  );

  if (!briefing) {
    return NextResponse.json(
      { error: error === "PARSE_FAILED" ? "AI ตอบกลับไม่สมบูรณ์ กรุณาลองใหม่ค่ะ" : (error ?? "สร้างบรีฟไม่สำเร็จ") },
      { status: 502 },
    );
  }
  return NextResponse.json({ briefing, model });
}
