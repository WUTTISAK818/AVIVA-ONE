import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const projectId = "aaaaaaaa-0000-0000-0000-000000000001";

    // ลบ interested_count สำหรับทุกลูกค้าใน A5 project
    const { data, error } = await supabase
      .from("leads")
      .update({ interested_count: 0 })
      .eq("project_id", projectId)
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `ลบสถานะ "สนใจ" ออกจากลูกค้า ${data?.length || 0} คนแล้ว`,
      updated_count: data?.length || 0
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
