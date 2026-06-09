import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = admin();
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const { error } = await db.from("line_links").insert({
    user_email: userData.user.email,
    link_code: code,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, code });
}
