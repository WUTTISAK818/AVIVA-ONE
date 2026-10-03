import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendLine } from "./line";

// ส่ง LINE พร้อมบันทึกผลลง line_message_log เสมอ
// เหตุผล (Pom 1 ต.ค. 69): เดิมส่งแบบ best-effort ไม่เก็บผล ถ้า LINE ล้มเหลวเงียบ ๆ
// เราจะเข้าใจผิดว่าพนักงานเพิกเฉย ทั้งที่ข้อความไม่เคยถึงเขา
export type LineKind =
  | "directive_reminder"
  | "directive_sent"
  | "sales_followup"
  | "booking_flow"
  | "lead_digest_daily"
  | "lead_digest_weekly"
  | "lead_digest_monthly"
  | "other";

export interface LineLogRef {
  kind: LineKind;
  toEmail?: string | null;
  refType?: string | null;
  refId?: string | null;
  title?: string | null;
}

/** ส่งข้อความถึง LINE ส่วนตัวของอีเมลนี้ (ถ้าผูกบัญชีไว้) แล้วบันทึกผลทุกกรณี */
export async function sendLineToEmail(
  db: SupabaseClient,
  email: string,
  text: string,
  ref: LineLogRef,
): Promise<{ ok: boolean; reason?: string }> {
  let lineUserId: string | null = null;
  let result: { ok: boolean; skipped?: string } = { ok: false, skipped: "not-linked" };

  try {
    const { data: link } = await db.from("line_links").select("line_user_id")
      .ilike("user_email", email).not("linked_at", "is", null).maybeSingle();
    lineUserId = (link?.line_user_id as string) ?? null;
    if (lineUserId) result = await sendLine(lineUserId, text);
  } catch {
    result = { ok: false, skipped: "lookup-error" };
  }

  try {
    await db.from("line_message_log").insert({
      to_email: email,
      line_user_id: lineUserId,
      kind: ref.kind,
      ref_type: ref.refType ?? null,
      ref_id: ref.refId ?? null,
      title: ref.title ?? null,
      ok: result.ok,
      error: result.ok ? null : (result.skipped ?? "unknown"),
    });
  } catch {
    /* การบันทึก log ต้องไม่ทำให้งานหลักล้ม */
  }

  return { ok: result.ok, reason: result.skipped };
}

export { lineErrorTh } from "./line-log-th";
