import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // ใช้ service role ถ้ามี ไม่งั้นใช้สิทธิ์ผู้ใช้ที่ล็อกอิน (RLS: linelinks_all_auth) — ไม่ต้องพึ่ง ENV ใน Vercel
  const db = serverDb(token);
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const email = userData.user.email;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  // ลบรหัสเก่าที่ยังไม่ได้ผูกของผู้ใช้คนนี้ กันรหัสค้างหลายตัว
  await db.from("line_links").delete().eq("user_email", email).is("linked_at", null);
  const { error } = await db.from("line_links").insert({
    user_email: email,
    link_code: code,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, code });
}
