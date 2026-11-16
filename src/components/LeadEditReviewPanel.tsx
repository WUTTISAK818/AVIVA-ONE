"use client";

// แผงผู้บริหาร: คำขอแก้ไขข้อมูลลูกค้า (หน้าอนุมัติ) — v8.12 · Pom สั่ง 16 พ.ย. 69
//  ขั้น 1 (pending)   อนุมัติให้แก้: เลือกส่วนที่แก้ได้ + ระยะเวลา 1/3/7 วัน · หรือไม่อนุมัติ (ต้องมีเหตุผล)
//  ขั้น 2 (submitted) ตรวจค่าเดิม → ค่าใหม่ทีละช่อง แล้วเลือก: อนุมัติ · ตีกลับให้แก้ใหม่ · คืนค่าเดิม
//  ระหว่างแก้ (editing) แสดงให้รู้ว่ากำลังแก้อยู่ถึงเมื่อไร
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";
import {
  EDIT_GROUPS, EDIT_DAYS_OPTIONS, groupLabels, thaiDateTimeLabel, diffSnapshot, formatEditValue, needsAccountingCheck,
  approveEditRequest, rejectEditRequest, approveEditResult, returnEditRequest, revertEditRequest,
  type LeadEditRequest,
} from "@/lib/lead-edit-request";
import { notifyEditRequester, processExpiredEditRequests } from "@/lib/lead-edit-notify";

interface LeadInfo { id: string; lead_code: string | null; customer_name: string | null; status: string | null; plot_number: number | null }

