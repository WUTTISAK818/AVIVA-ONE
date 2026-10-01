import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// ตอบคำสั่งงานผ่าน LINE ได้เลย ไม่ต้องเปิดแอปไปหาปุ่ม (Pom เคาะ 30 ก.ย. 69)
// เหตุผล: เตือนครบทุกขั้นแล้วแต่ไม่มีใครกด "รับทราบ" เพราะเป็นภาระเพิ่มที่ไม่ให้ประโยชน์กับพนักงาน
// ทั้งที่เขาอ่านและไปทำงานจริงแล้ว — จึงย้ายการยืนยันมาไว้ในที่ที่เขาอยู่อยู่แล้ว
const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

/** สถานะที่ยังต้องการการตอบจากผู้รับงาน */
const OPEN_STATUSES = ["sent", "acknowledged", "in_progress"];

export interface PendingDirective {
  id: string;
  message: string;
  status: string;
  due_date: string | null;
  created_by: string;
  created_by_name: string | null;
  assigned_to_name: string | null;
  acknowledged_at: string | null;
}

const ACK_WORDS = ["รับทราบ", "รับทร", "ทราบแล้ว", "รับแล้ว", "โอเค", "โอเคครับ", "โอเคค่ะ", "ok", "okay", "ack", "รับ"];
const DONE_WORDS = ["เสร็จแล้ว", "ทำเสร็จแล้ว", "เสร็จ", "done", "จบแล้ว", "เรียบร้อย", "เรียบร้อยแล้ว"];
const LIST_WORDS = ["งาน", "คำสั่งงาน", "คำสั่ง", "list", "งานค้าง", "?"];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const startsWithAny = (t: string, words: string[]) => words.find(w => t === w || t.startsWith(w + " ") || t.startsWith(w));

