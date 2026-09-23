"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import clsx from "clsx";
import {
  Users, Ticket, Gift, Megaphone, Search, Plus, X, ShieldCheck, ShieldX, Clock,
  Copy, QrCode, Power, Send, Loader2, CheckCircle2, UserCheck, MessageSquare, ScanLine,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import IdCardCapture, { type ExtractedIdFields } from "@/components/IdCardCapture";
import ChipCardReader from "@/components/ChipCardReader";
import { type ChipIdFields } from "@/lib/thai-id-reader";
import { type ToastType } from "@/components/Toast";
import { validateThaiId } from "@/lib/winvote";
import type { AppUser } from "@/lib/user-context";
import {
  CPN_AREAS, areaName, areaShort, MEMBER_STATUS_LABEL, BENEFIT_CATEGORIES, benefitCategoryLabel, memberTrust,
  listMembers, memberStats, setMemberStatus, staffRegisterMember,
  listInvites, createInvite, toggleInvite,
  listBenefits, createBenefit, toggleBenefit,
  listAnnouncements, createAnnouncement, toggleAnnouncement,
  listMemberMessages, adminSendMessage, markMessagesRead,
  type CpnMember, type MemberInvite, type Benefit, type Announcement, type MemberMessage, type MemberStatus,
} from "@/lib/members";

type Sub = "members" | "invites" | "benefits" | "announce";

const inputCls = "w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60";

export default function MemberAdmin({ user, showToast }: { user: AppUser | null; showToast: (m: string, t?: ToastType) => void }) {
  const [sub, setSub] = useState<Sub>("members");

  // scoping: exec เห็นทุกพื้นที่ · อื่นๆ เห็นเฉพาะพื้นที่ตัวเอง (จาก email/department)
  const allowedArea = useMemo<number | null>(() => {
    if (!user) return null;
    const role = (user.role || "").toLowerCase();
    if (user.isAdmin || ["admin", "exec", "ceo", "director", "staff_senior"].includes(role)) return null;
    const m = (user.email || "").match(/district(\d)/) || (user.department || "").match(/(\d)/);
    const n = m ? Number(m[1]) : NaN;
    return n >= 1 && n <= 6 ? n : null;
  }, [user]);

  const by = user?.full_name ?? user?.email ?? "admin";

  return (
    <>
      <div className="flex gap-1 bg-aviva-card rounded-2xl p-1">
        {([
          ["members", "สมาชิก", Users],
          ["invites", "เชิญ/QR", Ticket],
          ["benefits", "สิทธิ", Gift],
          ["announce", "ประกาศ", Megaphone],
        ] as [Sub, string, typeof Users][]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setSub(key)}
            className={clsx("flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium transition-all",
              sub === key ? "bg-aviva-gold text-aviva-bg" : "text-aviva-secondary")}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {sub === "members" && <MembersPanel allowedArea={allowedArea} by={by} showToast={showToast} />}
        {sub === "invites" && <InvitesPanel allowedArea={allowedArea} by={by} showToast={showToast} />}
        {sub === "benefits" && <BenefitsPanel allowedArea={allowedArea} by={by} showToast={showToast} />}
        {sub === "announce" && <AnnouncePanel allowedArea={allowedArea} by={by} showToast={showToast} />}
      </div>
    </>
  );
}

// =====================================================================
// สมาชิก
// =====================================================================
function MembersPanel({ allowedArea, by, showToast }: { allowedArea: number | null; by: string; showToast: (m: string, t?: ToastType) => void }) {
  const [area, setArea] = useState<number | "all">(allowedArea ?? "all");
  const [status, setStatus] = useState<MemberStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CpnMember[]>([]);
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number>; byArea: Map<number, { total: number; verified: number }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CpnMember | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, s] = await Promise.all([
      listMembers({ area: area === "all" ? (allowedArea ?? undefined) : area, status, search }),
      memberStats(),
    ]);
    setRows(r); setStats(s); setLoading(false);
  }, [area, status, search, allowedArea]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      {stats && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat label="ทั้งหมด" value={stats.total} />
          <Stat label="ยืนยันแล้ว" value={stats.byStatus.verified ?? 0} tone="green" />
          <Stat label="รอยืนยัน" value={stats.byStatus.pending ?? 0} tone="gold" />
          <Stat label="ปฏิเสธ" value={stats.byStatus.rejected ?? 0} tone="red" />
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex items-center gap-2 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3">
          <Search size={15} className="text-aviva-secondary/60" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ/รหัส/เบอร์"
            className="flex-1 bg-transparent py-2.5 text-sm text-aviva-text outline-none placeholder:text-aviva-secondary/40" />
        </div>
        <button onClick={() => setShowAdd(true)}
          className="shrink-0 flex items-center gap-1 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2.5 rounded-xl">
          <Plus size={14} /> ลงทะเบียน
        </button>
      </div>

      {allowedArea == null && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-1">
          <Chip active={area === "all"} onClick={() => setArea("all")} label="ทุกพื้นที่" />
          {CPN_AREAS.map((a) => <Chip key={a.code} active={area === a.code} onClick={() => setArea(a.code)} label={a.short} />)}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
        {(["all", "pending", "verified", "rejected", "suspended"] as const).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}
            label={s === "all" ? "ทุกสถานะ" : MEMBER_STATUS_LABEL[s]} />
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-aviva-card/60 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyCard text="ยังไม่มีสมาชิกตามเงื่อนไขนี้" />
      ) : (
        <div className="space-y-2">
          {rows.map((m) => <MemberRow key={m.id} m={m} onClick={() => setDetail(m)} />)}
        </div>
      )}

      {detail && (
        <MemberDetail member={detail} by={by} onClose={() => setDetail(null)}
          onChanged={async () => { await load(); }} showToast={showToast} />
      )}
      {showAdd && (
        <StaffRegisterModal allowedArea={allowedArea} by={by}
          onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await load(); showToast("ลงทะเบียนสมาชิกสำเร็จ"); }}
          showToast={showToast} />
      )}
    </>
  );
}

