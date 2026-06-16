import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

const ADMIN_ROLES = ["admin", "manager", "ceo", "director"];

interface Line { account_id: string; debit?: number; credit?: number; memo?: string }

export async function POST(req: Request) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (caller.user_metadata?.role as string) ?? "";
  if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as { entry_date?: string; description?: string; lines?: Line[] } | null;
  if (!body?.lines || body.lines.length < 2) {
    return NextResponse.json({ error: "at least 2 lines required" }, { status: 400 });
  }
  const totalDebit = body.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const totalCredit = body.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json({ error: `debit ${totalDebit} != credit ${totalCredit}` }, { status: 400 });
  }

  const { data: journal, error: jErr } = await supabaseAdmin
    .from("juristic_journals")
    .insert({
      entry_date: body.entry_date ?? new Date().toISOString().slice(0, 10),
      description: body.description ?? null,
      created_by: caller.id,
    })
    .select("id")
    .single();
  if (jErr || !journal) return NextResponse.json({ error: jErr?.message ?? "journal insert failed" }, { status: 500 });

  const linesRows = body.lines.map(l => ({
    journal_id: journal.id,
    account_id: l.account_id,
    debit: Number(l.debit ?? 0),
    credit: Number(l.credit ?? 0),
    memo: l.memo ?? null,
  }));
  const { error: lErr } = await supabaseAdmin.from("juristic_journal_lines").insert(linesRows);
  if (lErr) {
    await supabaseAdmin.from("juristic_journals").delete().eq("id", journal.id);
    return NextResponse.json({ error: lErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, journal_id: journal.id });
}
