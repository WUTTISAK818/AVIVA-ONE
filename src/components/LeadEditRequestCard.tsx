"use client";

// การ์ด "คำขอแก้ไขข้อมูลลูกค้า" ในหน้ารายละเอียดลูกค้า (CRM) — v8.12
//  พนักงาน: ยื่นคำขอ (เลือกส่วน + เหตุผล) · ดูสถานะ · แก้ไขในช่วงที่อนุมัติ · ส่งให้ผู้บริหารตรวจ
//  ผู้บริหาร: เห็นว่ามีคำขอค้างอยู่ + ลิงก์ไปตรวจที่หน้าอนุมัติ (ตรวจ/อนุมัติทำที่หน้าอนุมัติที่เดียว)
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import {
  EDIT_GROUPS, EDIT_STATUS_LABEL, OPEN_EDIT_STATUSES, groupLabels, isActiveEdit, isExpiredEdit,
  thaiDateTimeLabel, diffSnapshot, formatEditValue, createEditRequest, cancelEditRequest, submitEditRequest,
  type LeadEditRequest,
} from "@/lib/lead-edit-request";
import { notifyEditExecutives } from "@/lib/lead-edit-notify";

interface Props {
  lead: { id: string; lead_code?: string | null; customer_name: string; status: string };
  /** คำขอทั้งหมดของลูกค้ารายนี้ที่ผู้ใช้มีสิทธิ์เห็น (พนักงาน = ของตัวเอง · ผู้บริหาร = ทุกคน) */
  requests: LeadEditRequest[];
  onOpenEdit: () => void;
  onChanged: () => void;
  notify: (msg: string, type: "success" | "error") => void;
}

