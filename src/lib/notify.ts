import { supabase } from "./supabase";
import { notifyPush } from "./workflow-events";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// ประเภทแจ้งเตือนที่ส่งเข้า LINE ส่วนตัวด้วย (รออนุมัติ/ผลอนุมัติ/เคลม/หมุดหมาย) — เว้น "info" กัน spam
const LINE_TYPES = new Set(["approval", "claim", "success"]);

// ปรับชื่อแผนกให้เป็น "ภาษาไทยชุดเดียว" — กันค่าอังกฤษ/legacy (management/construction ฯลฯ)
// หลุดเข้า to_dept/from_dept แล้วทำให้ filter รายแผนก + เจาะ LINE ส่วนตัว resolve ไม่เจอ
const DEPT_ALIASES: Record<string, string> = {
  management: "ผู้บริหาร", executive: "ผู้บริหาร", admin: "ผู้บริหาร", ceo: "ผู้บริหาร", coo: "ผู้บริหาร",
  sales: "ฝ่ายขาย",
  construction: "ฝ่ายก่อสร้าง", engineering: "ฝ่ายก่อสร้าง", engineer: "ฝ่ายก่อสร้าง",
  finance: "ฝ่ายการเงิน", accounting: "ฝ่ายบัญชี", account: "ฝ่ายบัญชี",
  hr: "ฝ่ายบุคคล",
  marketing: "ฝ่ายการตลาด",
  "after-sales": "ฝ่ายหลังการขาย", aftersales: "ฝ่ายหลังการขาย",
};
export function normalizeDept(dept?: string | null): string | null {
  if (!dept) return null;
  const key = dept.trim().toLowerCase();
  return DEPT_ALIASES[key] ?? dept.trim();
}

/** จับคู่ชื่อแผนก (ไทย ใน to_dept) กับ users.role — คืน true ถ้า role นี้อยู่ในแผนกนั้น (ข้ามบัญชี AI/bot) */
function roleInDept(roleRaw: string | null, dept: string): boolean {
  const r = (roleRaw ?? "").toLowerCase().trim();
  if (!r || r.endsWith("_ai")) return false; // ข้ามบัญชี AI/ผู้ช่วยอัตโนมัติ
  const has = (...k: string[]) => k.some((s) => r.includes(s));
  if (dept.includes("หลังการขาย")) return has("after");
  if (dept.includes("ขาย")) return has("sales") && !has("after");
  if (dept.includes("ก่อสร้าง")) return has("engineer", "construction", "qc");
  if (dept.includes("การเงิน") || dept.includes("บัญชี")) return has("finance", "account");
  if (dept.includes("บุคคล") || dept.includes("HR")) return has("hr");
  if (dept.includes("การตลาด")) return has("market");
  if (dept.includes("บริหาร")) return has("ceo", "coo", "director", "management", "admin", "executive") || r === "manager";
  return false;
}

/** แปลงรายชื่อแผนก -> อีเมลผู้เกี่ยวข้อง (อิง users.role) สำหรับเจาะ LINE ส่วนตัว; ไม่เจอ -> undefined (fallback broadcast) */
async function resolveDeptEmails(depts: string[]): Promise<string[] | undefined> {
  const wanted = depts.filter(Boolean);
  if (wanted.length === 0) return undefined;
  const { data } = await supabase.from("users").select("email, role");
  const emails = (data ?? [])
    .filter((u) => u.email && wanted.some((d) => roleInDept(u.role, d)))
    .map((u) => u.email as string);
  return emails.length ? Array.from(new Set(emails)) : undefined;
}

/** ยิงแจ้งเตือนเข้า LINE ส่วนตัวของผู้ใช้ที่ผูกบัญชีไว้ (best-effort, ไม่ throw) */
export async function notifyPersonalLine(title: string, body: string, url?: string, emails?: string[]) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch("/api/notify/personal-line", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ title, body, url, emails }),
    });
  } catch { /* best-effort */ }
}

export async function createNotification(opts: {
  type: "approval" | "claim" | "document" | "success" | "info";
  title: string;
  message: string;
  from_dept?: string;
  to_dept?: string;
  record_id?: string;
  /** ปลายทางที่แท้จริงเมื่อกดการแจ้งเตือน (เช่น "/office?tab=finance", "/settings/suggestions") */
  link?: string;
  /** เจาะ LINE ส่วนตัวเฉพาะแผนกเหล่านี้ (ค่าเริ่มต้น = [to_dept]) */
  line_to_depts?: string[];
}) {
  const toDept = normalizeDept(opts.to_dept);

  // Retry logic: attempt up to 3 times
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { error } = await supabase.from("notifications").insert({
        project_id: PROJECT_ID,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        from_dept: normalizeDept(opts.from_dept),
        to_dept: toDept,
        is_read: false,
        record_id: opts.record_id ?? null,
        link: opts.link ?? null,
      });

      if (error) {
        lastError = new Error(`Notification insert failed: ${error.message}`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 100 * attempt));
          continue;
        }
        console.error(`[createNotification] Failed after 3 attempts:`, lastError);
        break;
      }

      // Success - proceed with LINE + push notifications
      if (LINE_TYPES.has(opts.type)) {
        const depts = (opts.line_to_depts ?? (toDept ? [toDept] : [])).map(normalizeDept).filter(Boolean) as string[];
        const emails = await resolveDeptEmails(depts);
        const url = opts.link ?? (opts.record_id ? `/crm?lead=${opts.record_id}` : undefined);
        await notifyPersonalLine(opts.title, opts.message, url, emails).catch(err =>
          console.error(`[createNotification] LINE notify failed:`, err)
        );
      }
      // Send web push notification (best-effort)
      if (toDept) {
        await notifyPush(toDept, opts.title, opts.message, opts.link, opts.type).catch(err =>
          console.error(`[createNotification] Push notify failed:`, err)
        );
      }
      return; // Success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 100 * attempt));
        continue;
      }
      console.error(`[createNotification] Exception after 3 attempts:`, lastError);
    }
  }
}

/**
 * แจ้งเตือนหมุดหมายการขาย (จอง/ทำสัญญา/อนุมัติกู้/โอนแล้ว):
 * บันทึกลง DB (เด้ง real-time ในแอป) + ส่ง push เข้ามือถือฝ่ายขาย + ผู้บริหาร
 * push เป็น best-effort — ถ้าไม่มี VAPID/ยังไม่ได้ subscribe จะข้ามเงียบๆ
 */
export async function notifyMilestone(opts: {
  title: string;
  message: string;
  record_id?: string;
  url?: string;
}) {
  await createNotification({
    type: "success",
    title: opts.title,
    message: opts.message,
    from_dept: "ฝ่ายขาย",
    to_dept: "ผู้บริหาร",
    record_id: opts.record_id,
    line_to_depts: ["ฝ่ายขาย", "ผู้บริหาร"], // หมุดหมายขาย -> เจาะ LINE ฝ่ายขาย + ผู้บริหาร
  });
  const url = opts.url ?? (opts.record_id ? `/crm?lead=${opts.record_id}` : "/crm");
  // ส่งออกหลายช่องทาง (web push ฝ่ายขาย+ผู้บริหาร + LINE กลุ่มทีมขาย) — best-effort
  await fetch("/api/notify/milestone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: opts.title, body: opts.message, url }),
  }).catch(() => {});
}