export default function LeadEditReviewPanel() {
  const user = useCurrentUser();
  const [reqs, setReqs] = useState<LeadEditRequest[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadInfo>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ค่าที่ผู้บริหารเลือกต่อคำขอ (ส่วนที่อนุญาต · จำนวนวัน · หมายเหตุ)
  const [pick, setPick] = useState<Record<string, { groups: string[]; days: number; note: string }>>({});

  const myEmail = user?.email ?? "";
  const load = useCallback(async () => {
    const q = () => supabase.from("lead_edit_requests").select("*")
      .in("status", ["pending", "editing", "submitted"]).order("created_at", { ascending: true });
    let { data } = await q();
    let rows = (data ?? []) as LeadEditRequest[];
    if (myEmail && await processExpiredEditRequests(supabase, rows, { email: myEmail, isManager: true }) > 0) {
      ({ data } = await q());
      rows = (data ?? []) as LeadEditRequest[];
    }
    const ids = Array.from(new Set(rows.map((r) => r.lead_id)));
    const map: Record<string, LeadInfo> = {};
    if (ids.length) {
      const { data: ls } = await supabase.from("leads").select("id, lead_code, customer_name, status, plot_number").in("id", ids);
      for (const l of (ls ?? []) as LeadInfo[]) map[l.id] = l;
    }
    setLeads(map);
    setReqs(rows);
  }, [myEmail]);

  useEffect(() => {
    if (!user?.isManager) return;
    let active = true;
    // โหลดแบบ async แล้วค่อย set state (ไม่ set state ตรง ๆ ใน effect)
    Promise.resolve().then(() => { if (active) load(); });
    return () => { active = false; };
  }, [user?.isManager, load]);

  if (!user?.isManager || reqs.length === 0) return null;

  const actor = { name: user.full_name || user.email, email: user.email, role: user.role, dept: user.department };
  const who = (r: LeadEditRequest) => {
    const l = leads[r.lead_id];
    return `${l?.lead_code ?? ""} ${l?.customer_name ?? ""}`.trim() || r.lead_id.slice(0, 8);
  };
  const pickOf = (r: LeadEditRequest) => pick[r.id] ?? { groups: r.requested_groups, days: 3, note: "" };
  const setPickOf = (r: LeadEditRequest, patch: Partial<{ groups: string[]; days: number; note: string }>) =>
    setPick((cur) => ({ ...cur, [r.id]: { ...pickOf(r), ...patch } }));

  const run = async (r: LeadEditRequest, fn: () => Promise<{ ok: boolean; reason?: string; note?: string }>, after: (res: { note?: string }) => Promise<void>) => {
    if (busy) return;
    setBusy(r.id); setError(null);
    const res = await fn();
    if (!res.ok) { setBusy(null); setError(res.reason ?? "ทำรายการไม่สำเร็จ"); return; }
    await after(res);
    setBusy(null);
    await load();
  };

  const approve = (r: LeadEditRequest) => {
    const p = pickOf(r);
    return run(r, () => approveEditRequest(supabase, r, { groups: p.groups, days: p.days, note: p.note, by: actor }), async () => {
      await notifyEditRequester(r.requested_by_email, `✅ อนุมัติให้แก้ไขข้อมูลลูกค้า — ${who(r)}`,
        `แก้ได้: ${groupLabels(p.groups)}\nภายใน ${p.days} วัน · ครบเวลาแล้วระบบส่งตรวจให้เอง${p.note.trim() ? `\nหมายเหตุ: ${p.note.trim()}` : ""}\nเปิดลูกค้ารายนี้ → กด "แก้ไขข้อมูล" → เสร็จแล้วกด "ส่งให้ผู้บริหารตรวจ"`, r.lead_id);
    });
  };
  const reject = (r: LeadEditRequest) => {
    const note = pickOf(r).note;
    return run(r, () => rejectEditRequest(supabase, r, { note, by: actor }), async () => {
      await notifyEditRequester(r.requested_by_email, `❌ ไม่อนุมัติคำขอแก้ไข — ${who(r)}`, `เหตุผล: ${note.trim()}`, r.lead_id);
    });
  };
  const accept = (r: LeadEditRequest) => {
    const note = pickOf(r).note;
    return run(r, () => approveEditResult(supabase, r, { note, by: actor }), async () => {
      await notifyEditRequester(r.requested_by_email, `✅ ผู้บริหารตรวจผ่าน — ${who(r)}`,
        `การแก้ไขข้อมูลมีผลแล้ว${note.trim() ? `\nหมายเหตุ: ${note.trim()}` : ""}`, r.lead_id);
    });
  };
  const sendBack = (r: LeadEditRequest) => {
    const p = pickOf(r);
    return run(r, () => returnEditRequest(supabase, r, { note: p.note, days: p.days, by: actor }), async () => {
      await notifyEditRequester(r.requested_by_email, `↩️ ตีกลับให้แก้ใหม่ — ${who(r)}`,
        `ต้องแก้เพิ่ม: ${p.note.trim()}\nแก้ได้อีก ${p.days} วัน · เสร็จแล้วกด "ส่งให้ผู้บริหารตรวจ" อีกครั้ง`, r.lead_id);
    });
  };
  const revert = (r: LeadEditRequest) => {
    if (!window.confirm(`คืนค่าเดิมทุกช่องที่ถูกแก้ของ ${who(r)}?\nค่าที่พนักงานแก้จะถูกแทนด้วยค่าก่อนแก้`)) return;
    const note = pickOf(r).note;
    return run(r, () => revertEditRequest(supabase, r, { note, by: actor }), async (res) => {
      if (res.note) window.alert(res.note);
      await notifyEditRequester(r.requested_by_email, `⏪ ผู้บริหารคืนค่าเดิม — ${who(r)}`,
        `ข้อมูลที่แก้ถูกคืนเป็นค่าเดิมแล้ว${note.trim() ? `\nเหตุผล: ${note.trim()}` : ""}`, r.lead_id);
    });
  };

  const pending = reqs.filter((r) => r.status === "pending");
  const submitted = reqs.filter((r) => r.status === "submitted");
  const editing = reqs.filter((r) => r.status === "editing");
  const btn = "flex-1 py-2 text-[11px] font-bold rounded-lg border active:scale-95 disabled:opacity-50";
  const inputCls = "w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/50";

  const head = (r: LeadEditRequest) => {
    const l = leads[r.lead_id];
    return (
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-aviva-text">{who(r)}</p>
          <p className="text-[10px] text-aviva-secondary">
            {l?.status === "Closed Deal" ? "โอนแล้ว" : l?.status ?? ""}{l?.plot_number ? ` · แปลง ${l.plot_number}` : ""}
            {" "}· ขอโดย {r.requested_by_name ?? r.requested_by_email} · {thaiDateTimeLabel(r.created_at)}
          </p>
        </div>
        <Link href={`/crm?lead=${r.lead_id}`} className="text-[10px] text-sky-300 underline shrink-0">เปิดลูกค้า</Link>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-sky-300">📝 คำขอแก้ไขข้อมูลลูกค้า ({pending.length + submitted.length} รอดำเนินการ{editing.length ? ` · ${editing.length} กำลังแก้` : ""})</p>
      {error && <p className="text-[11px] text-red-400">{error}</p>}

      {submitted.map((r) => {
        const diff = diffSnapshot(r.snapshot, r.after_snapshot);
        const p = pickOf(r);
        const self = r.requested_by_email.toLowerCase() === user.email.toLowerCase();
        return (
          <GlassCard key={r.id} className="p-3 border border-aviva-gold/30 space-y-2">
            {head(r)}
            <p className="text-[11px] text-aviva-gold font-bold">
              📤 ส่งตรวจแล้ว{r.auto_submitted ? " (ระบบส่งเมื่อหมดเวลา)" : ""} · {thaiDateTimeLabel(r.submitted_at)}
              {r.return_count > 0 ? ` · เคยตีกลับ ${r.return_count} ครั้ง` : ""}
            </p>
            <p className="text-[11px] text-aviva-secondary">เหตุผลที่ขอ: {r.reason}</p>
            <div className="rounded-lg bg-aviva-bg border border-aviva-gold/10 divide-y divide-aviva-gold/10">
              {diff.length === 0 && <p className="text-[11px] text-aviva-secondary p-2">ไม่มีช่องที่เปลี่ยนจากค่าเดิม</p>}
              {diff.map((d) => (
                <div key={d.field} className="p-2">
                  <p className="text-[10px] text-aviva-secondary">{d.label}</p>
                  <p className="text-[11px]"><span className="text-red-300/80 line-through">{formatEditValue(d.field, d.before)}</span> → <b className="text-green-300">{formatEditValue(d.field, d.after)}</b></p>
                </div>
              ))}
            </div>
            {needsAccountingCheck(leads[r.lead_id]?.status, diff) && (
              <p className="text-[11px] text-amber-300 leading-relaxed">
                ⚠️ ลูกค้ารายนี้โอนแล้ว และมีการเปลี่ยนเงิน/วันที่ — ถ้าอนุมัติ บัญชีรับรู้รายได้ (revenue_recognition / JV) ต้องปรับให้ตรงด้วย แจ้ง ONE ตรวจต่อ
              </p>
            )}
            <textarea value={p.note} onChange={(e) => setPickOf(r, { note: e.target.value })} rows={2}
              placeholder="หมายเหตุ (ตีกลับ: ต้องบอกว่าให้แก้อะไรเพิ่ม)" className={inputCls} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-aviva-secondary">ถ้าตีกลับ ให้แก้ได้อีก</span>
              <select value={p.days} onChange={(e) => setPickOf(r, { days: Number(e.target.value) })} className="bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-[11px] text-aviva-text">
                {EDIT_DAYS_OPTIONS.map((d) => <option key={d} value={d}>{d} วัน</option>)}
              </select>
            </div>
            {self ? (
              <p className="text-[11px] text-red-300">คำขอของตัวเอง — ต้องให้ผู้บริหารอีกท่านตรวจ (Maker-Checker)</p>
            ) : (
              <div className="flex gap-2">
                <button disabled={!!busy} onClick={() => accept(r)} className={`${btn} bg-green-500/15 text-green-300 border-green-500/30`}>✅ อนุมัติ</button>
                <button disabled={!!busy || !p.note.trim()} onClick={() => sendBack(r)} className={`${btn} bg-amber-500/15 text-amber-300 border-amber-500/30`}>↩️ ตีกลับให้แก้ใหม่</button>
                <button disabled={!!busy} onClick={() => revert(r)} className={`${btn} bg-red-500/15 text-red-300 border-red-500/30`}>⏪ คืนค่าเดิม</button>
              </div>
            )}
          </GlassCard>
        );
      })}

      {pending.map((r) => {
        const p = pickOf(r);
        const self = r.requested_by_email.toLowerCase() === user.email.toLowerCase();
        return (
          <GlassCard key={r.id} className="p-3 border border-sky-500/25 space-y-2">
            {head(r)}
            <p className="text-[11px] text-sky-300 font-bold">⏳ ขอแก้ไข: {groupLabels(r.requested_groups)}</p>
            <p className="text-[11px] text-aviva-text">เหตุผล: {r.reason}</p>
            <p className="text-[10px] text-aviva-secondary">อนุญาตให้แก้ส่วนไหน (ปรับได้)</p>
            {EDIT_GROUPS.map((g) => (
              <label key={g.key} className="flex items-start gap-2 text-[11px] text-aviva-text">
                <input type="checkbox" checked={p.groups.includes(g.key)} className="mt-0.5"
                  onChange={() => setPickOf(r, { groups: p.groups.includes(g.key) ? p.groups.filter((x) => x !== g.key) : [...p.groups, g.key] })} />
                <span><b>{g.label}</b>{r.requested_groups.includes(g.key) ? " (ขอมา)" : ""}<br /><span className="text-aviva-secondary">{g.hint}</span></span>
              </label>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-aviva-secondary">ให้เวลาแก้</span>
              <select value={p.days} onChange={(e) => setPickOf(r, { days: Number(e.target.value) })} className="bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-[11px] text-aviva-text">
                {EDIT_DAYS_OPTIONS.map((d) => <option key={d} value={d}>{d} วัน</option>)}
              </select>
            </div>
            <textarea value={p.note} onChange={(e) => setPickOf(r, { note: e.target.value })} rows={2}
              placeholder="หมายเหตุ (ไม่อนุมัติ: ต้องระบุเหตุผล)" className={inputCls} />
            {self ? (
              <p className="text-[11px] text-red-300">คำขอของตัวเอง — ต้องให้ผู้บริหารอีกท่านอนุมัติ (Maker-Checker)</p>
            ) : (
              <div className="flex gap-2">
                <button disabled={!!busy || p.groups.length === 0} onClick={() => approve(r)} className={`${btn} bg-green-500/15 text-green-300 border-green-500/30`}>✅ อนุมัติให้แก้ {p.days} วัน</button>
                <button disabled={!!busy || !p.note.trim()} onClick={() => reject(r)} className={`${btn} bg-red-500/15 text-red-300 border-red-500/30`}>❌ ไม่อนุมัติ</button>
              </div>
            )}
          </GlassCard>
        );
      })}

      {editing.map((r) => (
        <GlassCard key={r.id} className="p-3 border border-aviva-gold/10">
          {head(r)}
          <p className="text-[11px] text-aviva-secondary mt-1">
            🔓 กำลังแก้: {groupLabels(r.allowed_groups)} · ถึง {thaiDateTimeLabel(r.edit_until)} · อนุมัติโดย {r.decided_by ?? "—"}
          </p>
        </GlassCard>
      ))}
    </div>
  );
}