function MemberRow({ m, onClick }: { m: CpnMember; onClick: () => void }) {
  const S = STATUS_TONE[m.status];
  return (
    <GlassCard className="p-3.5 cursor-pointer active:scale-[0.99]" onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-aviva-text truncate">{m.full_name}</p>
          <p className="text-[11px] text-aviva-secondary font-mono">{m.member_code} · {areaShort(m.area_code)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", S.cls)}>{MEMBER_STATUS_LABEL[m.status]}</span>
          <span className="text-[10px] text-aviva-secondary">เชื่อถือ {m.trust_score}</span>
        </div>
      </div>
    </GlassCard>
  );
}

function MemberDetail({ member, by, onClose, onChanged, showToast }: {
  member: CpnMember; by: string; onClose: () => void; onChanged: () => Promise<void>; showToast: (m: string, t?: ToastType) => void;
}) {
  const [m, setM] = useState(member);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<CpnMember["id_verify_method"]>(member.id_verify_method === "none" ? "manual" : member.id_verify_method);
  const [msgs, setMsgs] = useState<MemberMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadMsgs = useCallback(async () => {
    const list = await listMemberMessages(m.id);
    setMsgs(list);
    await markMessagesRead(m.id);
  }, [m.id]);
  useEffect(() => { void loadMsgs(); }, [loadMsgs]);

  async function verify() {
    setBusy(true);
    const trust = memberTrust({ consent_pdpa: m.consent_pdpa, phone_verified: m.phone_verified, id_verify_method: method, roll_status: m.roll_status, selfie_path: m.selfie_path });
    const ok = await setMemberStatus(m.id, "verified", { id_verify_method: method, trust_score: trust, by });
    setBusy(false);
    if (ok) { setM({ ...m, status: "verified", id_verify_method: method, trust_score: trust, verified_at: new Date().toISOString() }); await onChanged(); showToast("ยืนยันสมาชิกสำเร็จ"); }
    else showToast("ยืนยันไม่สำเร็จ", "error");
  }
  async function reject() {
    setBusy(true);
    const ok = await setMemberStatus(m.id, "rejected", { reason: "ไม่ผ่านการตรวจสอบ", by });
    setBusy(false);
    if (ok) { setM({ ...m, status: "rejected" }); await onChanged(); showToast("ปฏิเสธสมาชิกแล้ว", "info"); }
  }
  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    const ok = await adminSendMessage(m.id, reply.trim(), by);
    setSending(false);
    if (ok) { setReply(""); await loadMsgs(); } else showToast("ส่งไม่สำเร็จ", "error");
  }

  return (
    <ModalShell title="รายละเอียดสมาชิก" onClose={onClose}>
      <div className="rounded-2xl bg-aviva-bg border border-aviva-gold/15 p-4">
        <p className="text-base font-bold text-aviva-text">{m.full_name}</p>
        <p className="text-[12px] text-aviva-secondary font-mono">{m.member_code}</p>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 mt-3 text-[12px]">
          <KV k="พื้นที่" v={areaName(m.area_code)} />
          <KV k="ชุมชน" v={m.community || "-"} />
          <KV k="เบอร์" v={m.phone ? `${m.phone}${m.phone_verified ? " ✓" : ""}` : "-"} />
          <KV k="ปีเกิด" v={m.birth_year ? String(m.birth_year) : "-"} />
          <KV k="เลขบัตร (4 ท้าย)" v={m.national_id_last4 ? `xxxx-${m.national_id_last4}` : "-"} />
          <KV k="สมัครโดย" v={m.registered_via === "self" ? "สมาชิกเอง" : `เจ้าหน้าที่${m.registered_by ? ` (${m.registered_by})` : ""}`} />
          <KV k="ความน่าเชื่อถือ" v={String(m.trust_score)} />
          <KV k="สถานะ" v={MEMBER_STATUS_LABEL[m.status]} />
        </div>
      </div>

      {m.status !== "verified" && m.status !== "rejected" && (
        <div className="mt-3">
          <label className="text-xs text-aviva-secondary mb-1 block">วิธียืนยันตัวตน</label>
          <div className="flex gap-1.5">
            {(["chip", "ocr", "manual"] as const).map((v) => (
              <button key={v} onClick={() => setMethod(v)}
                className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border",
                  method === v ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "border-aviva-gold/20 text-aviva-secondary")}>
                {v === "chip" ? "ชิปบัตร" : v === "ocr" ? "ถ่ายบัตร" : "ตรวจเอกสาร"}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={verify} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-500/15 text-green-400 border border-green-500/30 font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              <ShieldCheck size={16} /> ยืนยันสมาชิก
            </button>
            <button onClick={reject} disabled={busy}
              className="flex items-center justify-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/25 font-semibold py-3 px-4 rounded-xl text-sm disabled:opacity-50">
              <ShieldX size={16} /> ปฏิเสธ
            </button>
          </div>
        </div>
      )}
      {m.status === "verified" && (
        <div className="mt-3 flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-xl p-3 text-green-400 text-sm">
          <CheckCircle2 size={16} /> ยืนยันตัวตนแล้ว {m.verified_at ? `· ${new Date(m.verified_at).toLocaleDateString("th-TH")}` : ""}
        </div>
      )}

      {/* แชท 1:1 */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageSquare size={15} className="text-aviva-gold" />
          <h3 className="text-sm font-bold text-aviva-text">สนทนากับสมาชิก</h3>
        </div>
        <div className="border border-aviva-gold/15 rounded-xl p-3 max-h-56 overflow-y-auto space-y-2 bg-aviva-bg">
          {msgs.length === 0 ? (
            <p className="text-[12px] text-aviva-secondary/60 text-center py-2">ยังไม่มีข้อความ</p>
          ) : msgs.map((x) => (
            <div key={x.id} className={clsx("flex", x.sender === "admin" ? "justify-end" : "justify-start")}>
              <div className={clsx("max-w-[80%] rounded-2xl px-3 py-2 text-[13px]",
                x.sender === "admin" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-text border border-aviva-gold/10")}>
                <p className="whitespace-pre-wrap">{x.body}</p>
                <p className={clsx("text-[10px] mt-0.5", x.sender === "admin" ? "text-aviva-bg/60" : "text-aviva-secondary")}>
                  {new Date(x.at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
            className={inputCls} placeholder="ตอบกลับสมาชิก..." />
          <button onClick={sendReply} disabled={sending || !reply.trim()}
            className="shrink-0 bg-aviva-gold text-aviva-bg px-4 rounded-xl disabled:opacity-50 flex items-center">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function StaffRegisterModal({ allowedArea, by, onClose, onSaved, showToast }: {
  allowedArea: number | null; by: string; onClose: () => void; onSaved: () => void; showToast: (m: string, t?: ToastType) => void;
}) {
  const [form, setForm] = useState({ national_id: "", full_name: "", birth_year: "", phone: "", area_code: allowedArea ? String(allowedArea) : "", community: "", address: "" });
  const [method, setMethod] = useState<CpnMember["id_verify_method"]>("manual");
  const [verified, setVerified] = useState(true);
  const [saving, setSaving] = useState(false);

  const fill = (f: { national_id: string | null; full_name: string | null; date_of_birth: string | null; address: string | null }) => {
    setForm((p) => ({
      ...p,
      national_id: f.national_id ?? p.national_id,
      full_name: f.full_name ?? p.full_name,
      birth_year: f.date_of_birth ? String(Number(f.date_of_birth.slice(0, 4)) + 543) : p.birth_year,
      address: f.address ?? p.address,
    }));
  };
  const onOcr = (f: ExtractedIdFields) => { fill(f); setMethod("ocr"); showToast("อ่านบัตรแล้ว ตรวจสอบก่อนบันทึก", "info"); };
  const onChip = (f: ChipIdFields) => { fill(f); setMethod("chip"); showToast("อ่านชิปบัตรสำเร็จ", "success"); };

  const idValid = form.national_id === "" || validateThaiId(form.national_id);

  async function save() {
    if (!validateThaiId(form.national_id)) { showToast("เลขบัตรไม่ถูกต้อง", "error"); return; }
    if (form.full_name.trim().length < 3) { showToast("กรอกชื่อให้ครบ", "warning"); return; }
    if (!form.area_code) { showToast("เลือกพื้นที่", "warning"); return; }
    setSaving(true);
    const res = await staffRegisterMember({
      full_name: form.full_name, national_id: form.national_id,
      birth_year: form.birth_year ? Number(form.birth_year) : null, phone: form.phone,
      area_code: Number(form.area_code), community: form.community, address: form.address,
      id_verify_method: method, verified, by,
    });
    setSaving(false);
    if (!res.ok) { showToast(res.reason ?? "บันทึกไม่สำเร็จ", "error"); return; }
    onSaved();
  }

  return (
    <ModalShell title="ลงทะเบียนสมาชิก (โดยเจ้าหน้าที่)" onClose={onClose}>
      <ChipCardReader onExtracted={onChip} onError={(m) => showToast(m, "error")} />
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-aviva-gold/10" /><span className="text-[11px] text-aviva-secondary/60">หรือ</span><div className="flex-1 h-px bg-aviva-gold/10" />
      </div>
      <IdCardCapture onExtracted={onOcr} onError={(m) => showToast(m, "error")} />
      {method !== "manual" && <p className="text-[11px] text-green-400 flex items-center gap-1"><ScanLine size={11} /> อ่านจาก{method === "chip" ? "ชิปบัตร" : "รูปบัตร"}แล้ว</p>}

      <Field label="เลขบัตรประชาชน *">
        <input value={form.national_id} inputMode="numeric"
          onChange={(e) => setForm({ ...form, national_id: e.target.value.replace(/\D/g, "").slice(0, 13) })}
          className={clsx(inputCls, "font-mono", !idValid && "border-red-500/60")} placeholder="13 หลัก" />
        {!idValid && <p className="text-[11px] text-red-400 mt-1">เลขบัตรไม่ถูกต้อง</p>}
      </Field>
      <Field label="ชื่อ-นามสกุล *">
        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="ปีเกิด (พ.ศ.)">
          <input value={form.birth_year} inputMode="numeric" onChange={(e) => setForm({ ...form, birth_year: e.target.value.replace(/\D/g, "").slice(0, 4) })} className={inputCls} placeholder="2530" />
        </Field>
        <Field label="เบอร์โทร">
          <input value={form.phone} inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="08x-xxx-xxxx" />
        </Field>
      </div>
      <Field label="พื้นที่/เขต *">
        <select value={form.area_code} onChange={(e) => setForm({ ...form, area_code: e.target.value })} disabled={allowedArea != null}
          className={clsx(inputCls, allowedArea != null && "opacity-70")}>
          <option value="">- เลือกพื้นที่ -</option>
          {CPN_AREAS.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="ชุมชน/หมู่บ้าน">
        <input value={form.community} onChange={(e) => setForm({ ...form, community: e.target.value })} className={inputCls} />
      </Field>
      <Field label="วิธียืนยันตัวตน">
        <div className="flex gap-1.5">
          {(["chip", "ocr", "manual"] as const).map((v) => (
            <button key={v} onClick={() => setMethod(v)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border", method === v ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "border-aviva-gold/20 text-aviva-secondary")}>
              {v === "chip" ? "ชิปบัตร" : v === "ocr" ? "ถ่ายบัตร" : "ตรวจเอกสาร"}
            </button>
          ))}
        </div>
      </Field>
      <label className="flex items-center gap-2 mt-1 cursor-pointer">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="h-4 w-4" />
        <span className="text-[13px] text-aviva-secondary">ยืนยันตัวตนทันที (สมาชิกยืนยันแล้ว)</span>
      </label>

      <button onClick={save} disabled={saving}
        className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 mt-2 flex items-center justify-center gap-2">
        {saving ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><UserCheck size={16} /> ลงทะเบียนสมาชิก</>}
      </button>
    </ModalShell>
  );
}

// =====================================================================
// เชิญ / QR
// =====================================================================
function InvitesPanel({ allowedArea, by, showToast }: { allowedArea: number | null; by: string; showToast: (m: string, t?: ToastType) => void }) {
  const [rows, setRows] = useState<MemberInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [qr, setQr] = useState<{ code: string; url: string; img: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let r = await listInvites();
    if (allowedArea != null) r = r.filter((x) => x.area_code === allowedArea || x.area_code == null);
    setRows(r); setLoading(false);
  }, [allowedArea]);
  useEffect(() => { void load(); }, [load]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkOf = (code: string) => `${origin}/join?invite=${encodeURIComponent(code)}`;

  async function showQr(code: string) {
    const url = linkOf(code);
    const img = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    setQr({ code, url, img });
  }
  function copy(code: string) {
    navigator.clipboard?.writeText(linkOf(code)).then(() => showToast("คัดลอกลิงก์แล้ว")).catch(() => showToast("คัดลอกไม่สำเร็จ", "error"));
  }

  return (
    <>
      <SectionHeader title="รหัสเชิญ / QR" subtitle="แชร์ให้ผู้สมัครผ่านลิงก์หรือ QR code"
        action={<button onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl"><Plus size={14} /> สร้าง</button>} />
      {loading ? (
        <div className="h-24 rounded-2xl bg-aviva-card/60 animate-pulse" />
      ) : rows.length === 0 ? (
        <EmptyCard text="ยังไม่มีรหัสเชิญ กดสร้างเพื่อเริ่ม" />
      ) : (
        <div className="space-y-2">
          {rows.map((iv) => (
            <GlassCard key={iv.id} className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-aviva-text font-mono truncate">{iv.code}</p>
                  <p className="text-[11px] text-aviva-secondary">
                    {iv.area_code != null ? areaShort(iv.area_code) : "ทุกพื้นที่"} · ใช้ {iv.used_count}{iv.max_uses ? `/${iv.max_uses}` : ""} ครั้ง
                    {iv.label ? ` · ${iv.label}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <IconBtn onClick={() => showQr(iv.code)} title="QR"><QrCode size={16} /></IconBtn>
                  <IconBtn onClick={() => copy(iv.code)} title="คัดลอกลิงก์"><Copy size={16} /></IconBtn>
                  <IconBtn onClick={async () => { await toggleInvite(iv.id, !iv.active); await load(); }} title={iv.active ? "ปิด" : "เปิด"}
                    tone={iv.active ? "on" : "off"}><Power size={16} /></IconBtn>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {showAdd && (
        <CreateInviteModal allowedArea={allowedArea} by={by} onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await load(); showToast("สร้างรหัสเชิญสำเร็จ"); }} showToast={showToast} />
      )}
      {qr && (
        <ModalShell title="QR สำหรับสมัคร" onClose={() => setQr(null)}>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.img} alt="QR" className="mx-auto rounded-2xl border border-aviva-gold/20 bg-white p-2" width={240} height={240} />
            <p className="text-sm font-bold text-aviva-text font-mono mt-3">{qr.code}</p>
            <p className="text-[11px] text-aviva-secondary break-all mt-1">{qr.url}</p>
            <button onClick={() => copy(qr.code)} className="mt-3 inline-flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
              <Copy size={15} /> คัดลอกลิงก์
            </button>
          </div>
        </ModalShell>
      )}
    </>
  );
}

function CreateInviteModal({ allowedArea, by, onClose, onSaved, showToast }: {
  allowedArea: number | null; by: string; onClose: () => void; onSaved: () => void; showToast: (m: string, t?: ToastType) => void;
}) {
  const [areaCode, setAreaCode] = useState<string>(allowedArea ? String(allowedArea) : "");
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const expires = days ? new Date(Date.now() + Number(days) * 864e5).toISOString() : null;
    const res = await createInvite({
      area_code: areaCode ? Number(areaCode) : null, label: label.trim(),
      max_uses: maxUses ? Number(maxUses) : null, expires_at: expires, by,
    });
    setSaving(false);
    if (!res.ok) { showToast(res.reason ?? "สร้างไม่สำเร็จ", "error"); return; }
    onSaved();
  }

  return (
    <ModalShell title="สร้างรหัสเชิญ" onClose={onClose}>
      <Field label="พื้นที่/เขต">
        <select value={areaCode} onChange={(e) => setAreaCode(e.target.value)} disabled={allowedArea != null} className={clsx(inputCls, allowedArea != null && "opacity-70")}>
          <option value="">ทุกพื้นที่ (เปิดกว้าง)</option>
          {CPN_AREAS.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="ป้ายกำกับ (เช่น รอบอบรม ต.ค.) — เว้นว่างให้สร้างรหัสอัตโนมัติ">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder="เช่น หัวคะแนนเขต 2" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="จำกัดจำนวนใช้ (เว้นว่าง=ไม่จำกัด)">
          <input value={maxUses} inputMode="numeric" onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))} className={inputCls} placeholder="เช่น 50" />
        </Field>
        <Field label="อายุ (วัน) เว้นว่าง=ไม่หมดอายุ">
          <input value={days} inputMode="numeric" onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} className={inputCls} placeholder="เช่น 30" />
        </Field>
      </div>
      <button onClick={save} disabled={saving} className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 mt-1">
        {saving ? "กำลังสร้าง..." : "สร้างรหัสเชิญ"}
      </button>
    </ModalShell>
  );
}

// =====================================================================
// สิทธิประโยชน์
// =====================================================================
function BenefitsPanel({ allowedArea, by, showToast }: { allowedArea: number | null; by: string; showToast: (m: string, t?: ToastType) => void }) {
  const [rows, setRows] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let r = await listBenefits();
    if (allowedArea != null) r = r.filter((x) => x.area_scope === allowedArea || x.area_scope == null);
    setRows(r); setLoading(false);
  }, [allowedArea]);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <SectionHeader title="สิทธิประโยชน์" subtitle="อบรม · สิ่งของ · ท่องเที่ยว/ดูงาน · อื่นๆ"
        action={<button onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl"><Plus size={14} /> เพิ่ม</button>} />
      {loading ? <div className="h-24 rounded-2xl bg-aviva-card/60 animate-pulse" /> : rows.length === 0 ? (
        <EmptyCard text="ยังไม่มีสิทธิประโยชน์" />
      ) : (
        <div className="space-y-2">
          {rows.map((b) => (
            <GlassCard key={b.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-aviva-text">{b.title}</p>
                  <span className="inline-block text-[10px] bg-aviva-gold/10 text-aviva-gold-soft rounded-full px-2 py-0.5 mt-1">{benefitCategoryLabel(b.category)}</span>
                  <span className="inline-block text-[10px] text-aviva-secondary ml-1">{b.area_scope != null ? areaShort(b.area_scope) : "ทุกพื้นที่"}{b.quota ? ` · โควตา ${b.quota}` : ""}</span>
                  {b.description && <p className="text-[12px] text-aviva-secondary mt-1">{b.description}</p>}
                </div>
                <IconBtn onClick={async () => { await toggleBenefit(b.id, !b.active); await load(); }} tone={b.active ? "on" : "off"} title={b.active ? "ปิด" : "เปิด"}><Power size={16} /></IconBtn>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      {showAdd && <CreateBenefitModal allowedArea={allowedArea} by={by} onClose={() => setShowAdd(false)} onSaved={async () => { setShowAdd(false); await load(); showToast("เพิ่มสิทธิประโยชน์สำเร็จ"); }} showToast={showToast} />}
    </>
  );
}

function CreateBenefitModal({ allowedArea, by, onClose, onSaved, showToast }: {
  allowedArea: number | null; by: string; onClose: () => void; onSaved: () => void; showToast: (m: string, t?: ToastType) => void;
}) {
  const [form, setForm] = useState({ title: "", category: "training", description: "", quota: "", area_scope: allowedArea ? String(allowedArea) : "" });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.title.trim()) { showToast("กรอกชื่อสิทธิประโยชน์", "warning"); return; }
    setSaving(true);
    const ok = await createBenefit({ title: form.title, category: form.category, description: form.description, quota: form.quota ? Number(form.quota) : null, area_scope: form.area_scope ? Number(form.area_scope) : null, by });
    setSaving(false);
    if (!ok) { showToast("บันทึกไม่สำเร็จ", "error"); return; }
    onSaved();
  }
  return (
    <ModalShell title="เพิ่มสิทธิประโยชน์" onClose={onClose}>
      <Field label="ชื่อสิทธิประโยชน์ *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="เช่น อบรมอาชีพเสริม" /></Field>
      <Field label="ประเภท">
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
          {BENEFIT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="รายละเอียด"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={clsx(inputCls, "resize-none")} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="โควตา (เว้นว่าง=ไม่จำกัด)"><input value={form.quota} inputMode="numeric" onChange={(e) => setForm({ ...form, quota: e.target.value.replace(/\D/g, "") })} className={inputCls} /></Field>
        <Field label="พื้นที่">
          <select value={form.area_scope} onChange={(e) => setForm({ ...form, area_scope: e.target.value })} disabled={allowedArea != null} className={clsx(inputCls, allowedArea != null && "opacity-70")}>
            <option value="">ทุกพื้นที่</option>
            {CPN_AREAS.map((a) => <option key={a.code} value={a.code}>{a.short}</option>)}
          </select>
        </Field>
      </div>
      <button onClick={save} disabled={saving} className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 mt-1">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
    </ModalShell>
  );
}

// =====================================================================
// ประกาศ
// =====================================================================
function AnnouncePanel({ allowedArea, by, showToast }: { allowedArea: number | null; by: string; showToast: (m: string, t?: ToastType) => void }) {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let r = await listAnnouncements();
    if (allowedArea != null) r = r.filter((x) => x.area_scope === allowedArea || x.area_scope == null);
    setRows(r); setLoading(false);
  }, [allowedArea]);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <SectionHeader title="ประกาศถึงสมาชิก" subtitle="กระจายข่าวสารตามพื้นที่/กลุ่มเป้าหมาย"
        action={<button onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl"><Plus size={14} /> ประกาศ</button>} />
      {loading ? <div className="h-24 rounded-2xl bg-aviva-card/60 animate-pulse" /> : rows.length === 0 ? (
        <EmptyCard text="ยังไม่มีประกาศ" />
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <GlassCard key={a.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-aviva-text">{a.title}</p>
                  <p className="text-[12px] text-aviva-secondary mt-0.5 whitespace-pre-wrap line-clamp-3">{a.body}</p>
                  <p className="text-[10px] text-aviva-secondary/70 mt-1">
                    {a.area_scope != null ? areaShort(a.area_scope) : "ทุกพื้นที่"} · {a.audience === "verified" ? "เฉพาะยืนยันแล้ว" : "ทุกคน"} · {new Date(a.created_at).toLocaleDateString("th-TH")}
                  </p>
                </div>
                <IconBtn onClick={async () => { await toggleAnnouncement(a.id, !a.published); await load(); }} tone={a.published ? "on" : "off"} title={a.published ? "เผยแพร่อยู่" : "ซ่อน"}><Power size={16} /></IconBtn>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      {showAdd && <CreateAnnounceModal allowedArea={allowedArea} by={by} onClose={() => setShowAdd(false)} onSaved={async () => { setShowAdd(false); await load(); showToast("ประกาศสำเร็จ"); }} showToast={showToast} />}
    </>
  );
}

function CreateAnnounceModal({ allowedArea, by, onClose, onSaved, showToast }: {
  allowedArea: number | null; by: string; onClose: () => void; onSaved: () => void; showToast: (m: string, t?: ToastType) => void;
}) {
  const [form, setForm] = useState({ title: "", body: "", area_scope: allowedArea ? String(allowedArea) : "", audience: "all" });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.title.trim() || !form.body.trim()) { showToast("กรอกหัวข้อและเนื้อหา", "warning"); return; }
    setSaving(true);
    const ok = await createAnnouncement({ title: form.title, body: form.body, area_scope: form.area_scope ? Number(form.area_scope) : null, audience: form.audience, by, published: true });
    setSaving(false);
    if (!ok) { showToast("ประกาศไม่สำเร็จ", "error"); return; }
    onSaved();
  }
  return (
    <ModalShell title="สร้างประกาศ" onClose={onClose}>
      <Field label="หัวข้อ *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} /></Field>
      <Field label="เนื้อหา *"><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className={clsx(inputCls, "resize-none")} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="พื้นที่">
          <select value={form.area_scope} onChange={(e) => setForm({ ...form, area_scope: e.target.value })} disabled={allowedArea != null} className={clsx(inputCls, allowedArea != null && "opacity-70")}>
            <option value="">ทุกพื้นที่</option>
            {CPN_AREAS.map((a) => <option key={a.code} value={a.code}>{a.short}</option>)}
          </select>
        </Field>
        <Field label="กลุ่มเป้าหมาย">
          <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className={inputCls}>
            <option value="all">ทุกคน</option>
            <option value="verified">เฉพาะยืนยันแล้ว</option>
          </select>
        </Field>
      </div>
      <button onClick={save} disabled={saving} className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 mt-1">{saving ? "กำลังประกาศ..." : "ประกาศ"}</button>
    </ModalShell>
  );
}

// =====================================================================
// UI helpers
// =====================================================================
const STATUS_TONE: Record<MemberStatus, { cls: string }> = {
  verified: { cls: "bg-green-500/15 text-green-400" },
  pending: { cls: "bg-amber-400/15 text-amber-300" },
  rejected: { cls: "bg-red-500/15 text-red-400" },
  suspended: { cls: "bg-white/10 text-aviva-secondary" },
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "gold" | "red" }) {
  const c = tone === "green" ? "text-green-400" : tone === "gold" ? "text-amber-300" : tone === "red" ? "text-red-400" : "text-aviva-text";
  return (
    <div className="bg-aviva-card rounded-xl p-2.5 text-center">
      <p className={clsx("text-lg font-extrabold", c)}>{value}</p>
      <p className="text-[10px] text-aviva-secondary">{label}</p>
    </div>
  );
}
function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={clsx("shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium", active ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-secondary")}>{label}</button>
  );
}
function IconBtn({ children, onClick, title, tone }: { children: React.ReactNode; onClick: () => void; title?: string; tone?: "on" | "off" }) {
  return (
    <button onClick={onClick} title={title}
      className={clsx("h-9 w-9 flex items-center justify-center rounded-xl border",
        tone === "on" ? "border-green-500/30 text-green-400 bg-green-500/10"
          : tone === "off" ? "border-aviva-gold/15 text-aviva-secondary/60"
          : "border-aviva-gold/20 text-aviva-gold bg-aviva-gold/5")}>{children}</button>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div><span className="text-aviva-secondary/70">{k}: </span><span className="text-aviva-text font-medium">{v}</span></div>;
}
function EmptyCard({ text }: { text: string }) {
  return <GlassCard className="p-8 text-center"><p className="text-sm text-aviva-secondary">{text}</p></GlassCard>;
}
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-3 mb-14 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between sticky -top-6 bg-aviva-card pt-1 pb-1 z-10">
          <h2 className="text-lg font-bold text-aviva-text">{title}</h2>
          <button onClick={onClose}><X size={20} className="text-aviva-secondary" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-aviva-secondary mb-1 block">{label}</label>{children}</div>;
}
