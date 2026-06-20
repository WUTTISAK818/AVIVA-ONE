import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const { searchParams } = new URL(req.url);
    const messageType = searchParams.get("type"); // 'direct', 'channel'
    const recipientId = searchParams.get("recipient_id");
    const channelId = searchParams.get("channel_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (messageType) {
      query = query.eq("message_type", messageType);
    }

    if (recipientId) {
      query = query.or(`recipient_id.eq.${recipientId},sender_id.eq.${recipientId}`);
    }

    if (channelId) {
      query = query.eq("channel_id", channelId);
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const body = await req.json();
    const {
      sender_id,
      sender_name,
      sender_avatar_url,
      message_type = "direct",
      recipient_id,
      channel_id,
      content,
      attachments = [],
    } = body;

    if (!sender_id || !content) {
      return NextResponse.json(
        { success: false, error: "sender_id and content required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          sender_id,
          sender_name,
          sender_avatar_url,
          message_type,
          recipient_id,
          channel_id,
          content,
          attachments,
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
