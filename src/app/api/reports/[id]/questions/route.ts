import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/server-db";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = serverDb(req.headers.get("Authorization")?.slice(7) || "");
    const { id } = await params;
    const { data, error } = await db
      .from("report_questions")
      .select("*")
      .eq("report_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = serverDb(req.headers.get("Authorization")?.slice(7) || "");
    const { id } = await params;
    const body = await req.json();
    const {
      report_date,
      report_author_id,
      report_author_name,
      report_author_email,
      question_by_id,
      question_by_name,
      question_by_role,
      question_text,
    } = body;

    if (!question_text || !question_by_id) {
      return NextResponse.json(
        { success: false, error: "question_text and question_by_id required" },
        { status: 400 }
      );
    }

    if (question_by_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot ask question as another user" },
        { status: 403 }
      );
    }

    const { data, error } = await db
      .from("report_questions")
      .insert([
        {
          report_id: id,
          report_date,
          report_author_id,
          report_author_name,
          report_author_email,
          question_by_id,
          question_by_name,
          question_by_role,
          question_text,
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