export default function LeadEditRequestCard({ lead, requests, onOpenEdit, onChanged, notify }: Props) {
  const user = useCurrentUser();
  const [showForm, setShowForm] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const who = `${lead.lead_code ?? ""} ${lead.customer_name}`.trim();
  const sorted = [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at));

  // ── ผู้บริหาร: แสดงเฉพาะเมื่อมีคำขอค้าง แล้วชี้ไปหน้าอนุมัติ ──
  if (user.isManager) {
    const open = sorted.filter((r) => OPEN_EDIT_STATUSES.includes(r.status));
    if (open.length === 0) return null;
    return (
      <div className="bg-aviva-bg rounded-xl p-3 border border-sky-500/25 col-span-2">
        <p className="text-xs font-bold text-sky-300 mb-1">📝 มีคำขอแก้ไขข้อมูลลูกค้ารายนี้</p>
        {open.map((r) => (
          <p key={r.id} className="text-[11px] text-aviva-secondary leading-relaxed">
            {r.requested_by_name ?? r.requested_by_email} · {EDIT_STATUS_LABEL[r.status]}
            {r.status === "editing" && r.edit_until ? ` ถึง ${thaiDateTimeLabel(r.edit_until)}` : ""}
            {" "}· ส่วน: {groupLabels(r.status === "pending" ? r.requested_groups : r.allowed_groups)}
          </p>
        ))}
        <Link href="/approvals" className="inline-block mt-2 text-[11px] font-bold text-sky-300 underline">ไปตรวจที่หน้าอนุมัติ →</Link>
      </div>
    );
  }

  const mine = sorted.filter((r) => r.requested_by_email.toLowerCase() === user.email.toLowerCase());
  const open = mine.find((r) => OPEN_EDIT_STATUSES.includes(r.status));
  // ผู้เรียกโหลดมาเฉพาะคำขอที่จบภายใน 7 วัน จึงไม่ต้องกรองเวลาซ้ำที่นี่
  const recent = mine.find((r) => !OPEN_EDIT_STATUSES.includes(r.status));
  const actor = { name: user.full_name || user.email, email: user.email, role: user.role, dept: user.department };

  const submitRequest = async () => {
    if (busy) return;
    setBusy(true);
    const res = await createEditRequest(supabase, {
      leadId: lead.id, email: user.email, name: actor.name, groups, reason, role: user.role, dept: user.department,
    });
    if (!res.ok) { setBusy(false); notify(res.reason, "error"); return; }
    await notifyEditExecutives(`📝 ขอแก้ไขข้อมูลลูกค้า — ${who}`,
      `โดย ${actor.name}\nส่วนที่ขอแก้: ${groupLabels(groups)}\nเหตุผล: ${reason.trim()}\nอนุมัติ/กำหนดเวลาได้ที่หน้าอนุมัติ`, lead.id);
    setBusy(false);
    setShowForm(false); setGroups([]); setReason("");
    notify("ส่งคำขอแก้ไขให้ผู้บริหารแล้ว — อนุมัติแล้วจะแจ้งกลับทางกระดิ่ง/LINE", "success");
    onChanged();
  };

  const cancel = async (r: LeadEditRequest) => {
    if (busy || !window.confirm("ยกเลิกคำขอแก้ไขนี้?")) return;
    setBusy(true);
    const res = await cancelEditRequest(supabase, r, actor);
    setBusy(false);
    if (!res.ok) { notify(res.reason, "error"); return; }
    notify("ยกเลิกคำขอแล้ว", "success");
    onChanged();
  };

  const sendForReview = async (r: LeadEditRequest) => {
    if (busy || !window.confirm("ส่งข้อมูลที่แก้ให้ผู้บริหารตรวจ? หลังส่งจะแก้ต่อไม่ได้จนกว่าผู้บริหารตีกลับ")) return;
    setBusy(true);
    const res = await submitEditRequest(supabase, r, { auto: false, by: actor });
    if (!res.ok) { setBusy(false); notify(res.reason, "error"); return; }
    const diff = res.diff ?? [];
    await notifyEditExecutives(`📤 รอตรวจการแก้ไขข้อมูลลูกค้า — ${who}`,
      `${actor.name} แก้เสร็จแล้ว ส่งตรวจ ${diff.length} ช่อง\n` +
      diff.map((d) => `• ${d.label}: ${formatEditValue(d.field, d.before)} → ${formatEditValue(d.field, d.after)}`).join("\n") +
      "\nตรวจได้ที่หน้าอนุมัติ (อนุมัติ / ตีกลับให้แก้ใหม่ / คืนค่าเดิม)", lead.id);
    setBusy(false);
    notify("ส่งให้ผู้บริหารตรวจแล้ว", "success");
    onChanged();
  };

  const toggle = (g: string) => setGroups((cur) => cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]);
  const btn = "flex-1 py-2 text-[11px] font-bold rounded-lg border active:scale-95 disabled:opacity-50";

  return (
    <div className="bg-aviva-bg rounded-xl p-3 border border-sky-500/25 col-span-2">
      <p className="text-xs font-bold text-sky-300 mb-1">📝 ขอแก้ไขข้อมูลลูกค้า</p>

      {open?.status === "pending" && (
        <>
          <p className="text-[11px] text-aviva-secondary leading-relaxed">
            ⏳ {EDIT_STATUS_LABEL.pending} · ส่วนที่ขอ: {groupLabels(open.requested_groups)}
            <br />เหตุผล: {open.reason}
          </p>
          <div className="flex gap-2 mt-2">
            <button disabled={busy} onClick={() => cancel(open)} className={`${btn} bg-aviva-card text-aviva-secondary border-aviva-gold/15`}>ยกเลิกคำขอ</button>
          </div>
        </>
      )}

      {open && isActiveEdit(open) && (
        <>
          <p className="text-[11px] text-sky-200 leading-relaxed">
            🔓 ผู้บริหารอนุมัติให้แก้: <b>{groupLabels(open.allowed_groups)}</b>
            <br />แก้ได้ถึง <b>{thaiDateTimeLabel(open.edit_until)}</b> · ครบเวลาแล้วระบบส่งตรวจให้เอง
            {open.decision_note ? <><br />หมายเหตุผู้บริหาร: {open.decision_note}</> : null}
          </p>
          {open.return_count > 0 && open.review_note && (
            <p className="text-[11px] text-amber-300 leading-relaxed mt-1">↩️ ตีกลับรอบที่ {open.return_count}: {open.review_note}</p>
          )}
          <p className="text-[10px] text-aviva-secondary mt-1">ช่องนอกส่วนที่อนุมัติจะบันทึกไม่ได้ · เปลี่ยนสถานะ/แปลงยังใช้ขั้นตอนเดิม</p>
          <div className="flex gap-2 mt-2">
            <button disabled={busy} onClick={onOpenEdit} className={`${btn} bg-sky-500/15 text-sky-200 border-sky-500/30`}>✏️ แก้ไขข้อมูล</button>
            <button disabled={busy} onClick={() => sendForReview(open)} className={`${btn} bg-aviva-gold/15 text-aviva-gold border-aviva-gold/30`}>📤 ส่งให้ผู้บริหารตรวจ</button>
          </div>
        </>
      )}

      {open && isExpiredEdit(open) && (
        <p className="text-[11px] text-aviva-secondary">⌛ หมดเวลาแก้ไข — ระบบกำลังส่งให้ผู้บริหารตรวจ</p>
      )}

      {open?.status === "submitted" && (
        <>
          <p className="text-[11px] text-aviva-secondary leading-relaxed">
            📤 {EDIT_STATUS_LABEL.submitted}{open.auto_submitted ? " (ระบบส่งเมื่อหมดเวลา)" : ""}
          </p>
          <ul className="mt-1 space-y-0.5">
            {diffSnapshot(open.snapshot, open.after_snapshot).map((d) => (
              <li key={d.field} className="text-[11px] text-aviva-text">• {d.label}: <span className="text-aviva-secondary line-through">{formatEditValue(d.field, d.before)}</span> → <b>{formatEditValue(d.field, d.after)}</b></li>
            ))}
          </ul>
        </>
      )}

      {!open && (
        <>
          {recent && (
            <p className="text-[11px] text-aviva-secondary leading-relaxed mb-1">
              คำขอล่าสุด: <b>{EDIT_STATUS_LABEL[recent.status]}</b>
              {recent.review_note || recent.decision_note ? ` · ${recent.review_note ?? recent.decision_note}` : ""}
            </p>
          )}
          {!showForm ? (
            <>
              <p className="text-[11px] text-aviva-secondary leading-relaxed">
                ข้อมูลที่แก้เองไม่ได้ (เช่น ลูกค้าที่โอนแล้ว · วันจอง/วันโอนย้อนหลัง) หรือใช้งานแล้วติดปัญหา — ยื่นคำขอให้ผู้บริหารเปิดสิทธิ์ แก้เสร็จแล้วส่งกลับให้ตรวจ
              </p>
              <button onClick={() => setShowForm(true)} className={`${btn} w-full mt-2 bg-sky-500/15 text-sky-200 border-sky-500/30`}>📝 ขอแก้ไขข้อมูลลูกค้ารายนี้</button>
            </>
          ) : (
            <div className="space-y-2 mt-1">
              <p className="text-[11px] text-aviva-text font-medium">จะแก้ส่วนไหน (เลือกได้หลายส่วน)</p>
              {EDIT_GROUPS.map((g) => (
                <label key={g.key} className="flex items-start gap-2 text-[11px] text-aviva-text">
                  <input type="checkbox" checked={groups.includes(g.key)} onChange={() => toggle(g.key)} className="mt-0.5" />
                  <span><b>{g.label}</b><br /><span className="text-aviva-secondary">{g.hint}</span></span>
                </label>
              ))}
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="จะแก้อะไร เพราะอะไร เช่น วันโอนจริงคือ 12 ต.ค. 69 แต่ในระบบยังว่าง"
                className="w-full bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/50" />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => setShowForm(false)} className={`${btn} bg-aviva-card text-aviva-secondary border-aviva-gold/15`}>ยกเลิก</button>
                <button disabled={busy || groups.length === 0 || reason.trim().length < 5} onClick={submitRequest}
                  className={`${btn} bg-aviva-gold text-aviva-bg border-aviva-gold`}>{busy ? "กำลังส่ง..." : "ส่งคำขอให้ผู้บริหาร"}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
