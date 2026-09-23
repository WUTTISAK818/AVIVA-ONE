"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck, AlertTriangle, UserPlus, ArrowRight } from "lucide-react";
import { validateThaiId } from "@/lib/winvote";
import {
  validateInvite, registerMember, CPN_AREAS, areaName,
  type InviteInfo,
} from "@/lib/members";

const inputCls =
  "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

function JoinInner() {
  const sp = useSearchParams();
  const initialCode = (sp.get("invite") ?? sp.get("code") ?? "").trim();

  const [code, setCode] = useState(initialCode);
  const [checking, setChecking] = useState(false);
  const [invite, setInvite] = useState<InviteInfo | null>(null);

  const [form, setForm] = useState({
    national_id: "", full_name: "", birth_year: "", phone: "",
    area_code: "" as string, community: "", address: "",
  });
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ member_code: string } | null>(null);

  // ตรวจรหัสเชิญอัตโนมัติเมื่อมากับลิงก์
  useEffect(() => {
    if (initialCode) void checkCode(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  async function checkCode(c: string) {
    if (!c.trim()) return;
    setChecking(true);
    setError(null);
    const res = await validateInvite(c.trim());
    setInvite(res);
    if (res.valid && res.area_code != null) setForm((f) => ({ ...f, area_code: String(res.area_code) }));
    setChecking(false);
  }

  const idValid = form.national_id === "" || validateThaiId(form.national_id);

  async function submit() {
    setError(null);
    if (!consent) { setError("กรุณายินยอมเงื่อนไขการเก็บข้อมูล (PDPA) ก่อนสมัคร"); return; }
    if (!validateThaiId(form.national_id)) { setError("เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)"); return; }
    if (form.full_name.trim().length < 3) { setError("กรุณากรอกชื่อ-นามสกุลให้ครบ"); return; }
    if (!form.area_code) { setError("กรุณาเลือกพื้นที่/เขต"); return; }
    setSaving(true);
    const res = await registerMember({
      code: code.trim(),
      national_id: form.national_id,
      full_name: form.full_name,
      birth_year: form.birth_year ? Number(form.birth_year) : null,
      phone: form.phone,
      area_code: Number(form.area_code),
      community: form.community,
      address: form.address,
      consent,
    });
    setSaving(false);
    if (!res.ok) { setError(res.reason ?? "สมัครไม่สำเร็จ"); return; }
    setDone({ member_code: res.member_code ?? "" });
  }

  // ---------- สำเร็จ ----------
  if (done) {
    return (
      <Shell>
        <div className="text-center py-6">
          <CheckCircle2 size={56} className="text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">สมัครสมาชิกสำเร็จ</h2>
          <p className="text-sm text-slate-500 mt-1">ทีมโคราชชาติพัฒนา (CPN)</p>
          <div className="mt-5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs text-slate-500">รหัสสมาชิกของคุณ</p>
            <p className="text-2xl font-extrabold text-blue-700 tracking-wide font-mono mt-1">{done.member_code}</p>
            <p className="text-[12px] text-slate-500 mt-2">โปรดจดรหัสนี้ไว้ · ใช้เข้าดูสถานะและสิทธิประโยชน์</p>
          </div>
          <div className="mt-4 text-left bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-800">
              สถานะปัจจุบัน: <b>รอการยืนยันตัวตน</b> — เจ้าหน้าที่จะตรวจสอบและยืนยันสมาชิกภาพ
              เพื่อให้คุณได้รับสิทธิประโยชน์เต็มรูปแบบ
            </p>
          </div>
          <Link href={`/m?code=${encodeURIComponent(done.member_code)}`}
            className="mt-5 inline-flex items-center justify-center gap-2 w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl">
            เข้าดูสถานะสมาชิก <ArrowRight size={18} />
          </Link>
        </div>
      </Shell>
    );
  }

  // ---------- ยังไม่มีรหัสเชิญที่ถูกต้อง ----------
  const inviteOk = invite?.valid;

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-1">
        <UserPlus size={22} className="text-blue-600" />
        <h1 className="text-xl font-bold text-slate-900">สมัครสมาชิก CPN</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">ทีมโคราชชาติพัฒนา · ยืนยันตัวตนเพื่อรับสิทธิประโยชน์</p>

      {/* รหัสเชิญ */}
      <label className="text-sm font-medium text-slate-700 mb-1 block">รหัสเชิญ (Invite Code)</label>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => { setCode(e.target.value); setInvite(null); }}
          className={inputCls} placeholder="กรอกรหัสเชิญ เช่น CPN-OPEN-2568" />
        <button onClick={() => checkCode(code)} disabled={checking || !code.trim()}
          className="shrink-0 bg-slate-800 text-white font-semibold px-4 rounded-xl disabled:opacity-50">
          {checking ? <Loader2 size={18} className="animate-spin" /> : "ตรวจสอบ"}
        </button>
      </div>
      {invite && !invite.valid && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {invite.reason}</p>
      )}
      {inviteOk && (
        <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
          <CheckCircle2 size={14} /> รหัสเชิญถูกต้อง
          {invite?.area_code != null ? ` · พื้นที่ ${areaName(invite.area_code)}` : ""}
          {invite?.label ? ` · ${invite.label}` : ""}
        </p>
      )}

      {/* ฟอร์ม — แสดงเมื่อรหัสเชิญผ่าน */}
      {inviteOk && (
        <div className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">เลขบัตรประชาชน *</label>
            <input value={form.national_id} inputMode="numeric"
              onChange={(e) => setForm({ ...form, national_id: e.target.value.replace(/\D/g, "").slice(0, 13) })}
              className={`${inputCls} font-mono ${!idValid ? "border-red-400" : ""}`} placeholder="13 หลัก" />
            {!idValid && <p className="text-xs text-red-600 mt-1">เลขบัตรไม่ถูกต้อง (ตรวจสอบ checksum)</p>}
            <p className="text-[11px] text-slate-400 mt-1">ระบบเก็บเลขบัตรแบบเข้ารหัส (hash) เท่านั้น ไม่เก็บเลขจริง</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">ชื่อ-นามสกุล *</label>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={inputCls} placeholder="เช่น นายสมชาย ใจดี" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">ปีเกิด (พ.ศ.)</label>
              <input value={form.birth_year} inputMode="numeric"
                onChange={(e) => setForm({ ...form, birth_year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className={inputCls} placeholder="เช่น 2530" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">เบอร์โทร</label>
              <input value={form.phone} inputMode="tel"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls} placeholder="08x-xxx-xxxx" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">พื้นที่/เขต *</label>
            <select value={form.area_code} onChange={(e) => setForm({ ...form, area_code: e.target.value })}
              disabled={invite?.area_code != null}
              className={`${inputCls} ${invite?.area_code != null ? "bg-slate-100" : ""}`}>
              <option value="">- เลือกพื้นที่ -</option>
              {CPN_AREAS.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">ชุมชน/หมู่บ้าน</label>
            <input value={form.community} onChange={(e) => setForm({ ...form, community: e.target.value })}
              className={inputCls} placeholder="เช่น ชุมชนหนองบัวรอง" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">ที่อยู่</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2} className={`${inputCls} resize-none`} />
          </div>

          <label className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
            <span className="text-[13px] text-slate-600">
              ข้าพเจ้ายินยอมให้ทีมโคราชชาติพัฒนาเก็บและใช้ข้อมูลส่วนบุคคลข้างต้น
              เพื่อการยืนยันสมาชิกภาพและมอบสิทธิประโยชน์ ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)
            </span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <button onClick={submit} disabled={saving}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl text-base disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={18} className="animate-spin" /> กำลังสมัคร...</> : "สมัครสมาชิก"}
          </button>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/m" className="text-sm text-blue-600 font-medium">เป็นสมาชิกอยู่แล้ว? เข้าดูสถานะ</Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/winvote-logo.png" alt="WinVote" className="h-10 w-10 rounded-lg" />
          <span className="text-lg font-bold text-slate-800">WinVote</span>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">{children}</div>
        <p className="text-center text-[11px] text-slate-400 mt-4">© ทีมโคราชชาติพัฒนา · ระบบสมาชิก</p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <JoinInner />
    </Suspense>
  );
}
