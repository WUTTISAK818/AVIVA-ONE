import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const { data, error } = await supabase
      .from("notifications_sent")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[Notifications API] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipient_id, title, message, channels_sent, action_url } = body;

    const { data, error } = await supabase
      .from("notifications_sent")
      .insert([
        {
          recipient_id,
          title,
          message,
          channels_sent,
          action_url,
        },
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (error) {
    console.error("[Notifications API] POST error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
