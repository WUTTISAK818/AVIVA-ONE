import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const projectId = "aaaaaaaa-0000-0000-0000-000000000001";

    // ลบ interested_count = 0 สำหรับทุกลูกค้าใน A5 project
    const { data, error } = await supabase
      .from("leads")
      .update({ interested_count: 0 })
      .eq("project_id", projectId)
      .select("id, customer_name, interested_count");

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `✅ ลบสถานะ 'สนใจ' ออกจาก A5 project เสร็จ`,
      updated_count: data?.length || 0,
      details: data?.map(d => `${d.customer_name}: 0 สนใจ`) || []
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
