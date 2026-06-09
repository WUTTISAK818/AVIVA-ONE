import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateExecutiveBriefing } from "@/lib/dept-data";
import { ANTHROPIC_ENABLED } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY);

const MANAGER_ROLES = ["admin", "ceo", "manager", "director", "project_manager"];

// สภา AI: ผู้เชี่ยวชาญแต่ละฝ่ายปรึกษากัน → สรุปเสนอผู้บริหาร (เฉพาะผู้บริหารเรียกได้)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dbUser } = await supabaseAdmin
    .from("users").select("role, full_name").eq("id", user.id).single();
  if (!MANAGER_ROLES.includes(dbUser?.role ?? "")) {
    return NextResponse.json({ error: "เฉพาะผู้บริหารเท่านั้น" }, { status: 403 });
  }

  if (!ANTHROPIC_ENABLED) {
    return NextResponse.json(
      { error: "AI ยังไม่พร้อมใช้งาน — กรุณาตั้งค่า ANTHROPIC_API_KEY ก่อนค่ะ" },
      { status: 503 },
    );
  }

  let period: "weekly" | "monthly" = "weekly";
  try {
    const body = await req.json();
    if (body?.period === "monthly") period = "monthly";
  } catch { /* default weekly */ }

  const { briefing, model, id, error } = await generateExecutiveBriefing(
    supabaseAdmin, period, dbUser?.full_name ?? user.email ?? "ผู้บริหาร",
  );

  if (!briefing) {
    return NextResponse.json(
      { error: error === "NO_DEPT_DATA" ? "ยังไม่มีบรีฟของฝ่ายใดเลย กรุณาสร้างบรีฟฝ่ายก่อนค่ะ" : (error ?? "ประชุมสภาไม่สำเร็จ") },
      { status: 502 },
    );
  }

  await supabaseAdmin.from("notifications").insert({
    project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร",
    title: "สภา AI สรุปเสนอผู้บริหารแล้ว", message: briefing.title ?? "", is_read: false,
  });

  return NextResponse.json({ briefing, model, id });
}
