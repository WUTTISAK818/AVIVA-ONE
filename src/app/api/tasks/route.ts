import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TaskCreateInput, TaskUpdateInput } from "@/lib/task-types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assigned_to = searchParams.get("assigned_to");
    const created_by = searchParams.get("created_by");

    let query = supabase.from("tasks_features").select("*");

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (assigned_to) query = query.eq("assigned_to", assigned_to);
    if (created_by) query = query.eq("created_by", created_by);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[Tasks API] GET error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: TaskCreateInput = await req.json();

    const { data, error } = await supabase
      .from("tasks_features")
      .insert([
        {
          title: body.title,
          description: body.description,
          assigned_to: body.assigned_to,
          priority: body.priority || "medium",
          due_date: body.due_date,
          estimated_hours: body.estimated_hours,
          department: body.department,
          category: body.category,
          status: "pending",
          progress_pct: 0,
        },
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (error) {
    console.error("[Tasks API] POST error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
