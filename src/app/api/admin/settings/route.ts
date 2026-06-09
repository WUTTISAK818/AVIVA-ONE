import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaudeJSON, anthropicEnabled } from "@/lib/claude";
import { clearSettingCache } from "@/lib/app-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY);

const MANAGER_ROLES = ["admin", "ceo", "manager", "director", "project_manager"];
// secret ที่อนุญาตให้ตั้งผ่านหน้า settings (เพิ่ม key อื่นในอนาคตได้ที่นี่)
const ALLOWED_KEYS = ["ANTHROPIC_API_KEY"];

// ตั้งค่า secret ระดับระบบจากในแอป (มือถือได้ ไม่ต้องแตะ Vercel) — เฉพาะผู้บริหาร
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

  let action = "";
  let key = "";
  let value = "";
  try {
    const body = await req.json();
    action = String(body.action ?? "");
    key = String(body.key ?? "");
    value = String(body.value ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }

  if (action === "status") {
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", key).maybeSingle();
    const v = (data?.value as string | undefined) ?? "";
    const envSet = key === "ANTHROPIC_API_KEY" && !!process.env.ANTHROPIC_API_KEY;
    const configured = envSet || v.length > 0;
    return NextResponse.json({
      configured,
      source: envSet ? "env" : v ? "db" : null,
      suffix: v ? v.slice(-6) : null,
    });
  }

  if (action === "set") {
    if (key === "ANTHROPIC_API_KEY" && !value.trim().startsWith("sk-ant-")) {
      return NextResponse.json({ error: "รูปแบบ key ไม่ถูกต้อง — ต้องขึ้นต้นด้วย sk-ant-" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key, value: value.trim(), updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    clearSettingCache(key);
    return NextResponse.json({ ok: true });
  }

  if (action === "test") {
    if (!(await anthropicEnabled())) {
      return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้ง key" });
    }
    const { data, error } = await callClaudeJSON<{ ok: boolean }>({
      system: 'ตอบ JSON เท่านั้น: {"ok": true}',
      user: "ping",
      maxTokens: 50,
      timeoutMs: 15_000,
    });
    if (data?.ok) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, error: error ?? "เชื่อมต่อไม่สำเร็จ" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
