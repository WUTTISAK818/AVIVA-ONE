import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { WINVOTE_URL, WINVOTE_ANON } from "@/lib/supabase";

// ค่า public จริงของ WinVote (anon key ปลอดภัย ป้องกันด้วย RLS)
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || WINVOTE_URL;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || WINVOTE_ANON;

const ALLOWED = new Set(["login", "logout", "password_change", "session_kick", "export", "reveal", "view"]);

export async function POST(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { action?: string; meta?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const action = String(body.action || "");
  if (!ALLOWED.has(action)) return NextResponse.json({ error: "bad action" }, { status: 400 });

  // client ที่ผูก token ของผู้ใช้ -> insert ผ่าน RLS (authenticated)
  const supabase = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ua = req.headers.get("user-agent") || "";
  const { error } = await supabase.schema("winvote").from("access_log").insert({
    user_id: user.id, email: user.email, action, ip, user_agent: ua,
    meta: body.meta && typeof body.meta === "object" ? body.meta : null,
  });
  if (error) return NextResponse.json({ error: "log failed" }, { status: 500 });
  return NextResponse.json({ ok: true, ip });
}
