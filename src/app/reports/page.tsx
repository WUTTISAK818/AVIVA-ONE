"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, X, Camera, Send, Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, MapPin, Wifi, WifiOff, RefreshCw, Sparkles } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import { toSignedUrl } from "@/lib/storage";
import { compressImage } from "@/lib/image-compress";
import { createNotification } from "@/lib/notify";
import { saveDraftLocally, loadDraftLocally, clearDraftLocally, isOnline, useOnlineStatus } from "@/lib/offline-sync";
import { buildAutoItems, dedupeAutoItems } from "@/lib/report-auto-items";
import GlassCard from "@/components/GlassCard";

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
  is_backdated?: boolean;
  last_edited_at?: string | null;
  returned_at?: string | null;
  return_reason?: string | null;
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
  caption?: string | null;
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
  // วันที่แบบเวลาไทย (UTC+7) — ใช้เทียบ activity_logs.activity_date ที่ฝั่ง activity บันทึกเป็นวันที่ไทย
  const todayBkk = new Date(Date.now() + 7 * 3600_000).toISOString().split("T")[0];
  // วันที่ของรายงานที่กำลังทำ (ย้อนหลังได้ถึง 7 วัน — แก้ปัญหาลืมส่งเมื่อวาน)
  const [reportDate, setReportDate] = useState(today);
  const isBackdated = reportDate !== today;
  const minDate = new Date(Date.now() - 7 * 86400_000).toISOString().split("T")[0];
  const reportDateThai = new Date(reportDate + "T12:00:00").toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const [editMode, setEditMode] = useState(false); // แก้รายงานที่ส่งแล้ว (ก่อนผู้บริหารรับทราบ)

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
  const [noPhotoModal, setNoPhotoModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryReport | null>(null);
  const [historyItems, setHistoryItems] = useState<WItem[]>([]);
  const [historyAttachments, setHistoryAttachments] = useState<WAttachment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [online, setOnline]           = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [pulling, setPulling]         = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  // AI ร่างรายงาน — โครงที่ AI เสนอ (เลือกเพิ่มลงรายงานได้)
  const [aiDraftModal, setAiDraftModal] = useState(false);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftItems, setAiDraftItems] = useState<{ category: string; description: string; checked: boolean }[]>([]);
  const [aiDraftNote, setAiDraftNote] = useState("");
  const [aiDraftError, setAiDraftError] = useState<string | null>(null);
  const [aiDraftAdding, setAiDraftAdding] = useState(false);

  useEffect(() => {
    if (user?.isManager || user?.isAdmin) {
      router.replace("/reports/review");
    }
  }, [user, router]);

  useEffect(() => {
    setOnline(isOnline());
    useOnlineStatus(setOnline);
  }, []);

  const isLate      = new Date().getHours() >= 18 && !isBackdated;
  const isSubmitted = report?.status === "submitted" || report?.status === "late";
  const acknowledged = !!report?.acknowledged_by;           // รับทราบแล้ว → ล็อกถาวร
  const isReturned   = !!report?.returned_at && !acknowledged; // ผู้นำตีกลับให้แก้
  // ฟอร์มแก้ได้เมื่อ: ยังไม่รับทราบ และ (ยังเป็นร่าง / ถูกตีกลับ / กดเข้าโหมดแก้)
  const canEdit = !acknowledged && (!isSubmitted || isReturned || editMode);
  const formLocked = !canEdit;

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

  // ดึงงานที่บันทึกไว้ "ระหว่างวัน" มาเติมรายงานอัตโนมัติ — idempotent (กดซ้ำได้ ไม่เพิ่มซ้ำ)
  // ใช้ buildAutoItems ร่วมกับหน้า CRM เพื่อให้ logic ตรงกัน คืนค่าจำนวนรายการใหม่ที่เพิ่มจริง
  async function pullAutoItems(reportId: string, existingItems: WItem[]): Promise<number> {
    try {
      if (!user) return 0;
      const candidates = await buildAutoItems(user, today, todayBkk);
      const fresh = dedupeAutoItems(candidates, existingItems.map(i => i.description));
      if (fresh.length === 0) return 0;
      const toInsert = fresh.map(c => ({ category: c.category, description: c.description, source: c.source, report_id: reportId }));
      const { data: ins, error } = await supabase.from("work_report_items").insert(toInsert).select();
      if (error) {
        console.error("Insert auto items error:", error);
        return 0;
      }
      if (ins) setItems(prev => [...prev, ...(ins as WItem[])]);
      return toInsert.length;
    } catch (err) {
      console.error("pullAutoItems error:", err);
      return 0;
    }
  }

  async function handleRefreshAuto() {
    if (!report || formLocked) return;
    setPulling(true);
    const n = await pullAutoItems(report.id, items);
    setPulling(false);
    showToast(n > 0 ? `ดึงงานระหว่างวันเพิ่ม ${n} รายการ ✓` : "ไม่มีงานใหม่ให้ดึง");
  }

  // ขอ AI ร่างโครงรายงานจากงานจริงที่บันทึกไว้ — เปิด modal ให้เลือกเพิ่ม
  async function generateDraft() {
    if (!report) return;
    setAiDraftModal(true);
    setAiDraftLoading(true);
    setAiDraftError(null);
    setAiDraftItems([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/reports/draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ reportId: report.id }),
      });
      const json = await res.json();
      if (!res.ok) { setAiDraftError(json?.error ?? "ร่างรายงานไม่สำเร็จ"); }
      else {
        setAiDraftNote(json.note ?? "");
        setAiDraftItems(((json.items ?? []) as { category: string; description: string }[]).map(it => ({ ...it, checked: true })));
      }
    } catch {
      setAiDraftError("เชื่อมต่อ AI ไม่สำเร็จ");
    }
    setAiDraftLoading(false);
  }

  // เพิ่มรายการที่เลือกจากร่าง AI ลงรายงานจริง (พนักงานแก้/เติมช่อง [____] ต่อได้)
  async function addDraftSelected() {
    if (!report) return;
    const chosen = aiDraftItems.filter(it => it.checked);
    if (chosen.length === 0) { setAiDraftModal(false); return; }
    setAiDraftAdding(true);
    const rows = chosen.map(it => ({ report_id: report.id, category: it.category, description: it.description, source: "ai_draft" }));
    const { data } = await supabase.from("work_report_items").insert(rows).select();
    if (data) setItems(prev => [...prev, ...(data as WItem[])]);
    setAiDraftAdding(false);
    setAiDraftModal(false);
    showToast(`เพิ่มร่าง ${chosen.length} รายการ — แก้/เติมช่อง [____] ได้เลย ✓`);
  }

  useEffect(() => {
    if (!user) return;
    if (user.isManager || user.isAdmin) return;

    // เปลี่ยนวันที่ → ล้างสถานะเดิมก่อนโหลดใหม่ (กันข้อมูลข้ามวันปน)
    setReport(null); setItems([]); setAttachments([]); setEditMode(false);
    setSummary(""); setWorkLocation("สำนักงาน");

    supabase.from("work_reports")
      .select("*")
      .eq("user_email", user.email)
      .eq("report_date", reportDate)
      .eq("report_type", "daily")
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setReport(data as WReport);
          // draft เก็บเฉพาะ summary/workLocation (offline) — items ยึดจาก DB เสมอ กัน draft เก่าทับ auto-item ใหม่
          const draft = loadDraftLocally(data.id);
          if (draft) {
            setSummary(draft.summary);
            setWorkLocation(draft.workLocation);
            setHasDraftChanges(true);
          } else {
            setSummary(data.summary ?? "");
            setWorkLocation(data.work_location ?? "สำนักงาน");
          }
          const { data: its } = await supabase.from("work_report_items").select("*").eq("report_id", data.id).order("created_at");
          const loaded = (its ?? []) as WItem[];
          setItems(loaded);
          // ดึงงานระหว่างวันมาเติม เฉพาะรายงาน "วันนี้" ที่ยังไม่ส่ง (auto-pull ดึงงานของวันนี้)
          if (reportDate === today && data.status !== "submitted" && data.status !== "late") {
            await pullAutoItems(data.id, loaded);
          }
          const { data: atts } = await supabase.from("work_report_attachments").select("*").eq("report_id", data.id);
          setAttachments(await Promise.all(((atts ?? []) as WAttachment[]).map(async a => ({ ...a, signed: (await toSignedUrl(a.file_url)) ?? undefined }))));
        } else {
          const { data: created } = await supabase.from("work_reports").insert({
            user_email: user.email,
            employee_name: user.full_name ?? user.email,
            department: user.department ?? "ไม่ระบุ",
            report_date: reportDate,
            report_type: "daily",
            summary: "",
            work_location: "สำนักงาน",
            status: "draft",
            is_backdated: reportDate !== today,
          }).select().single();
          if (created) {
            setReport(created as WReport);
            // ย้อนหลัง: ไม่ auto-pull (งานของวันนั้นไม่ได้อยู่ในกิจกรรมวันนี้) — กรอกเอง/ใช้ AI ร่าง
            if (reportDate === today) await pullAutoItems(created.id, []);
          }
        }
      });

    supabase.from("work_reports")
      .select("id, report_date, status, submitted_at")
      .eq("user_email", user.email)
      .eq("report_type", "daily")
      .neq("report_date", reportDate)
      .order("report_date", { ascending: false })
      .limit(14)
      .then(({ data }) => setHistory((data ?? []) as HistoryReport[]));
  }, [user?.email, reportDate]);

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

  async function uploadPhoto(file: File, idx = 0) {
    if (!report) return;
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop() ?? "jpg";
    const path = `rpt-${report.id}-${Date.now()}-${idx}.${ext}`;
    const { error } = await supabase.storage.from("document-attachments").upload(path, compressed, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("document-attachments").getPublicUrl(path);
      const att = { report_id: report.id, file_url: urlData.publicUrl, file_name: compressed.name };
      const { data } = await supabase.from("work_report_attachments").insert(att).select().single();
      if (data) { const d = data as WAttachment; d.signed = (await toSignedUrl(d.file_url)) ?? undefined; setAttachments(prev => [...prev, d]); }
    }
  }

  async function uploadPhotosMulti(files: File[]) {
    if (!report || !files.length) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) await uploadPhoto(files[i], i);
    setUploading(false);
  }

  // บันทึกคำบรรยายรูป (caption) — ให้ผู้บริหารเข้าใจว่ารูปคืออะไร/ที่ไหน
  function setCaptionLocal(idx: number, text: string) {
    setAttachments(prev => prev.map((a, i) => i === idx ? { ...a, caption: text } : a));
  }
  async function saveCaption(idx: number) {
    const att = attachments[idx];
    if (!att?.id) return;
    await supabase.from("work_report_attachments").update({ caption: (att.caption ?? "").trim() || null }).eq("id", att.id);
  }

  async function saveSummary() {
    if (!report || formLocked) return;
    setHasDraftChanges(true);
    saveDraftLocally({
      id: report.id,
      summary,
      workLocation,
      updatedAt: new Date().toISOString(),
    });
    if (online) {
      await supabase.from("work_reports").update({ summary, work_location: workLocation, updated_at: new Date().toISOString() }).eq("id", report.id);
      setHasDraftChanges(false);
    }
  }

  async function syncDraft() {
    if (!report || !online) return;
    setSyncing(true);
    try {
      await supabase.from("work_reports").update({ summary, work_location: workLocation, updated_at: new Date().toISOString() }).eq("id", report.id);
      clearDraftLocally(report.id);
      setHasDraftChanges(false);
      showToast("ซิงค์ร่างเรียบร้อย ✓");
    } catch (err) {
      showToast("ซิงค์ล้มเหลว — ยังเป็นร่างในเครื่อง", "error");
    }
    setSyncing(false);
  }

  async function doSubmit(lateR?: string) {
    if (!report) return;
    setSubmitting(true);
    const now = new Date();
    const isResubmit = report.status === "submitted" || report.status === "late";

    if (isResubmit) {
      // แก้รายงานที่ส่งแล้ว (ก่อนรับทราบ) → บันทึกการแก้ไข + ล้างสถานะตีกลับ + แจ้งผู้บริหารใหม่
      const { data } = await supabase.from("work_reports").update({
        summary, work_location: workLocation,
        last_edited_at: now.toISOString(),
        returned_at: null, return_reason: null,
        updated_at: now.toISOString(),
      }).eq("id", report.id).select().single();
      if (data) {
        setReport(data as WReport);
        await createNotification({
          type: "activity",
          title: "มีการแก้ไขรายงาน",
          message: `${report.employee_name} แก้ไขรายงานประจำวัน (${reportDate})`,
          from_dept: report.department,
          to_dept: "ผู้บริหาร",
          record_id: report.id,
          link: "/reports/review",
          line_to_depts: ["ผู้บริหาร"],
        });
      }
      setEditMode(false);
      setSubmitting(false);
      showToast("บันทึกการแก้ไขแล้ว — แจ้งผู้บริหารใหม่ ✓");
      return;
    }

    // ส่งครั้งแรก — ย้อนหลังถือเป็น submitted (ป้าย is_backdated บอกอยู่แล้ว) ไม่บังคับ late ตามเวลาปัจจุบัน
    const status: "submitted" | "late" = (!isBackdated && now.getHours() >= 18) ? "late" : "submitted";
    const { data } = await supabase.from("work_reports").update({
      status, summary, work_location: workLocation,
      submitted_at: now.toISOString(),
      late_reason: lateR ?? null,
      updated_at: now.toISOString(),
    }).eq("id", report.id).select().single();
    if (data) {
      setReport(data as WReport);
      const backTag = isBackdated ? " (ย้อนหลัง)" : "";
      await createNotification({
        type: "activity",
        title: status === "late" ? "มีรายงานส่งล่าช้า" : "มีรายงานการปฏิบัติงานใหม่",
        message: `${report.employee_name} ส่งรายงานประจำวันแล้ว${backTag} ${status === "late" ? "(ล่าช้า)" : ""}`,
        from_dept: report.department,
        to_dept: "ผู้บริหาร",
        record_id: report.id,
        link: "/reports/review",
        line_to_depts: ["ผู้บริหาร"],
      });
    }
    setSubmitting(false);
    setLateModal(false);
    showToast(status === "late" ? "ส่งรายงานล่าช้า — บันทึกแล้ว" : `ส่งรายงาน${isBackdated ? "ย้อนหลัง" : ""}เรียบร้อย ✓`);
  }

  function handleSubmit() {
    const firstSubmit = report?.status === "draft";
    // เตือนถ้าไม่มีรูปแนบ — เฉพาะตอนส่งครั้งแรก (ไม่กวนตอนแก้)
    if (firstSubmit && attachments.length === 0) { setNoPhotoModal(true); return; }
    proceedSubmit();
  }

  function proceedSubmit() {
    setNoPhotoModal(false);
    // late modal เฉพาะส่งครั้งแรกของวันนี้ (ไม่ใช่ตอนแก้/ย้อนหลัง)
    if (isLate && report?.status === "draft") { setLateModal(true); } else { doSubmit(); }
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
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">รายงานการปฏิบัติงาน</h1>
          </div>
          <div className="flex items-center gap-2">
            {!online && <WifiOff size={16} className="text-orange-400" />}
            {online && <Wifi size={16} className="text-green-400" />}
            {online && hasDraftChanges && (
              <button onClick={syncDraft} disabled={syncing} className="p-1 hover:bg-aviva-gold/20 rounded-lg transition-all disabled:opacity-50">
                <RefreshCw size={16} className={`text-yellow-400 ${syncing ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </div>
        {!online && <p className="text-xs text-orange-400 mt-2 max-w-lg mx-auto">ออนไลน์ไม่ได้ — ข้อมูลจะบันทึกเฉพาะในเครื่องจนกว่าจะเชื่อมต่ออินเทอร์เน็ต</p>}
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">

        {/* Date + Status */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-aviva-secondary">{isBackdated ? "รายงานย้อนหลัง" : "รายงานประจำวัน"}</p>
              <p className="text-sm font-bold text-aviva-text mt-0.5">{reportDateThai}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${sc.bg} ${sc.border} ${sc.color}`}>
              {sc.label}
            </div>
          </div>
          {/* ย้อนทำรายงานวันก่อน (ไม่เกิน 7 วัน) — แก้ปัญหาลืมส่งเมื่อวาน */}
          <div className="mt-3 flex items-center gap-2">
            <label className="text-[11px] text-aviva-secondary flex items-center gap-1 flex-shrink-0">
              <Clock size={11} className="text-aviva-gold" /> เลือกวันที่:
            </label>
            <input type="date" value={reportDate} min={minDate} max={today}
              onChange={e => { if (e.target.value) setReportDate(e.target.value); }}
              className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
            {isBackdated && (
              <button onClick={() => setReportDate(today)}
                className="text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-1.5 rounded-lg flex-shrink-0">วันนี้</button>
            )}
          </div>
          {report?.submitted_at && (
            <p className="text-[11px] text-aviva-secondary/60 mt-2 flex items-center gap-1">
              <Clock size={10} />
              ส่งเมื่อ {new Date(report.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
              {report.last_edited_at ? " · แก้ไขแล้ว" : ""}
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
              <button key={loc} disabled={formLocked}
                onClick={() => { setWorkLocation(loc); if (report && !formLocked) supabase.from("work_reports").update({ work_location: loc, updated_at: new Date().toISOString() }).eq("id", report.id); }}
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
            disabled={formLocked} rows={2} placeholder="สรุปสิ่งที่ทำวันนี้โดยย่อ..."
            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text resize-none focus:outline-none focus:border-aviva-gold/50 placeholder:text-aviva-secondary/30 disabled:opacity-50" />
        </GlassCard>

        {/* Items */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-aviva-secondary">รายการกิจกรรมวันนี้</p>
            <div className="flex items-center gap-2">
              {!formLocked && (
                <>
                  <button onClick={generateDraft} disabled={aiDraftLoading}
                    className="flex items-center gap-1 text-[10px] text-aviva-bg bg-aviva-gold font-semibold px-2 py-1 rounded-lg hover:opacity-90 transition-all disabled:opacity-50">
                    <Sparkles size={11} className={aiDraftLoading ? "animate-pulse" : ""} /> ร่างรายงานให้
                  </button>
                  <button onClick={handleRefreshAuto} disabled={pulling}
                    className="flex items-center gap-1 text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg hover:bg-aviva-gold/10 transition-all disabled:opacity-50">
                    <RefreshCw size={11} className={pulling ? "animate-spin" : ""} /> ดึงงานระหว่างวัน
                  </button>
                </>
              )}
              <span className="text-[10px] text-aviva-secondary/60">{items.length} รายการ</span>
            </div>
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
                    {(item.source === "auto" || item.source === "activity") && <span className="text-[9px] text-aviva-secondary/30">{item.source === "activity" ? "ระหว่างวัน" : "auto"}</span>}
                    {!formLocked && (
                      <button onClick={() => removeItem(idx)}>
                        <X size={12} className="text-aviva-secondary/30 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!formLocked && (
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-aviva-secondary">รูปภาพ / เอกสารแนบ</p>
            {attachments.length > 0 && <span className="text-[10px] text-aviva-secondary/60">{attachments.length} รูป</span>}
          </div>
          {!formLocked && (
            <p className="text-[10px] text-aviva-secondary/50 mb-3 leading-relaxed">💡 ใส่คำบรรยายใต้แต่ละรูป (เช่น &ldquo;A07 งานฉาบผนัง 80%&rdquo;) เพื่อให้ผู้บริหารเข้าใจรูปได้ชัดเจน</p>
          )}
          {attachments.length > 0 && (
            <div className="space-y-2.5 mb-3">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex gap-2.5 items-start">
                  <img src={att.signed ?? att.file_url} alt={att.caption ?? att.file_name}
                    className="w-16 h-16 flex-shrink-0 object-cover rounded-xl border border-aviva-gold/20" />
                  {formLocked ? (
                    <p className="flex-1 text-xs text-aviva-text leading-relaxed pt-1">
                      {att.caption || <span className="text-aviva-secondary/40 italic">— ไม่มีคำบรรยาย —</span>}
                    </p>
                  ) : (
                    <input
                      value={att.caption ?? ""}
                      onChange={e => setCaptionLocal(idx, e.target.value)}
                      onBlur={() => saveCaption(idx)}
                      placeholder="คำบรรยายรูปนี้ (รูปอะไร / ที่ไหน)"
                      className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text focus:outline-none focus:border-aviva-gold/50 placeholder:text-aviva-secondary/30" />
                  )}
                </div>
              ))}
            </div>
          )}
          {formLocked && attachments.length === 0 && (
            <p className="text-center text-aviva-secondary/50 italic text-xs py-3">❌ ไม่มีรูปภาพแนบในรายงานนี้</p>
          )}
          {!formLocked && (
            <label className="flex items-center gap-2.5 bg-aviva-bg border border-aviva-gold/20 border-dashed rounded-xl px-4 py-3 cursor-pointer hover:border-aviva-gold/50 transition-all">
              <Camera size={16} className="text-aviva-secondary/60 flex-shrink-0" />
              <span className="text-sm text-aviva-secondary/50">{uploading ? "กำลังอัปโหลด..." : "ถ่ายรูป / เลือกไฟล์ (ได้หลายรูป)"}</span>
              <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
                onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) uploadPhotosMulti(fs); e.target.value = ""; }} />
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
            {isBackdated && (
              <div className="flex items-center gap-2 p-3 bg-aviva-gold/10 rounded-xl border border-aviva-gold/20">
                <Clock size={13} className="text-aviva-gold flex-shrink-0" />
                <p className="text-xs text-aviva-gold">รายงานย้อนหลังของ {reportDateThai} — จะติดป้าย &lsquo;ย้อนหลัง&rsquo; ให้ผู้บริหารทราบ</p>
              </div>
            )}
            <button onClick={handleSubmit} disabled={submitting || (items.length === 0 && !summary.trim())}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Send size={14} />
              {submitting ? "กำลังส่ง..." : isBackdated ? "ส่งรายงานย้อนหลัง" : isLate ? "ส่งรายงาน (ล่าช้า)" : "ส่งรายงานประจำวัน"}
            </button>
            {items.length === 0 && !summary.trim() && (
              <p className="text-[11px] text-aviva-secondary/50 text-center">เพิ่มกิจกรรมอย่างน้อย 1 รายการ หรือกรอกสรุปภาพรวมก่อนส่ง</p>
            )}
          </div>
        ) : canEdit ? (
          <div className="space-y-2">
            {isReturned && (
              <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/30">
                <p className="text-xs font-bold text-orange-400 mb-1">↩️ ผู้บริหารตีกลับให้แก้ไข</p>
                {report?.return_reason && <p className="text-xs text-aviva-text leading-relaxed">{report.return_reason}</p>}
              </div>
            )}
            <button onClick={handleSubmit} disabled={submitting || (items.length === 0 && !summary.trim())}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Send size={14} />
              {submitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข & แจ้งผู้บริหาร"}
            </button>
            {editMode && !isReturned && (
              <button onClick={() => setEditMode(false)}
                className="w-full border border-aviva-gold/20 text-aviva-secondary font-medium py-2.5 rounded-xl text-xs">
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>
        ) : (
          <div className="bg-green-500/10 rounded-2xl border border-green-500/20 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-400">ส่งรายงานแล้ว{report?.is_backdated ? " (ย้อนหลัง)" : ""}</p>
                <p className="text-xs text-aviva-secondary/70 mt-0.5">
                  รายงานถูกบันทึกและส่งให้หัวหน้าเรียบร้อย
                  {report?.last_edited_at ? " · แก้ไขล่าสุดแล้ว" : ""}
                </p>
              </div>
            </div>
            {report?.acknowledged_by ? (
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
            ) : (
              <div className="mt-3 pt-3 border-t border-green-500/20 flex items-center justify-between gap-2">
                <p className="text-[10px] text-aviva-secondary/60">รอผู้จัดการรับทราบ — ยังแก้ไขได้</p>
                <button onClick={() => setEditMode(true)}
                  className="text-[11px] font-semibold text-aviva-gold border border-aviva-gold/30 px-3 py-1.5 rounded-lg hover:bg-aviva-gold/10 transition-all">
                  ✏️ แก้ไขรายงาน
                </button>
              </div>
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

      {/* AI draft modal — โครงที่ AI เสนอ เลือกเพิ่มลงรายงานได้ */}
      {aiDraftModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl max-h-[85vh] flex flex-col">
            <div className="sticky top-0 bg-aviva-card border-b border-aviva-gold/10 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-aviva-gold" />
                <h2 className="text-base font-bold text-aviva-text">ร่างรายงานโดย AI</h2>
              </div>
              <button onClick={() => setAiDraftModal(false)} className="text-aviva-secondary hover:text-aviva-text"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {aiDraftLoading ? (
                <p className="text-center text-sm text-aviva-secondary animate-pulse py-8">AI กำลังจัดโครงจากงานจริงของวันนี้...</p>
              ) : aiDraftError ? (
                <p className="text-center text-sm text-aviva-secondary/70 py-8">{aiDraftError}</p>
              ) : aiDraftItems.length === 0 ? (
                <p className="text-center text-sm text-aviva-secondary/70 py-8">ยังไม่มีข้อมูลพอให้ร่าง — ลองบันทึกงานหรือกด &lsquo;ดึงงานระหว่างวัน&rsquo; ก่อน</p>
              ) : (
                <>
                  <p className="text-[11px] text-aviva-secondary leading-relaxed bg-aviva-bg/50 rounded-xl px-3 py-2">
                    💡 AI จัดโครงจากงานจริง + เว้นช่อง <span className="text-aviva-gold font-semibold">[____]</span> ให้คุณเติมเอง — เลือกหัวข้อที่ต้องการแล้วกดเพิ่ม จากนั้นแก้/เติมรายละเอียดได้ในรายงาน
                    {aiDraftNote ? <><br />📌 {aiDraftNote}</> : null}
                  </p>
                  {aiDraftItems.map((it, idx) => {
                    const cat = CATEGORY_LABELS[it.category] ?? CATEGORY_LABELS.activity;
                    return (
                      <button key={idx} onClick={() => setAiDraftItems(prev => prev.map((p, i) => i === idx ? { ...p, checked: !p.checked } : p))}
                        className={`w-full flex items-start gap-2.5 rounded-xl px-3 py-2.5 border text-left transition-all ${it.checked ? "bg-aviva-gold/10 border-aviva-gold/40" : "bg-aviva-bg/50 border-aviva-gold/10"}`}>
                        <div className={`w-4 h-4 mt-0.5 rounded flex-shrink-0 border flex items-center justify-center ${it.checked ? "bg-aviva-gold border-aviva-gold" : "border-aviva-secondary/40"}`}>
                          {it.checked && <CheckCircle size={11} className="text-aviva-bg" />}
                        </div>
                        <span className={`text-[10px] font-bold mt-0.5 flex-shrink-0 ${cat.color}`}>[{cat.label}]</span>
                        <p className="flex-1 text-xs text-aviva-text leading-relaxed">{it.description}</p>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
            {!aiDraftLoading && aiDraftItems.length > 0 && (
              <div className="border-t border-aviva-gold/10 px-6 py-4">
                <button onClick={addDraftSelected} disabled={aiDraftAdding}
                  className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <Plus size={14} /> {aiDraftAdding ? "กำลังเพิ่ม..." : `เพิ่ม ${aiDraftItems.filter(i => i.checked).length} รายการที่เลือกลงรายงาน`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No-photo warning modal — soft warning, can proceed */}
      {noPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10">
            <div className="flex items-center gap-2 mb-3">
              <Camera size={16} className="text-aviva-gold" />
              <h2 className="text-base font-bold text-aviva-text">ยังไม่มีรูปภาพประกอบ</h2>
            </div>
            <p className="text-sm text-aviva-secondary leading-relaxed mb-5">
              รายงานนี้ยังไม่ได้แนบรูป — การแนบรูปพร้อมคำบรรยายช่วยให้ผู้บริหารเข้าใจงานของคุณได้ชัดเจนขึ้นมาก
              <br />ต้องการกลับไปแนบรูปก่อน หรือยืนยันส่งโดยไม่มีรูป?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setNoPhotoModal(false)}
                className="py-3 rounded-xl bg-aviva-gold text-aviva-bg font-bold text-sm">
                กลับไปแนบรูป
              </button>
              <button onClick={proceedSubmit}
                className="py-3 rounded-xl border border-aviva-gold/20 text-sm text-aviva-secondary">
                ส่งโดยไม่มีรูป
              </button>
            </div>
          </div>
        </div>
      )}

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
                          <div key={idx} className="space-y-1">
                            <img src={att.signed ?? att.file_url} alt={att.caption ?? att.file_name}
                              className="w-full aspect-square object-cover rounded-lg border border-aviva-gold/20" />
                            {att.caption && <p className="text-[10px] text-aviva-secondary leading-tight line-clamp-2">{att.caption}</p>}
                          </div>
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
