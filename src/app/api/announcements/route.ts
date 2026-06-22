import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeArchived = searchParams.get("include_archived") === "true";

    let query = supabase
      .from("announcements")
      .select("*", { count: "exact" })
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    // Filter unexpired announcements
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const body = await req.json();
    const {
      title,
      content,
      announcement_type = "info",
      priority = "medium",
      announced_by,
      announced_by_name,
      announced_by_role,
      target_roles = [],
      target_departments = [],
      target_user_ids = [],
      attachments = [],
      expires_at,
    } = body;

    if (!title || !content || !announced_by) {
      return NextResponse.json(
        { success: false, error: "title, content, and announced_by required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("announcements")
      .insert([
        {
          title,
          content,
          announcement_type,
          priority,
          announced_by,
          announced_by_name,
          announced_by_role,
          target_roles,
          target_departments,
          target_user_ids,
          attachments,
          expires_at,
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
