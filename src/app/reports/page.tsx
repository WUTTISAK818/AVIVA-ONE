"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, X, Camera, Send, Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import { toSignedUrl } from "@/lib/storage";
import { compressImage } from "@/lib/image-compress";
import GlassCard from "@/components/GlassCard";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  activity:    { label: "กิจกรรม",       color: "text-blue-400" },
  achievement: { label: "ผลสำเร็จ",      color: "text-green-400" },
  issue:       { label: "ปัญหา/อุปสรรค", color: "text-red-400" },
  plan:        { label: "แผนงานพรุ่งนี้",  color: "text-yellow-400" },
};

const WORK_LOCATIONS = [
  "สำนักงาน",
  "โครงการ AVIVA Private",
  "เยี่ยมลูกค้า / นอกสถานที่",
  "Work from Home",
];

interface WReport {
  id: string;
  user_email: string;
  employee_name: string;
  department: string;
  report_date: string;
  report_type: string;
  summary: string;
  work_location: string;
  status: "draft" | "submitted" | "late";
  late_reason?: string;
  submitted_at?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  manager_comment?: string;
}

interface WItem {
  id?: string;
  report_id?: string;
  category: string;
  description: string;
  source: string;
}

interface WAttachment {
  id?: string;
  file_url: string;
  file_name: string;
  signed?: string;
}

interface HistoryReport {
  id: string;
  report_date: string;
  status: string;
  submitted_at?: string;
}

const STATUS_CFG = {
  draft:     { label: "แบบร่าง",   color: "text-aviva-secondary", bg: "bg-aviva-bg/50",    border: "border-aviva-gold/20" },
  submitted: { label: "ส่งแล้ว ✓", color: "text-green-400",       bg: "bg-green-500/10",   border: "border-green-500/30" },
  late:      { label: "ส่งล่าช้า", color: "text-orange-400",      bg: "bg-orange-500/10",  border: "border-orange-500/30" },
};

