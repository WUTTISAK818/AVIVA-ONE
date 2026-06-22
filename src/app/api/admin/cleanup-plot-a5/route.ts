import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // ตรวจสอบลูกค้าทั้งหมดของแปลงที่ 5
    const { data: allLeads, error: fetchError } = await supabase
      .from("leads")
      .select("id, customer_name, status, plot_number, interested_count")
      .eq("project_id", PROJECT_ID)
      .eq("plot_number", 5)
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    if (!allLeads || allLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "ไม่พบลูกค้าสำหรับแปลงที่ 5",
        cleaned_count: 0,
        remaining_lead: null,
      });
    }

    // หาลูกค้าที่ซื้อแล้ว (Closed Deal)
    const closedDealLead = allLeads.find(l => l.status === "Closed Deal");
    const interestedLeads = allLeads.filter(l => l.status !== "Closed Deal");

    // ลบลูกค้าที่สนใจแต่ไม่ได้ซื้อ
    if (interestedLeads.length > 0) {
      const { error: deleteError } = await supabase
        .from("leads")
        .delete()
        .in("id", interestedLeads.map(l => l.id));

      if (deleteError) throw deleteError;
    }

    // ตรวจสอบผลลัพธ์
    const { data: remaining } = await supabase
      .from("leads")
      .select("id, customer_name, status, plot_number")
      .eq("project_id", PROJECT_ID)
      .eq("plot_number", 5);

    return NextResponse.json({
      success: true,
      message: "✅ ล้างข้อมูลผู้สนใจแปลงที่ 5 เสร็จสิ้น",
      cleaned_count: interestedLeads.length,
      removed_leads: interestedLeads.map(l => ({
        name: l.customer_name,
        status: l.status,
        interested_count: l.interested_count
      })),
      remaining_lead: closedDealLead ? {
        name: closedDealLead.customer_name,
        status: closedDealLead.status
      } : null,
      verification: {
        total_leads_before: allLeads.length,
        total_leads_after: remaining?.length || 0,
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
