// ===== ระบบสมาชิก ทีมโคราชชาติพัฒนา (CPN) =====
// แยกเป็น 6 พื้นที่ · ยืนยันตัวตนจริงเพื่อรับสิทธิประโยชน์ · สื่อสารแอดมิน↔สมาชิก
// สาธารณะ (สมัคร/พอร์ทัลสมาชิก) เรียกผ่าน RPC SECURITY DEFINER (invite-gated) — ไม่ต้องใช้ service key
// แอดมิน (ล็อกอิน) เรียกตารางตรงผ่าน RLS winvote.is_admin()
import { supabase } from "./supabase";

const wv = () => supabase.schema("winvote");

// ---- พื้นที่ 6 เขต ----
export const CPN_AREAS: { code: number; name: string; short: string }[] = [
  { code: 1, name: "เทศบาลนครเขต 1", short: "ทน.เขต 1" },
  { code: 2, name: "เทศบาลนครเขต 2", short: "ทน.เขต 2" },
  { code: 3, name: "เทศบาลนครเขต 3", short: "ทน.เขต 3" },
  { code: 4, name: "เทศบาลนครเขต 4", short: "ทน.เขต 4" },
  { code: 5, name: "ตำบลหนองไผ่ล้อม", short: "ต.หนองไผ่ล้อม" },
  { code: 6, name: "ตำบลโพธิ์กลาง", short: "ต.โพธิ์กลาง" },
];
export const areaName = (code: number | null | undefined) =>
  CPN_AREAS.find((a) => a.code === code)?.name ?? (code == null ? "ไม่ระบุพื้นที่" : `พื้นที่ ${code}`);
export const areaShort = (code: number | null | undefined) =>
  CPN_AREAS.find((a) => a.code === code)?.short ?? (code == null ? "ไม่ระบุ" : `#${code}`);

export const BENEFIT_CATEGORIES: { key: string; label: string }[] = [
  { key: "training", label: "อบรม/สัมมนา" },
  { key: "goods", label: "รับสิ่งของ" },
  { key: "travel", label: "ท่องเที่ยว/ศึกษาดูงาน" },
  { key: "other", label: "อื่นๆ" },
];
export const benefitCategoryLabel = (k: string) =>
  BENEFIT_CATEGORIES.find((c) => c.key === k)?.label ?? k;

export type MemberStatus = "pending" | "verified" | "rejected" | "suspended";
export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  pending: "รอยืนยัน",
  verified: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  suspended: "ระงับ",
};

// ---- Types ----
export interface CpnMember {
  id: string;
  member_code: string;
  full_name: string;
  national_id_last4: string | null;
  phone: string | null;
  phone_verified: boolean;
  birth_year: number | null;
  area_code: number | null;
  community: string | null;
  address: string | null;
  selfie_path: string | null;
  capture_lat: number | null;
  capture_lng: number | null;
  id_verify_method: "chip" | "ocr" | "manual" | "none";
  roll_status: "in_unit" | "other_unit" | "not_found" | null;
  trust_score: number;
  status: MemberStatus;
  status_reason: string | null;
  registered_via: "self" | "staff" | string;
  registered_by: string | null;
  invite_id: string | null;
  consent_pdpa: boolean;
  created_at: string;
  verified_at: string | null;
}