export default function ReportsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const todayThai = new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const [report, setReport]           = useState<WReport | null>(null);
  const [items, setItems]             = useState<WItem[]>([]);
  const [attachments, setAttachments] = useState<WAttachment[]>([]);
  const [history, setHistory]         = useState<HistoryReport[]>([]);
  const [newText, setNewText]         = useState("");
  const [newCat, setNewCat]           = useState("activity");
  const [summary, setSummary]         = useState("");
  const [workLocation, setWorkLocation] = useState("สำนักงาน");
  const [uploading, setUploading]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [lateModal, setLateModal]     = useState(false);
  const [lateReason, setLateReason]   = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryReport | null>(null);
  const [historyItems, setHistoryItems] = useState<WItem[]>([]);
  const [historyAttachments, setHistoryAttachments] = useState<WAttachment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (user?.isManager || user?.isAdmin) {
      router.replace("/reports/review");
    }
  }, [user, router]);

  const isLate      = new Date().getHours() >= 18;
  const isSubmitted = report?.status === "submitted" || report?.status === "late";

  if (user?.isManager || user?.isAdmin) return null;

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleViewHistory(h: HistoryReport) {
    setSelectedHistory(h);
    setLoadingHistory(true);
    try {
      const { data: its } = await supabase.from("work_report_items").select("*").eq("report_id", h.id).order("created_at");
      setHistoryItems((its ?? []) as WItem[]);
      const { data: atts } = await supabase.from("work_report_attachments").select("*").eq("report_id", h.id);
      setHistoryAttachments(await Promise.all(((atts ?? []) as WAttachment[]).map(async a => ({ ...a, signed: (await toSignedUrl(a.file_url)) ?? undefined }))));
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการโหลด", "error");
    }
    setLoadingHistory(false);
  }

  async function loadAutoItems(reportId: string) {
    if (!user) return;
    const autoItems: Omit<WItem, "id">[] = [];

    const { data: logs } = await supabase
      .from("approval_logs")
      .select("workflow_type, source_doc_index, amount")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`)
      .ilike("source_doc_index", `%${user.full_name ?? ""}%`);

    const wfLabels: Record<string, string> = {
      Finance_Approval:   "เบิกเงิน",
      Material_Purchase:  "ขอจัดซื้อวัสดุ",
      Installment_Review: "ส่งตรวจงวดงาน",
      Leave_Request:      "ยื่นคำขอลา",
      Document_Approval:  "ขออนุมัติเอกสาร",
      Booking_Deposit:    "บันทึกการจอง",
      Contract_Approval:  "ส่งสัญญาซื้อขาย",
      Warranty_Claim:     "แจ้งซ่อม",
    };

    (logs ?? []).forEach(log => {
      const label = wfLabels[log.workflow_type] ?? log.workflow_type;
      const docNum = (log.source_doc_index as string)?.split(" | ")[0] ?? "";
      const amount = log.amount ? ` (฿${Number(log.amount).toLocaleString()})` : "";
      autoItems.push({ category: "activity", description: `${label}: ${docNum}${amount}`, source: "auto", report_id: reportId });
    });

    if (user.department === "ฝ่ายขาย") {
      const { data: acts } = await supabase
        .from("sales_activities")
        .select("activity_type, customer_name, note")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);
      (acts ?? []).forEach((a: Record<string, string | null>) => {
        const desc = `[ขาย] ${a.activity_type ?? ""}: ${a.customer_name ?? ""}${a.note ? ` — ${a.note}` : ""}`;
        autoItems.push({ category: "activity", description: desc, source: "auto", report_id: reportId });
      });
    }

    if (user.department === "ฝ่ายก่อสร้าง") {
      const { data: insts } = await supabase
        .from("contractor_installments")
        .select("installment_number, status")
        .gte("updated_at", `${today}T00:00:00`)
        .lte("updated_at", `${today}T23:59:59`)
        .eq("project_id", PROJECT_ID);
      (insts ?? []).forEach((inst: Record<string, unknown>) => {
        autoItems.push({ category: "activity", description: `[ก่อสร้าง] ตรวจงวดที่ ${inst.installment_number} (สถานะ: ${inst.status})`, source: "auto", report_id: reportId });
      });
    }

    if (autoItems.length > 0) {
      const { data: ins } = await supabase.from("work_report_items").insert(autoItems).select();
      if (ins) setItems(prev => [...prev, ...(ins as WItem[])]);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (user.isManager || user.isAdmin) return;

    supabase.from("work_reports")
      .select("*")
      .eq("user_email", user.email)
      .eq("report_date", today)
      .eq("report_type", "daily")
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setReport(data as WReport);
          setSummary(data.summary ?? "");
          setWorkLocation(data.work_location ?? "สำนักงาน");
          const { data: its } = await supabase.from("work_report_items").select("*").eq("report_id", data.id).order("created_at");
          setItems((its ?? []) as WItem[]);
          const { data: atts } = await supabase.from("work_report_attachments").select("*").eq("report_id", data.id);
          setAttachments(await Promise.all(((atts ?? []) as WAttachment[]).map(async a => ({ ...a, signed: (await toSignedUrl(a.file_url)) ?? undefined }))));
        } else {
          const { data: created } = await supabase.from("work_reports").insert({
            user_email: user.email,
            employee_name: user.full_name ?? user.email,
            department: user.department ?? "ไม่ระบุ",
            report_date: today,
            report_type: "daily",
            summary: "",
            work_location: "สำนักงาน",
            status: "draft",
          }).select().single();
          if (created) {
            setReport(created as WReport);
            await loadAutoItems(created.id);
          }
        }
      });

    supabase.from("work_reports")
      .select("id, report_date, status, submitted_at")
      .eq("user_email", user.email)
      .eq("report_type", "daily")
      .neq("report_date", today)
      .order("report_date", { ascending: false })
      .limit(14)
      .then(({ data }) => setHistory((data ?? []) as HistoryReport[]));
  }, [user?.email]);

  async function addItem() {
    if (!newText.trim() || !report) return;
    const row = { report_id: report.id, category: newCat, description: newText.trim(), source: "manual" };
    const { data } = await supabase.from("work_report_items").insert(row).select().single();
    if (data) setItems(prev => [...prev, data as WItem]);
    setNewText("");
  }

  async function removeItem(idx: number) {
    const item = items[idx];
    if (item.id) await supabase.from("work_report_items").delete().eq("id", item.id);
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function uploadPhoto(file: File) {
    if (!report) return;
    setUploading(true);
    file = await compressImage(file);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `rpt-${report.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("document-attachments").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("document-attachments").getPublicUrl(path);
      const att = { report_id: report.id, file_url: urlData.publicUrl, file_name: file.name };
      const { data } = await supabase.from("work_report_attachments").insert(att).select().single();
      if (data) { const d = data as WAttachment; d.signed = (await toSignedUrl(d.file_url)) ?? undefined; setAttachments(prev => [...prev, d]); }
    }
    setUploading(false);
  }

  async function saveSummary() {
    if (!report || isSubmitted) return;
    await supabase.from("work_reports").update({ summary, work_location: workLocation, updated_at: new Date().toISOString() }).eq("id", report.id);
  }

  async function doSubmit(lateR?: string) {
    if (!report) return;
    setSubmitting(true);
    const now = new Date();
    const status: "submitted" | "late" = now.getHours() >= 18 ? "late" : "submitted";
    const { data } = await supabase.from("work_reports").update({
      status, summary, work_location: workLocation,
      submitted_at: now.toISOString(),
      late_reason: lateR ?? null,
      updated_at: now.toISOString(),
    }).eq("id", report.id).select().single();
    if (data) setReport(data as WReport);
    setSubmitting(false);
    setLateModal(false);
    showToast(status === "late" ? "ส่งรายงานล่าช้า — บันทึกแล้ว" : "ส่งรายงานเรียบร้อย ✓");
  }

  function handleSubmit() {
    if (isLate) { setLateModal(true); } else { doSubmit(); }
  }

  const sc = STATUS_CFG[report?.status ?? "draft"];

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <ClipboardList size={18} className="text-aviva-gold" />
          <h1 className="text-lg font-bold text-aviva-text">รายงานการปฏิบัติงาน</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">

        {/* Date + Status */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-aviva-secondary">รายงานประจำวัน</p>
              <p className="text-sm font-bold text-aviva-text mt-0.5">{todayThai}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${sc.bg} ${sc.border} ${sc.color}`}>
              {sc.label}
            </div>
          </div>
          {report?.submitted_at && (
            <p className="text-[11px] text-aviva-secondary/60 mt-2 flex items-center gap-1">
              <Clock size={10} />
              ส่งเมื่อ {new Date(report.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
              {report.late_reason && ` — เหตุผล: ${report.late_reason}`}
            </p>
          )}
        </GlassCard>

        {/* Work Location */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={13} className="text-aviva-gold" />
            <p className="text-xs font-semibold text-aviva-secondary">สถานที่ปฏิบัติงาน</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {WORK_LOCATIONS.map(loc => (
              <button key={loc} disabled={isSubmitted}
                onClick={() => { setWorkLocation(loc); if (report && !isSubmitted) supabase.from("work_reports").update({ work_location: loc, updated_at: new Date().toISOString() }).eq("id", report.id); }}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${workLocation === loc ? "bg-aviva-gold/15 border-aviva-gold text-aviva-gold" : "bg-aviva-bg/50 border-aviva-gold/20 text-aviva-secondary"} disabled:opacity-60`}>
                {loc}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Summary */}
        <GlassCard className="p-4">
          <p className="text-xs font-semibold text-aviva-secondary mb-2">สรุปภาพรวมวันนี้</p>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} onBlur={saveSummary}
            disabled={isSubmitted} rows={2} placeholder="สรุปสิ่งที่ทำวันนี้โดยย่อ..."
            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text resize-none focus:outline-none focus:border-aviva-gold/50 placeholder:text-aviva-secondary/30 disabled:opacity-50" />
        </GlassCard>

        {/* Items */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-aviva-secondary">รายการกิจกรรมวันนี้</p>
            <span className="text-[10px] text-aviva-secondary/60">{items.length} รายการ</span>
          </div>
          <div className="space-y-2 mb-3">
            {items.length === 0 && (
              <p className="text-xs text-aviva-secondary/50 text-center py-4">ยังไม่มีรายการ — ระบบดึงข้อมูลอัตโนมัติหรือกดเพิ่มด้านล่าง</p>
            )}
            {items.map((item, idx) => {
              const cat = CATEGORY_LABELS[item.category] ?? CATEGORY_LABELS.activity;
              return (
                <div key={idx} className="flex items-start gap-2 bg-aviva-bg/50 rounded-xl px-3 py-2.5">
                  <span className={`text-[10px] font-bold mt-0.5 flex-shrink-0 ${cat.color}`}>[{cat.label}]</span>
                  <p className="flex-1 text-xs text-aviva-text leading-relaxed">{item.description}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.source === "auto" && <span className="text-[9px] text-aviva-secondary/30">auto</span>}
                    {!isSubmitted && (
                      <button onClick={() => removeItem(idx)}>
                        <X size={12} className="text-aviva-secondary/30 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!isSubmitted && (
            <div className="border-t border-aviva-gold/10 pt-3 space-y-2">
              <select value={newCat} onChange={e => setNewCat(e.target.value)}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text focus:outline-none">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input value={newText} onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addItem()}
                  placeholder="พิมพ์รายละเอียดกิจกรรม..."
                  className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text focus:outline-none focus:border-aviva-gold/50 placeholder:text-aviva-secondary/30" />
                <button onClick={addItem} disabled={!newText.trim()}
                  className="px-3 bg-aviva-gold text-aviva-bg rounded-xl disabled:opacity-40">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Attachments */}
        <GlassCard className="p-4">
          <p className="text-xs font-semibold text-aviva-secondary mb-3">รูปภาพ / เอกสารแนบ</p>
          {attachments.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {attachments.map((att, idx) => (
                <img key={idx} src={att.signed ?? att.file_url} alt={att.file_name}
                  className="w-full aspect-square object-cover rounded-xl border border-aviva-gold/20" />
              ))}
            </div>
          )}
          {isSubmitted && attachments.length === 0 && (
            <p className="text-center text-aviva-secondary/50 italic text-xs py-3">❌ ไม่มีรูปภาพแนบในรายงานนี้</p>
          )}
          {!isSubmitted && (
            <label className="flex items-center gap-2.5 bg-aviva-bg border border-aviva-gold/20 border-dashed rounded-xl px-4 py-3 cursor-pointer hover:border-aviva-gold/50 transition-all">
              <Camera size={16} className="text-aviva-secondary/60 flex-shrink-0" />
              <span className="text-sm text-aviva-secondary/50">{uploading ? "กำลังอัปโหลด..." : "ถ่ายรูป / เลือกไฟล์"}</span>
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
            </label>
          )}
        </GlassCard>

        {/* Submit */}
        {!isSubmitted ? (
          <div className="space-y-2">
            {isLate && (
              <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                <AlertTriangle size={13} className="text-orange-400 flex-shrink-0" />
                <p className="text-xs text-orange-400">เลย 18:00 น. แล้ว — ต้องระบุเหตุผลที่ส่งล่าช้า</p>
              </div>
            )}
            <button onClick={handleSubmit} disabled={submitting || items.length === 0}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Send size={14} />
              {submitting ? "กำลังส่ง..." : isLate ? "ส่งรายงาน (ล่าช้า)" : "ส่งรายงานประจำวัน"}
            </button>
            {items.length === 0 && (
              <p className="text-[11px] text-aviva-secondary/50 text-center">กรุณาเพิ่มกิจกรรมอย่างน้อย 1 รายการ</p>
            )}
          </div>
        ) : (
          <div className="bg-green-500/10 rounded-2xl border border-green-500/20 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-400">ส่งรายงานแล้ว</p>
                <p className="text-xs text-aviva-secondary/70 mt-0.5">รายงานวันนี้ถูกบันทึกและส่งให้หัวหน้าเรียบร้อย</p>
              </div>
            </div>
            {report?.acknowledged_by && (
              <div className="mt-3 pt-3 border-t border-green-500/20">
                <p className="text-xs text-green-400 font-semibold">
                  ✓ ผู้จัดการรับทราบแล้ว — {report.acknowledged_by}
                </p>
                {report.manager_comment && (
                  <div className="mt-2 bg-aviva-bg/50 rounded-xl px-3 py-2 border border-aviva-gold/15">
                    <p className="text-[10px] text-aviva-secondary mb-0.5 uppercase tracking-wider">ความเห็น</p>
                    <p className="text-xs text-aviva-text leading-relaxed">{report.manager_comment}</p>
                  </div>
                )}
              </div>
            )}
            {!report?.acknowledged_by && (
              <p className="text-[10px] text-aviva-secondary/50 mt-2 ml-8">รอผู้จัดการรับทราบ...</p>
            )}
          </div>
        )}

        {/* History */}
        <div>
          <button onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between py-2 text-sm font-semibold text-aviva-secondary">
            <span>รายงานย้อนหลัง ({history.length} รายการ)</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHistory && (
            <div className="space-y-2 mt-2">
              {history.length === 0 && (
                <p className="text-xs text-aviva-secondary/50 text-center py-3">ยังไม่มีรายงานย้อนหลัง</p>
              )}
              {history.map(h => {
                const hDate = new Date(h.report_date).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
                const hSc = STATUS_CFG[h.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.draft;
                return (
                  <button key={h.id} onClick={() => handleViewHistory(h)}
                    className="w-full flex items-center justify-between bg-aviva-card rounded-xl px-3 py-2.5 border border-aviva-gold/10 hover:border-aviva-gold/30 transition-all">
                    <p className="text-xs text-aviva-text">{hDate}</p>
                    <span className={`text-[10px] font-bold ${hSc.color}`}>{hSc.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Late reason modal */}
      {lateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-orange-400" />
              <h2 className="text-base font-bold text-aviva-text">ระบุเหตุผลที่ส่งล่าช้า</h2>
            </div>
            <textarea value={lateReason} onChange={e => setLateReason(e.target.value)} rows={3}
              placeholder="เช่น ลูกค้าโทรมาสายมาก, งานเร่งด่วน, ไม่มีสัญญาณอินเทอร์เน็ต..."
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text resize-none focus:outline-none focus:border-aviva-gold/50 placeholder:text-aviva-secondary/30 mb-4" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLateModal(false)}
                className="py-3 rounded-xl border border-aviva-gold/20 text-sm text-aviva-secondary">
                ยกเลิก
              </button>
              <button onClick={() => doSubmit(lateReason)} disabled={!lateReason.trim() || submitting}
                className="py-3 rounded-xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-50">
                {submitting ? "กำลังส่ง..." : "ยืนยันส่ง"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History detail modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-aviva-card border-b border-aviva-gold/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-aviva-text">รายละเอียดรายงาน</h2>
              <button onClick={() => { setSelectedHistory(null); setHistoryItems([]); setHistoryAttachments([]); }}
                className="text-aviva-secondary hover:text-aviva-text">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {loadingHistory ? (
                <p className="text-center text-aviva-secondary">กำลังโหลด...</p>
              ) : (
                <>
                  <div className="bg-aviva-bg/50 rounded-xl px-4 py-3 space-y-2">
                    <p className="text-xs text-aviva-secondary uppercase">วันที่</p>
                    <p className="text-sm font-bold text-aviva-text">
                      {new Date(selectedHistory.report_date).toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>

                  <div className="bg-aviva-bg/50 rounded-xl px-4 py-3 space-y-2">
                    <p className="text-xs text-aviva-secondary uppercase">สถานะ</p>
                    <div className={`inline-block px-3 py-1.5 rounded-xl border text-xs font-bold ${STATUS_CFG[selectedHistory.status as keyof typeof STATUS_CFG]?.bg ?? ""} ${STATUS_CFG[selectedHistory.status as keyof typeof STATUS_CFG]?.border ?? ""} ${STATUS_CFG[selectedHistory.status as keyof typeof STATUS_CFG]?.color ?? ""}`}>
                      {STATUS_CFG[selectedHistory.status as keyof typeof STATUS_CFG]?.label ?? selectedHistory.status}
                    </div>
                  </div>

                  {selectedHistory.submitted_at && (
                    <div className="bg-aviva-bg/50 rounded-xl px-4 py-3 space-y-2">
                      <p className="text-xs text-aviva-secondary uppercase">ส่งเมื่อ</p>
                      <p className="text-sm text-aviva-text">
                        {new Date(selectedHistory.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                      </p>
                    </div>
                  )}

                  {historyItems.length > 0 && (
                    <div className="bg-aviva-bg/50 rounded-xl px-4 py-3 space-y-3">
                      <p className="text-xs text-aviva-secondary uppercase font-semibold">รายการกิจกรรม ({historyItems.length})</p>
                      <div className="space-y-2">
                        {historyItems.map((item, idx) => {
                          const cat = CATEGORY_LABELS[item.category] ?? CATEGORY_LABELS.activity;
                          return (
                            <div key={idx} className="flex items-start gap-2 bg-aviva-bg rounded-lg px-3 py-2">
                              <span className={`text-[10px] font-bold mt-0.5 flex-shrink-0 ${cat.color}`}>[{cat.label}]</span>
                              <p className="flex-1 text-xs text-aviva-text leading-relaxed">{item.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {historyAttachments.length > 0 && (
                    <div className="bg-aviva-bg/50 rounded-xl px-4 py-3 space-y-3">
                      <p className="text-xs text-aviva-secondary uppercase font-semibold">รูปภาพ ({historyAttachments.length})</p>
                      <div className="grid grid-cols-3 gap-2">
                        {historyAttachments.map((att, idx) => (
                          <img key={idx} src={att.signed ?? att.file_url} alt={att.file_name}
                            className="w-full aspect-square object-cover rounded-lg border border-aviva-gold/20" />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
