import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is manager/admin
    const { data: userData } = await supabase
      .from("users")
      .select("is_manager, is_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.is_manager && !userData?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get daily reports for today
    const today = new Date().toISOString().split("T")[0];

    const { data: reports } = await supabase
      .from("daily_reports")
      .select("id, submitted_by, status, created_at")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`);

    const total = reports?.length || 0;
    const submitted = reports?.filter(r => r.status === "submitted").length || 0;
    const late = reports?.filter(r => r.status === "late").length || 0;

    return NextResponse.json({
      total,
      submitted,
      late
    });
  } catch (error) {
    console.error("Error fetching report summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch report summary" },
      { status: 500 }
    );
  }
}
