import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employee_id");
    const isRead = searchParams.get("is_read");

    let query = supabase
      .from("activity_alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }
    if (isRead !== null) {
      query = query.eq("is_read", isRead === "true");
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const body = await req.json();
    const { alert_id, is_read, dismissed } = body;

    if (!alert_id) {
      return NextResponse.json(
        { success: false, error: "alert_id required" },
        { status: 400 }
      );
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (is_read !== undefined) {
      updateData.is_read = is_read;
      updateData.read_at = is_read ? new Date().toISOString() : null;
    }
    if (dismissed !== undefined) {
      updateData.dismissed = dismissed;
    }

    const { data, error } = await supabase
      .from("activity_alerts")
      .update(updateData)
      .eq("id", alert_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
