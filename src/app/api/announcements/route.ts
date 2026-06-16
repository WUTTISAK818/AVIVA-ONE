import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

const ADMIN_ROLES = ["admin", "manager", "ceo", "director"];

export async function POST(req: Request) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (caller.user_metadata?.role as string) ?? "";
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.body_md) {
    return NextResponse.json({ error: "title and body_md required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("announcements")
    .insert({
      title: body.title,
      body_md: body.body_md,
      author_id: caller.id,
      category: body.category ?? "general",
      pinned: !!body.pinned,
      expires_at: body.expires_at ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("notifications").insert({
    type: "info",
    title: "ประกาศใหม่",
    message: body.title,
    record_id: data.id,
  });

  return NextResponse.json({ ok: true, id: data.id });
}
