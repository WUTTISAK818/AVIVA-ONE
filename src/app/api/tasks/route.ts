import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  // Verify authentication before accessing tasks
  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const { searchParams } = new URL(req.url);
    const assignedTo = searchParams.get("assigned_to");
    const assignedBy = searchParams.get("assigned_by");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("task_assignments")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .range(offset, offset + limit - 1);

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
    }

    if (assignedBy) {
      query = query.eq("assigned_by", assignedBy);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      total: count,
      limit,
      offset,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Verify authentication before creating tasks
  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const body = await req.json();
    const {
      title,
      description,
      assigned_by,
      assigned_by_name,
      assigned_to,
      assigned_to_name,
      assigned_to_email,
      task_priority = "medium",
      due_date,
      due_time,
      related_record_id,
      related_record_type,
      attachments = [],
    } = body;

    if (!title || !assigned_by || !assigned_to) {
      return NextResponse.json(
        { success: false, error: "title, assigned_by, and assigned_to required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("task_assignments")
      .insert([
        {
          title,
          description,
          assigned_by,
          assigned_by_name,
          assigned_to,
          assigned_to_name,
          assigned_to_email,
          task_priority,
          due_date,
          due_time,
          related_record_id,
          related_record_type,
          attachments,
          status: "assigned",
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