export interface MemberInvite {
  id: string;
  code: string;
  area_code: number | null;
  label: string | null;
  created_by: string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface Benefit {
  id: string;
  title: string;
  category: string;
  description: string | null;
  quota: number | null;
  area_scope: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  area_scope: number | null;
  audience: "all" | "verified" | "area" | string;
  created_by: string | null;
  published: boolean;
  created_at: string;
}

export interface MemberMessage {
  id: string;
  member_id: string;
  sender: "admin" | "member" | string;
  body: string;
  read: boolean;
  by_user: string | null;
  at: string;
}

// ---- Trust score (คำนวณสด — ไม่พึ่งค่าเก่าใน DB) ----
export function memberTrust(m: Pick<CpnMember,
  "consent_pdpa" | "phone_verified" | "id_verify_method" | "roll_status" | "selfie_path">): number {
  let s = 10; // มีระเบียนในระบบ
  if (m.consent_pdpa) s += 10;
  if (m.phone_verified) s += 15;
  if (m.id_verify_method === "chip") s += 35;
  else if (m.id_verify_method === "ocr") s += 20;
  else if (m.id_verify_method === "manual") s += 15;
  if (m.roll_status === "in_unit") s += 20;
  else if (m.roll_status === "other_unit") s += 10;
  if (m.selfie_path) s += 10;
  return Math.min(100, s);
}

// ---- Hash เลขบัตร (ทำที่เครื่องผู้ใช้ — เลขบัตรดิบไม่ออกจากเครื่อง) ----
// ใช้ pepper ระดับแอปเพื่อกัน rainbow table ทั่วไป (ข้อจำกัด: pepper อยู่ใน client JS
// จึงไม่กันกรณีผู้มีสิทธิ์เข้าถึงทั้งโค้ดและ DB — โปรดักชันควรย้าย pepper ไป server secret)
const ID_PEPPER = "cpn-winvote-2568-korat";
export async function hashNationalId(id: string): Promise<string> {
  const clean = id.replace(/\D/g, "");
  const data = new TextEncoder().encode(`${ID_PEPPER}:${clean}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =====================================================================
// สาธารณะ (anon) — ผ่าน RPC
// =====================================================================
export interface InviteInfo { valid: boolean; area_code?: number | null; label?: string | null; reason?: string }
export async function validateInvite(code: string): Promise<InviteInfo> {
  const { data, error } = await wv().rpc("validate_invite", { p_code: code.trim() });
  if (error) return { valid: false, reason: "ตรวจสอบรหัสเชิญไม่สำเร็จ" };
  return data as InviteInfo;
}

export interface RegisterInput {
  code: string;
  national_id: string;      // เลขบัตรดิบ — จะถูก hash ที่เครื่องนี้ ไม่ส่งดิบ
  full_name: string;
  birth_year?: number | null;
  phone?: string | null;
  area_code?: number | null;
  community?: string | null;
  address?: string | null;
  consent: boolean;
}
export interface RegisterResult { ok: boolean; member_code?: string; reason?: string; duplicate?: boolean }
export async function registerMember(input: RegisterInput): Promise<RegisterResult> {
  const clean = input.national_id.replace(/\D/g, "");
  const hash = await hashNationalId(clean);
  const last4 = clean.slice(-4);
  const { data, error } = await wv().rpc("register_member", {
    p_code: input.code.trim(),
    p_national_id_hash: hash,
    p_last4: last4,
    p_full_name: input.full_name.trim(),
    p_birth_year: input.birth_year ?? null,
    p_phone: input.phone?.trim() || null,
    p_area_code: input.area_code ?? null,
    p_community: input.community?.trim() || null,
    p_address: input.address?.trim() || null,
    p_consent: input.consent,
  });
  if (error) return { ok: false, reason: "สมัครไม่สำเร็จ กรุณาลองใหม่" };
  return data as RegisterResult;
}

export interface PortalData {
  ok: boolean;
  reason?: string;
  member?: {
    member_code: string; full_name: string; status: MemberStatus;
    area_code: number | null; community: string | null; trust_score: number;
    phone_verified: boolean; verified_at: string | null;
  };
  announcements?: { title: string; body: string; at: string }[];
  benefits?: { title: string; category: string; description: string | null }[];
  messages?: { sender: string; body: string; at: string }[];
}
export async function memberPortal(code: string, last4: string): Promise<PortalData> {
  const { data, error } = await wv().rpc("member_portal", { p_code: code.trim(), p_last4: last4.trim() });
  if (error) return { ok: false, reason: "เข้าสู่ระบบสมาชิกไม่สำเร็จ" };
  return data as PortalData;
}
export async function memberSend(code: string, last4: string, body: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await wv().rpc("member_send", { p_code: code.trim(), p_last4: last4.trim(), p_body: body });
  if (error) return { ok: false, reason: "ส่งข้อความไม่สำเร็จ" };
  return data as { ok: boolean; reason?: string };
}

// =====================================================================
// แอดมิน (authenticated) — เรียกตารางตรงผ่าน RLS
// =====================================================================
function logErr(where: string, error: unknown) {
  if (error) console.error(`[members] ${where}:`, (error as { message?: string })?.message ?? error);
}

export async function listMembers(opts?: { area?: number | null; status?: MemberStatus | "all"; search?: string }) {
  let q = wv().from("cpn_members").select("*").order("created_at", { ascending: false });
  if (opts?.area != null) q = q.eq("area_code", opts.area);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  const { data, error } = await q;
  logErr("listMembers", error);
  let rows = (data ?? []) as CpnMember[];
  if (opts?.search?.trim()) {
    const s = opts.search.trim().toLowerCase();
    rows = rows.filter((m) =>
      m.full_name.toLowerCase().includes(s) ||
      m.member_code.toLowerCase().includes(s) ||
      (m.phone ?? "").includes(s));
  }
  return rows;
}

export async function memberStats() {
  const { data, error } = await wv().from("cpn_members").select("area_code,status");
  logErr("memberStats", error);
  const rows = (data ?? []) as { area_code: number | null; status: MemberStatus }[];
  const byStatus: Record<string, number> = { pending: 0, verified: 0, rejected: 0, suspended: 0 };
  const byArea = new Map<number, { total: number; verified: number }>();
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.area_code != null) {
      const a = byArea.get(r.area_code) ?? { total: 0, verified: 0 };
      a.total++; if (r.status === "verified") a.verified++;
      byArea.set(r.area_code, a);
    }
  }
  return { total: rows.length, byStatus, byArea };
}

export async function setMemberStatus(id: string, status: MemberStatus, opts?: {
  reason?: string; id_verify_method?: CpnMember["id_verify_method"]; roll_status?: CpnMember["roll_status"];
  trust_score?: number; by?: string;
}) {
  const patch: Record<string, unknown> = { status, status_reason: opts?.reason ?? null };
  if (status === "verified") patch.verified_at = new Date().toISOString();
  if (opts?.id_verify_method) patch.id_verify_method = opts.id_verify_method;
  if (opts?.roll_status !== undefined) patch.roll_status = opts.roll_status;
  if (opts?.trust_score !== undefined) patch.trust_score = opts.trust_score;
  const { error } = await wv().from("cpn_members").update(patch).eq("id", id);
  logErr("setMemberStatus", error);
  return !error;
}

export interface StaffRegisterInput {
  full_name: string; national_id: string; birth_year?: number | null; phone?: string | null;
  area_code: number | null; community?: string | null; address?: string | null;
  id_verify_method: CpnMember["id_verify_method"]; verified: boolean; by: string;
}
export async function staffRegisterMember(input: StaffRegisterInput): Promise<{ ok: boolean; member_code?: string; reason?: string }> {
  const clean = input.national_id.replace(/\D/g, "");
  const hash = await hashNationalId(clean);
  const code = `CPN${input.area_code ?? 0}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const trust = memberTrust({
    consent_pdpa: true, phone_verified: false, id_verify_method: input.id_verify_method,
    roll_status: null, selfie_path: null,
  });
  const { error } = await wv().from("cpn_members").insert({
    member_code: code,
    full_name: input.full_name.trim(),
    national_id_hash: hash,
    national_id_last4: clean.slice(-4),
    phone: input.phone?.trim() || null,
    birth_year: input.birth_year ?? null,
    area_code: input.area_code,
    community: input.community?.trim() || null,
    address: input.address?.trim() || null,
    id_verify_method: input.id_verify_method,
    status: input.verified ? "verified" : "pending",
    verified_at: input.verified ? new Date().toISOString() : null,
    registered_via: "staff",
    registered_by: input.by,
    consent_pdpa: true,
    trust_score: trust,
  });
  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return { ok: false, reason: dup ? "เลขบัตรนี้เคยลงทะเบียนแล้ว" : "บันทึกไม่สำเร็จ" };
  }
  return { ok: true, member_code: code };
}

// ---- Invites ----
export async function listInvites() {
  const { data, error } = await wv().from("member_invites").select("*").order("created_at", { ascending: false });
  logErr("listInvites", error);
  return (data ?? []) as MemberInvite[];
}
export async function createInvite(input: { area_code: number | null; label: string; max_uses: number | null; expires_at: string | null; by: string }) {
  const code = input.label && /^[A-Z0-9-]{4,}$/.test(input.label.toUpperCase().replace(/\s+/g, "-"))
    ? input.label.toUpperCase().replace(/\s+/g, "-")
    : `CPN-${(input.area_code ?? 0)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const { data, error } = await wv().from("member_invites").insert({
    code, area_code: input.area_code, label: input.label || null,
    max_uses: input.max_uses, expires_at: input.expires_at, created_by: input.by, active: true,
  }).select().maybeSingle();
  if (error) return { ok: false as const, reason: /duplicate|unique/i.test(error.message) ? "รหัสนี้มีอยู่แล้ว" : "สร้างไม่สำเร็จ" };
  return { ok: true as const, invite: data as MemberInvite };
}
export async function toggleInvite(id: string, active: boolean) {
  const { error } = await wv().from("member_invites").update({ active }).eq("id", id);
  logErr("toggleInvite", error);
  return !error;
}

// ---- Benefits ----
export async function listBenefits() {
  const { data, error } = await wv().from("benefits").select("*").order("created_at", { ascending: false });
  logErr("listBenefits", error);
  return (data ?? []) as Benefit[];
}
export async function createBenefit(input: { title: string; category: string; description: string; quota: number | null; area_scope: number | null; by: string }) {
  const { error } = await wv().from("benefits").insert({
    title: input.title.trim(), category: input.category, description: input.description.trim() || null,
    quota: input.quota, area_scope: input.area_scope, active: true,
  });
  logErr("createBenefit", error);
  return !error;
}
export async function toggleBenefit(id: string, active: boolean) {
  const { error } = await wv().from("benefits").update({ active }).eq("id", id);
  logErr("toggleBenefit", error);
  return !error;
}

// ---- Announcements ----
export async function listAnnouncements() {
  const { data, error } = await wv().from("announcements").select("*").order("created_at", { ascending: false });
  logErr("listAnnouncements", error);
  return (data ?? []) as Announcement[];
}
export async function createAnnouncement(input: { title: string; body: string; area_scope: number | null; audience: string; by: string; published: boolean }) {
  const { error } = await wv().from("announcements").insert({
    title: input.title.trim(), body: input.body.trim(), area_scope: input.area_scope,
    audience: input.audience, created_by: input.by, published: input.published,
  });
  logErr("createAnnouncement", error);
  return !error;
}
export async function toggleAnnouncement(id: string, published: boolean) {
  const { error } = await wv().from("announcements").update({ published }).eq("id", id);
  logErr("toggleAnnouncement", error);
  return !error;
}

// ---- Messages (admin side) ----
export async function listMemberMessages(memberId: string) {
  const { data, error } = await wv().from("member_messages").select("*").eq("member_id", memberId).order("at", { ascending: true });
  logErr("listMemberMessages", error);
  return (data ?? []) as MemberMessage[];
}
export async function adminSendMessage(memberId: string, body: string, by: string) {
  const { error } = await wv().from("member_messages").insert({ member_id: memberId, sender: "admin", body: body.trim(), by_user: by });
  logErr("adminSendMessage", error);
  return !error;
}
export async function markMessagesRead(memberId: string) {
  const { error } = await wv().from("member_messages").update({ read: true }).eq("member_id", memberId).eq("sender", "member");
  logErr("markMessagesRead", error);
  return !error;
}
