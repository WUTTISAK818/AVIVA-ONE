import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

const CHOICES = ["for", "against", "abstain"] as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  if (!body?.choice || !CHOICES.includes(body.choice)) {
    return NextResponse.json({ error: "invalid choice" }, { status: 400 });
  }

  // Resolve resident id
  const { data: resident } = await supabaseAdmin
    .from("residents")
    .select("id")
    .eq("auth_user_id", caller.id)
    .maybeSingle();
  if (!resident) return NextResponse.json({ error: "no resident profile" }, { status: 403 });

  const { data: resolution } = await supabaseAdmin
    .from("resolutions")
    .select("id, status, voting_closes_at")
    .eq("id", id)
    .maybeSingle();
  if (!resolution) return NextResponse.json({ error: "resolution_not_found" }, { status: 404 });
  if (resolution.status !== "open") return NextResponse.json({ error: "voting_closed" }, { status: 409 });
  if (resolution.voting_closes_at && new Date(resolution.voting_closes_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "voting_closed" }, { status: 409 });
  }

  const { error: upErr } = await supabaseAdmin
    .from("resolution_votes")
    .upsert(
      {
        resolution_id: id,
        voter_resident_id: resident.id,
        choice: body.choice,
        weight: 1,
      },
      { onConflict: "resolution_id,voter_resident_id" }
    );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Recompute tally
  const { data: votes } = await supabaseAdmin
    .from("resolution_votes")
    .select("choice, weight")
    .eq("resolution_id", id);
  const sum = { for: 0, against: 0, abstain: 0 } as Record<string, number>;
  for (const v of votes ?? []) {
    sum[v.choice as string] = (sum[v.choice as string] ?? 0) + Number(v.weight);
  }
  await supabaseAdmin.from("resolutions").update({
    result_for: sum.for,
    result_against: sum.against,
    result_abstain: sum.abstain,
  }).eq("id", id);

  return NextResponse.json({ ok: true, tally: sum });
}
