import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { user_id, user_name, answer_text } = body;

    if (!answer_text || !user_id) {
      return NextResponse.json(
        { success: false, error: "answer_text and user_id required" },
        { status: 400 }
      );
    }

    if (user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot answer as another user" },
        { status: 403 }
      );
    }

    const { data: question, error: fetchError } = await supabase
      .from("report_questions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 400 });
    }

    const newAnswer = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9),
      user_id,
      user_name,
      text: answer_text,
      created_at: new Date().toISOString(),
    };

    const updatedAnswers = [...(question.answers || []), newAnswer];

    const { data, error } = await supabase
      .from("report_questions")
      .update({
        answers: updatedAnswers,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { is_resolved } = body;

    const { data, error } = await supabase
      .from("report_questions")
      .update({
        is_resolved,
        resolved_at: is_resolved ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
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