function short(msg: string, n = 70): string {
  const one = msg.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n)}…` : one;
}

function listText(rows: PendingDirective[]): string {
  return rows.map((d, i) => {
    const flag = d.acknowledged_at ? "กำลังทำ" : "ยังไม่รับทราบ";
    const due = d.due_date ? ` · กำหนด ${d.due_date}` : "";
    return `${i + 1}. ${short(d.message)}\n    (${flag}${due})`;
  }).join("\n");
}

/** ดึงคำสั่งงานที่ยังไม่จบของผู้ใช้คนนี้ เรียงเก่าสุดก่อน */
export async function pendingForEmail(db: SupabaseClient, email: string): Promise<PendingDirective[]> {
  const { data } = await db.from("directives")
    .select("id, message, status, due_date, created_by, created_by_name, assigned_to_name, acknowledged_at")
    .ilike("assigned_to", email)
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: true });
  return (data ?? []) as PendingDirective[];
}

async function notifyCommander(
  db: SupabaseClient, d: PendingDirective, title: string, body: string,
) {
  await db.from("notifications").insert({
    project_id: PROJECT_ID, type: "info", to_user_email: d.created_by, from_dept: "ระบบคำสั่งงาน",
    title, message: body, is_read: false, link: "/directives",
  }).then(() => {}, () => {});
}

/**
 * ตีความข้อความที่พนักงานตอบกลับใน LINE แล้วอัปเดตคำสั่งงานให้
 * คืนข้อความที่จะตอบกลับไปใน LINE (null = ไม่ใช่คำสั่งที่เกี่ยวกับคำสั่งงาน ให้ไปทำอย่างอื่นต่อ)
 */
export async function handleDirectiveReply(
  db: SupabaseClient, email: string, rawText: string,
): Promise<string | null> {
  const t = norm(rawText);
  const rows = await pendingForEmail(db, email);

  // ขอดูรายการงานค้าง
  if (startsWithAny(t, LIST_WORDS)) {
    if (rows.length === 0) return "ไม่มีคำสั่งงานค้างอยู่เลยครับ 👍";
    return `คำสั่งงานที่ยังไม่จบ ${rows.length} ชิ้น:\n\n${listText(rows)}\n\n` +
      `ตอบ "รับทราบ" (หรือ "รับทราบ 2" ถ้ามีหลายชิ้น) เพื่อยืนยัน\n` +
      `ตอบ "เสร็จแล้ว <รายงานผล>" เมื่อทำเสร็จ`;
  }

  const ackWord = startsWithAny(t, ACK_WORDS);
  const doneWord = startsWithAny(t, DONE_WORDS);
  if (!ackWord && !doneWord) return null;

  if (rows.length === 0) return "ตอนนี้ไม่มีคำสั่งงานค้างของคุณในระบบครับ";

  // เลือกชิ้นที่จะตอบ: ระบุเลขมา หรือมีชิ้นเดียวก็เลือกให้เลย
  const numMatch = t.match(/(\d+)\s*$/);
  let target: PendingDirective | undefined;
  if (numMatch) {
    const idx = Number(numMatch[1]) - 1;
    if (idx < 0 || idx >= rows.length) {
      return `ไม่พบงานลำดับที่ ${numMatch[1]} ครับ ตอนนี้มี ${rows.length} ชิ้น:\n\n${listText(rows)}`;
    }
    target = rows[idx];
  } else if (rows.length === 1) {
    target = rows[0];
  } else {
    const verb = doneWord ? "เสร็จแล้ว" : "รับทราบ";
    return `มีคำสั่งงานค้าง ${rows.length} ชิ้น ตอบกลับพร้อมลำดับด้วยครับ เช่น "${verb} 1"\n\n${listText(rows)}`;
  }

  // ── ทำเสร็จแล้ว → ส่งให้ผู้สั่งตรวจรับ (ต้องมีรายงานผลงานตามกติกาเดิม) ──
  if (doneWord) {
    const note = rawText.trim().slice(doneWord.length).replace(/^\s*\d+\s*/, "").trim();
    if (!note) {
      return `ได้ครับ — ช่วยเขียนรายงานผลงานต่อท้ายด้วย เช่น\n"เสร็จแล้ว บันทึกข้อมูลลูกค้าแปลง 29 เรียบร้อย"\n\nงานที่จะปิด: ${short(target.message)}`;
    }
    const { data: changed } = await db.from("directives").update({
      status: "done", done_at: new Date().toISOString(), response_note: note,
      acknowledged_at: target.acknowledged_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", target.id).in("status", OPEN_STATUSES).select("id");
    if (!changed || changed.length === 0) return "สถานะงานนี้เปลี่ยนไปแล้ว ลองเปิดแอปดูอีกครั้งครับ";

    await notifyCommander(db, target,
      `${target.assigned_to_name || "พนักงาน"} รายงานว่าทำเสร็จแล้ว — รอคุณตรวจรับ`,
      `${target.message}\n\nรายงานผลงาน: ${note}\n\n(ตอบผ่าน LINE)\n\nเปิดหน้าคำสั่งงาน → แท็บ "ที่ฉันสั่ง" เพื่อตรวจรับและปิดจ็อบ`);

    return `บันทึกแล้วครับ ✅ ส่งให้ ${target.created_by_name || "ผู้สั่งงาน"} ตรวจรับแล้ว\n\nงาน: ${short(target.message)}\nรายงานผล: ${note}`;
  }

  // ── รับทราบ ──
  if (target.acknowledged_at) {
    return `งานนี้รับทราบไปแล้วครับ\n\n${short(target.message)}\n\nทำเสร็จเมื่อไหร่ตอบ "เสร็จแล้ว <รายงานผล>" ได้เลย`;
  }
  const { data: changed } = await db.from("directives").update({
    status: "acknowledged", acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", target.id).eq("status", "sent").select("id");
  if (!changed || changed.length === 0) return "สถานะงานนี้เปลี่ยนไปแล้ว ลองเปิดแอปดูอีกครั้งครับ";

  await notifyCommander(db, target,
    `${target.assigned_to_name || "พนักงาน"} รับทราบคำสั่งงานแล้ว`,
    `${target.message}\n\n(รับทราบผ่าน LINE)`);

  const left = rows.filter(r => r.id !== target!.id && !r.acknowledged_at).length;
  return `รับทราบเรียบร้อยครับ ✅\n\n${short(target.message)}${target.due_date ? `\nกำหนดเสร็จ ${target.due_date}` : ""}\n\n` +
    (left > 0 ? `ยังมีอีก ${left} ชิ้นที่ยังไม่รับทราบ — พิมพ์ "งาน" เพื่อดูรายการ` : `ทำเสร็จแล้วตอบ "เสร็จแล้ว <รายงานผล>" ได้เลย`);
}
