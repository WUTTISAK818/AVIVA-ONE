import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];
    const dStart = `${startDate}T00:00:00`;
    const dEnd = `${endDate}T23:59:59`;

    console.log("[test-data] Query range:", { startDate, endDate, dStart, dEnd });

    const [
      { data: sales, error: salesErr, count: salesCount },
      { data: crm, error: crmErr, count: crmCount },
      { data: jv, error: jvErr, count: jvCount },
      { data: cons, error: consErr, count: consCount },
      { data: inst, error: instErr, count: instCount },
      { data: po, error: poErr, count: poCount },
      { data: daily, error: dailyErr, count: dailyCount },
      { data: conReports, error: conRepErr },
    ] = await Promise.all([
      supabase.from("sales_activities").select("id, activity_date", { count: "exact" }).gte("activity_date", dStart).lte("activity_date", dEnd),
      supabase.from("crm_logs").select("id, created_at", { count: "exact" }).gte("created_at", dStart).lte("created_at", dEnd),
      supabase.from("jv_entries").select("id, jv_date", { count: "exact" }).gte("jv_date", startDate).lte("jv_date", endDate),
      supabase.from("construction_reports").select("id, created_at", { count: "exact" }).gte("created_at", dStart).lte("created_at", dEnd),
      supabase.from("contractor_installments").select("id, updated_at", { count: "exact" }).gte("updated_at", dStart).lte("updated_at", dEnd),
      supabase.from("purchase_orders").select("id, created_at", { count: "exact" }).gte("created_at", dStart).lte("created_at", dEnd),
      supabase.from("daily_activity_log").select("id, activity_date", { count: "exact" }).gte("activity_date", dStart).lte("activity_date", dEnd),
      supabase.from("construction_reports").select("id, photo_urls, photo_url").limit(3),
    ]);

    return NextResponse.json({
      success: true,
      query: { startDate, endDate, dStart, dEnd },
      counts: {
        sales: salesCount ?? sales?.length ?? 0,
        crm: crmCount ?? crm?.length ?? 0,
        jv: jvCount ?? jv?.length ?? 0,
        construction: consCount ?? cons?.length ?? 0,
        installments: instCount ?? inst?.length ?? 0,
        purchaseOrders: poCount ?? po?.length ?? 0,
        dailyActivityLog: dailyCount ?? daily?.length ?? 0,
      },
      errors: { salesErr, crmErr, jvErr, consErr, instErr, poErr, dailyErr, conRepErr },
      samplePhotos: conReports?.slice(0, 3).map(r => ({ id: r.id, photo_urls: r.photo_urls, photo_url: r.photo_url })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
