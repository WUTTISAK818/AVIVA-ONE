import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateExecutiveBriefing } from "@/lib/dept-data";
import { anthropicEnabled } from "@/lib/claude";
import { serverDb } from "@/lib/server-db";
import { MANAGER_ROLES } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// สภา AI: ผู้เชี่ยวชาญแต่ละฝ่ายปรึกษากัน → สรุปเสนอผู้บริหาร (เฉพาะผู้บริหารเรียกได้)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ใช้ service role ถ้ามี ไม่งั้นใช้สิทธิ์ผู้ใช้ที่ล็อกอิน (RLS v473)
  const db = serverDb(token);
  const { data: dbUser } = await db
    .from("users").select("role, full_name").eq("id", user.id).single();
  if (!MANAGER_ROLES.includes(dbUser?.role ?? "")) {
    return NextResponse.json({ error: "เฉพาะผู้บริหารเท่านั้น" }, { status: 403 });
  }

  if (!(await anthropicEnabled(token))) {
    return NextResponse.json(
      { error: "AI ยังไม่พร้อมใช้งาน — กรุณาตั้งค่า API key ที่ ตั้งค่า → ผู้เชี่ยวชาญ AI ก่อนค่ะ" },
      { status: 503 },
    );
  }

  let period: "weekly" | "monthly" = "weekly";
  try {
    const body = await req.json();
    if (body?.period === "monthly") period = "monthly";
  } catch { /* default weekly */ }

  const { briefing, model, id, error } = await generateExecutiveBriefing(
    db, period, dbUser?.full_name ?? user.email ?? "ผู้บริหาร", token,
  );

  if (!briefing) {
    return NextResponse.json(
      { error: error === "NO_DEPT_DATA" ? "ยังไม่มีบรีฟของฝ่ายใดเลย กรุณาสร้างบรีฟฝ่ายก่อนค่ะ" : (error ?? "ประชุมสภาไม่สำเร็จ") },
      { status: 502 },
    );
  }

  await db.from("notifications").insert({
    project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร",
    title: "สภา AI สรุปเสนอผู้บริหารแล้ว", message: briefing.title ?? "", is_read: false,
  });

  return NextResponse.json({ briefing, model, id });
}
