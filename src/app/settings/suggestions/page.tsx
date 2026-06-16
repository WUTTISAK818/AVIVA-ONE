"use client";
// ข้อเสนอแนะ / ปรับปรุงแอป — ผู้ใช้ทุกคนเสนอได้ → ผู้บริหารอนุมัติ → คิวผู้พัฒนา
// บันทึก: ใครเสนอ / เสนออะไร / วันที่ + เวลา
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Lightbulb, Plus, X, Check, Ban, Clock, Wrench } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { createNotification } from "@/lib/notify";
import { logAction } from "@/lib/audit";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const CATEGORIES = ["ปรับปรุงการทำงาน", "แก้ไขข้อผิดพลาด (บั๊ก)", "ฟีเจอร์ใหม่", "หน้าจอ/การใช้งาน (UI)", "อื่น ๆ"];

interface Suggestion {
  id: string;
  submitter: string | null;
  submitter_dept: string | null;
  category: string;
  title: string;
  detail: string | null;
  status: "pending" | "approved" | "rejected" | "done";
  reviewer: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

const STATUS_BADGE: Record<Suggestion["status"], { label: string; cls: string }> = {
  pending:  { label: "รอผู้บริหารพิจารณา", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  approved: { label: "อนุมัติ · รอผู้พัฒนา", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  done:     { label: "พัฒนาเสร็จแล้ว", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
};

export default function SuggestionsPage() {
  const user = useCurrentUser();
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  const [rejecting, setRejecting] = useState<Suggestion | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const canReview = !!(user?.isManager || user?.isAdmin);
  const who = user?.full_name ?? user?.email ?? "ผู้ใช้";

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("app_suggestions")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Suggestion[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = () => { setCategory(CATEGORIES[0]); setTitle(""); setDetail(""); setErr(""); setShowForm(true); };

  const submit = async () => {
    if (!title.trim()) { setErr("กรุณาระบุหัวข้อข้อเสนอ"); return; }
    setSaving(true); setErr("");
    const { data: inserted, error } = await supabase
      .from("app_suggestions")
      .insert({
        project_id: PROJECT_ID,
        submitter: who,
        submitter_email: user?.email ?? null,
        submitter_dept: user?.department ?? null,
        category,
        title: title.trim(),
        detail: detail.trim() || null,
      })
      .select("id")
      .single();
    if (error || !inserted) { setErr("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง"); setSaving(false); return; }
    await createNotification({
      type: "info",
      title: "ข้อเสนอแนะปรับปรุงแอปใหม่",
      message: `${who}: ${title.trim()} [${category}]`,
      from_dept: user?.department ?? undefined,
      to_dept: "ฝ่ายบริหาร",
      record_id: inserted.id,
    });
    await logAction("settings", "suggestion_create", `เสนอปรับปรุงแอป: ${title.trim()} [${category}]`, inserted.id);
    setSaving(false); setShowForm(false); load();
  };

  const review = async (s: Suggestion, status: "approved" | "rejected" | "done", note?: string) => {
    setSaving(true); setErr("");
    const { error } = await supabase
      .from("app_suggestions")
      .update({ status, reviewer: who, reviewed_at: new Date().toISOString(), review_note: note ?? null })
      .eq("id", s.id);
    if (error) { setErr("บันทึกไม่สำเร็จ"); setSaving(false); return; }
    const label = status === "approved" ? "อนุมัติให้พัฒนา" : status === "rejected" ? "ไม่อนุมัติ" : "ทำเสร็จแล้ว";
    await createNotification({
      type: status === "approved" ? "success" : "info",
      title: `ข้อเสนอแนะถูก${label}`,
      message: `${s.title}${note ? ` — ${note}` : ""}`,
      from_dept: "ฝ่ายบริหาร",
      to_dept: s.submitter_dept ?? undefined,
      record_id: s.id,
    });
    await logAction("settings", "suggestion_review", `${label}ข้อเสนอ: ${s.title}`, s.id);
    setSaving(false); setRejecting(null); setRejectNote(""); load();
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/settings" className="text-aviva-secondary"><ChevronLeft size={20} /></Link>
          <Lightbulb size={18} className="text-yellow-400" />
          <h1 className="text-lg font-bold text-aviva-text">ข้อเสนอแนะ / ปรับปรุงแอป</h1>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <GlassCard className="p-4">
          <p className="text-xs text-aviva-secondary leading-relaxed">
            เสนอไอเดียพัฒนา/ปรับปรุงการทำงานในแอปได้ทุกคน ระบบบันทึกชื่อผู้เสนอและวันเวลาอัตโนมัติ →
            ผู้บริหารพิจารณาอนุมัติก่อน จึงส่งให้ผู้พัฒนาดำเนินการ (โดยคำนึงถึงความถูกต้องและโครงสร้างหลักของแอปเป็นสำคัญ)
          </p>
          <button onClick={openForm}
            className="w-full mt-3 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-2.5 rounded-xl text-sm">
            <Plus size={15} /> เสนอข้อเสนอแนะใหม่
          </button>
        </GlassCard>

        {loading ? (
          <p className="text-xs text-aviva-secondary/70 text-center py-4">กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-aviva-secondary/70 text-center py-4">ยังไม่มีข้อเสนอแนะ — เริ่มเสนอได้เลย</p>
        ) : (
          rows.map((s) => {
            const b = STATUS_BADGE[s.status];
            return (
              <GlassCard key={s.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-aviva-text font-medium">{s.title}</p>
                    <p className="text-[10px] text-aviva-secondary/70 mt-0.5">
                      {s.category} · {s.submitter ?? "-"}{s.submitter_dept ? ` (${s.submitter_dept})` : ""} · {fmtDateTime(s.created_at)} น.
                    </p>
                  </div>
                  <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border ${b.cls}`}>{b.label}</span>
                </div>
                {s.detail && <p className="text-xs text-aviva-secondary mt-1.5 whitespace-pre-wrap">{s.detail}</p>}
                {s.review_note && (
                  <p className="text-[11px] text-aviva-secondary/80 mt-1.5 bg-aviva-bg/50 rounded-lg px-2 py-1">
                    หมายเหตุผู้บริหาร: {s.review_note}
                  </p>
                )}
                {s.reviewer && (
                  <p className="text-[10px] text-aviva-secondary/60 mt-1">โดย {s.reviewer}{s.reviewed_at ? ` · ${fmtDateTime(s.reviewed_at)} น.` : ""}</p>
                )}

                {canReview && s.status === "pending" && (
                  <div className="flex gap-2 mt-2.5">
                    <button onClick={() => review(s, "approved")} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-500/15 text-green-400 border border-green-500/25 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50">
                      <Check size={12} /> อนุมัติ
                    </button>
                    <button onClick={() => { setRejecting(s); setRejectNote(""); setErr(""); }} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-500/15 text-red-400 border border-red-500/25 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50">
                      <Ban size={12} /> ไม่อนุมัติ
                    </button>
                  </div>
                )}
                {canReview && s.status === "approved" && (
                  <button onClick={() => review(s, "done")} disabled={saving}
                    className="w-full mt-2.5 flex items-center justify-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/25 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50">
                    <Wrench size={12} /> ทำเครื่องหมายว่าพัฒนาเสร็จ
                  </button>
                )}
                {!canReview && s.status === "pending" && (
                  <p className="flex items-center gap-1 text-[10px] text-yellow-400/80 mt-2"><Clock size={10} /> รอผู้บริหารพิจารณา</p>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {/* ฟอร์มเสนอ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="w-full max-w-sm bg-aviva-bg border border-aviva-gold/20 rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-aviva-text">เสนอข้อเสนอแนะ</h3>
              <button onClick={() => !saving && setShowForm(false)} className="text-aviva-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-aviva-secondary">หมวด</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">หัวข้อ</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น เพิ่มปุ่มพิมพ์ใบเสร็จในหน้าการเงิน"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">รายละเอียด (ปัญหา/ประโยชน์ที่จะได้)</label>
                <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={4}
                  placeholder="อธิบายว่าอยากให้ปรับอะไร เพราะอะไร จะช่วยงานอย่างไร"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              {err && <div className="text-[11px] text-red-400">{err}</div>}
              <button onClick={submit} disabled={saving}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก…" : "ส่งข้อเสนอแนะ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ไม่อนุมัติ + เหตุผล */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !saving && setRejecting(null)}>
          <div className="w-full max-w-sm bg-aviva-bg border border-aviva-gold/20 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-aviva-text">ไม่อนุมัติข้อเสนอ</h3>
              <button onClick={() => !saving && setRejecting(null)} className="text-aviva-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] text-aviva-secondary">{rejecting.title}</p>
              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3}
                placeholder="เหตุผล/คำแนะนำ (ถ้ามี) เช่น กระทบโครงสร้างหลัก ขอเลื่อนไปรอบหน้า"
                className="w-full bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              {err && <div className="text-[11px] text-red-400">{err}</div>}
              <button onClick={() => review(rejecting, "rejected", rejectNote.trim() || undefined)} disabled={saving}
                className="w-full bg-red-500/90 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก…" : "ยืนยันไม่อนุมัติ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
