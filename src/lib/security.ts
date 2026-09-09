import { supabase } from "./supabase";

const SID_KEY = "wv_sid";

export type AuditAction = "login" | "logout" | "password_change" | "session_kick" | "export" | "reveal" | "view";

/** บันทึก access log (ยิงไป API เพื่อเก็บ IP ฝั่ง server) — ไม่ throw */
export async function logAccess(action: AuditAction, meta?: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/winvote/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, meta }),
      keepalive: true,
    });
  } catch { /* เงียบ */ }
}

function newSid(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

/** ลงทะเบียนเซสชันใหม่ (ล็อกอินใหม่ = แทนที่ของเดิม -> เตะเครื่องเก่าออก) */
export async function registerSession(userId: string, email: string | null): Promise<string> {
  const sid = newSid();
  try { localStorage.setItem(SID_KEY, sid); } catch { /* */ }
  try {
    await supabase.schema("winvote").from("user_session").upsert(
      { user_id: userId, email, session_id: sid, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch { /* */ }
  return sid;
}

export function localSid(): string | null {
  try { return localStorage.getItem(SID_KEY); } catch { return null; }
}
export function clearLocalSid() {
  try { localStorage.removeItem(SID_KEY); } catch { /* */ }
}

/** ตรวจว่าเซสชันนี้ยังเป็นตัวล่าสุดไหม — false = ถูกล็อกอินที่อื่นแล้ว (คืน true เมื่อเช็กไม่ได้ กันเตะผิด) */
export async function isSessionCurrent(userId: string): Promise<boolean> {
  const mine = localSid();
  if (!mine) return true;
  try {
    const { data, error } = await supabase.schema("winvote").from("user_session")
      .select("session_id").eq("user_id", userId).maybeSingle();
    if (error || !data) return true;
    return data.session_id === mine;
  } catch { return true; }
}
