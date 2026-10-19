import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { verifyDirective, type DirectiveForVerify } from "@/lib/directive-verify";
import { isManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

// ตรวจคำสั่งงานอัตโนมัติ ก่อนผู้สั่งงานกด "ตรวจรับ · ปิดจ็อบ"
// เฉพาะผู้สั่งงานใบนั้น หรือผู้บริหาร — พนักงานผู้รับคำสั่งตรวจงานตัวเองไม่ได้ (Maker-Checker)
export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id ของคำสั่งงาน" }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data, error: dbError } = await db
    .from("directives")
    .select("id, message, reference_note, response_note, assigned_to, assigned_to_name, created_by, created_at, done_at")
    .eq("id", id)
    .maybeSingle();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "ไม่พบคำสั่งงานนี้" }, { status: 404 });

  // verifyAuth แนบ role มาให้เฉพาะตอนส่ง requiredRoles — ที่นี่ต้องอ่านเอง
  // เพราะสิทธิ์คือ "ผู้สั่งงานใบนี้ หรือผู้บริหาร" ไม่ใช่ role เดียวตายตัว
  const { data: me } = await db.from("users").select("role").eq("id", user.id).maybeSingle();
  const isIssuer = (data.created_by ?? "").toLowerCase() === (user.email ?? "").toLowerCase();
  if (!isIssuer && !isManagerRole(me?.role)) {
    return NextResponse.json({ error: "ดูผลตรวจได้เฉพาะผู้สั่งงานหรือผู้บริหาร" }, { status: 403 });
  }

  const result = await verifyDirective(db, data as DirectiveForVerify);
  return NextResponse.json(result);
}
