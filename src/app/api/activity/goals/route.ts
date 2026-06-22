import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department");
    const period = searchParams.get("period");

    let query = supabase
      .from("activity_goals")
      .select("*")
      .order("start_date", { ascending: false });

    if (department) {
      query = query.eq("department", department);
    }
    if (period) {
      query = query.eq("period", period);
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

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const body = await req.json();
    const { department, activity_type, category, target_count, period, start_date, end_date, created_by } = body;

    if (!target_count || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: "target_count, start_date, end_date required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("activity_goals")
      .insert([
        {
          department,
          activity_type,
          category,
          target_count,
          period,
          start_date,
          end_date,
          created_by,
        },
      ])
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
