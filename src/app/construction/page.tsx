"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle, Clock, Plus, X, ClipboardList, Pencil, Bug, Printer, ChevronRight, ChevronDown, Camera, HardHat, FileText, Loader2, Check, Bot, Send, Trash2 } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import Toast, { type ToastType } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/notify";
import { useCurrentUser } from "@/lib/user-context";
import { generateDocNumber } from "@/lib/doc-numbers";
import { calcSlaDueAt } from "@/lib/approval-matrix";
import ReportSubmitModal, { type AutoReportItem } from "@/components/ReportSubmitModal";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

type HouseStatus = "complete" | "on-track" | "delayed" | "reserved" | "available";
type FilterStatus = "all" | "complete" | "building" | "on-track" | "delayed";
type Tab = "reports" | "defects";
type Part = "inspect" | "daily";

interface House {
  id: string;
  house_number: string;
  status: HouseStatus;
  progress: number;
  contractor: string;
  phase: string;
  delayed_days: number;
  planned_completion_date: string | null;
  site_engineer: string | null;
  plot_number: number | null;
  house_model: string | null;
  land_size: number | null;
}

interface Report {
  id: string;
  house_id: string;
  work_detail: string;
  work_type: string | null;
  progress: number;
  issue: string;
  created_at: string;
  photo_url: string | null;
  reported_by: string | null;
}

interface Defect {
  defect_id: string;
  house_id: string | null;
  defect_category: string;
  description: string;
  status: string;
  reported_at: string;
  resolved_at: string | null;
  severity: string;
  assigned_to: string;
  due_date: string | null;
}

interface Installment {
  id: string;
  house_id: string;
  installment_no: number;
  name: string;
  status: string;
  amount: number;
  rejection_reason?: string | null;
  rejection_count?: number | null;
}

interface WorkItem {
  id: string;
  template_id: string;
  item_name: string;
  seq_order: number;
}

interface Inspection {
  id: string;
  contractor_installment_id: string;
  work_item_id: string;
  work_item_name: string;
  result: 'pass' | 'fail' | 'pending';
  note: string | null;
  photo_url: string | null;
  sub_contractor_name: string | null;
  inspected_by: string | null;
  inspected_at: string | null;
}

interface InstTemplate {
  id: string;
  installment_number: number;
  name: string;
  description: string | null;
}

interface InstTask {
  id: string;
  installment_id: string;
  task_no: number;
  task_name: string;
  is_complete: boolean;
  photo_url: string | null;
  notes: string | null;
}

const statusConfig: Record<HouseStatus, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  complete:  { label: "เสร็จแล้ว",       icon: CheckCircle,    color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20" },
  "on-track":{ label: "ตามแผน",           icon: Clock,          color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20" },
  delayed:   { label: "ล่าช้า",           icon: AlertTriangle,  color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20" },
  reserved:  { label: "จองแล้ว (CRM)",   icon: CheckCircle,    color: "text-aviva-gold", bg: "bg-aviva-gold/10 border-aviva-gold/20" },
  available: { label: "พร้อมขาย (CRM)",  icon: CheckCircle,    color: "text-teal-400",   bg: "bg-teal-400/10 border-teal-400/20" },
};

const instStatusConfig: Record<string, { label: string; color: string }> = {
  pending:   { label: "รอดำเนินการ", color: "bg-gray-500/20 text-gray-400" },
  in_review: { label: "รอ ตรวจสอบ",  color: "bg-yellow-500/20 text-yellow-400" },
  approved:  { label: "อนุมัติแล้ว", color: "bg-blue-500/20 text-blue-400" },
  paid:      { label: "จ่ายแล้ว",    color: "bg-green-500/20 text-green-400" },
  rejected:  { label: "ถูกปฏิเสธ",  color: "bg-red-500/20 text-red-400" },
};

const INSTALLMENT_NAMES = [
  "งวดที่ 1 — ฐานราก", "งวดที่ 2 — คานคอดิน", "งวดที่ 3 — พื้นชั้น 1",
  "งวดที่ 4 — โครงสร้าง 1", "งวดที่ 5 — โครงหลังคา", "งวดที่ 6 — หลังคา",
  "งวดที่ 7 — โครงสร้าง", "งวดที่ 8 — ผนังเสร็จ", "งวดที่ 9 — หลังคาเสร็จ",
  "งวดที่ 10 — ไฟฟ้า ประปา", "งวดที่ 11 — ฉาบปูน", "งวดที่ 12 — กระเบื้อง",
  "งวดที่ 13 — สุขภัณฑ์", "งวดที่ 14 — ประตู หน้าต่าง", "งวดที่ 15 — สีรองพื้น",
  "งวดที่ 16 — สีทาบ้าน", "งวดที่ 17 — งานระบบ", "งวดที่ 18 — ตรวจรับ",
  "งวดที่ 19 — แก้ไข", "งวดที่ 20 — โอนกรรมสิทธิ์",
];

export default function ConstructionPage() {
  const { user } = useCurrentUser();
  const [houses, setHouses] = useState<House[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [instTemplates, setInstTemplates] = useState<InstTemplate[]>([]);
  const [instTasks, setInstTasks] = useState<InstTask[]>([]);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [activeTab, setActiveTab] = useState<Tab>("reports");
  const [activePart, setActivePart] = useState<Part>("daily");
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [showForm, setShowForm] = useState(false);
  const [showDefectForm, setShowDefectForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showInstDetail, setShowInstDetail] = useState<string | null>(null);
  const [confirmInst, setConfirmInst] = useState<Installment | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState<{ inst: Installment; reason: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportAutoItems, setReportAutoItems] = useState<AutoReportItem[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const defectPhotoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    work_detail: "",
    work_type: "",
    progress: 0,
    issue: "",
    photo_url: null as string | null,
    reported_by: "",
  });

  const [defectForm, setDefectForm] = useState({
    defect_category: "",
    description: "",
    severity: "medium",
    assigned_to: "",
    due_date: "",
  });

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: h }, { data: r }, { data: d }, { data: inst }, { data: insp }, { data: tmpl }, { data: tasks }] = await Promise.all([
      supabase.from("houses").select("*").eq("project_id", PROJECT_ID).order("plot_number", { ascending: true }),
      supabase.from("construction_reports").select("*").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }),
      supabase.from("defects").select("*").eq("project_id", PROJECT_ID).order("reported_at", { ascending: false }),
      supabase.from("contractor_installments").select("*").eq("project_id", PROJECT_ID).order("installment_no", { ascending: true }),
      supabase.from("installment_inspections").select("*").eq("project_id", PROJECT_ID),
      supabase.from("installment_templates").select("*").order("installment_number", { ascending: true }),
      supabase.from("installment_tasks").select("*"),
    ]);
    setHouses((h ?? []) as House[]);
    setReports((r ?? []) as Report[]);
    setDefects((d ?? []) as Defect[]);
    setInstallments((inst ?? []) as Installment[]);
    setInspections((insp ?? []) as Inspection[]);
    setInstTemplates((tmpl ?? []) as InstTemplate[]);
    setInstTasks((tasks ?? []) as InstTask[]);
    setLoading(false);
  }

  async function handlePhotoUpload(file: File, field: "photo_url"): Promise<string | null> {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `construction/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return null; }
    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
    setUploading(false);
    return urlData.publicUrl;
  }

  async function submitReport() {
    if (!selectedHouse || !form.work_detail) return;
    const docNo = await generateDocNumber("CON", PROJECT_ID);
    const { error } = await supabase.from("construction_reports").insert({
      house_id: selectedHouse.id,
      project_id: PROJECT_ID,
      work_detail: form.work_detail,
      work_type: form.work_type || null,
      progress: form.progress,
      issue: form.issue,
      photo_url: form.photo_url,
      reported_by: form.reported_by || user?.full_name || null,
      doc_number: docNo,
    });
    if (!error) {
      await supabase.from("houses").update({ progress: form.progress }).eq("id", selectedHouse.id);
      await createNotification({
        project_id: PROJECT_ID,
        type: "construction",
        title: `รายงานงานก่อสร้าง ${selectedHouse.house_number}`,
        message: form.work_detail,
        link: "/construction",
      });
      setForm({ work_detail: "", work_type: "", progress: 0, issue: "", photo_url: null, reported_by: "" });
      setShowForm(false);
      setToast({ msg: "บันทึกรายงานเรียบร้อยแล้ว", type: "success" });
      fetchAll();
    }
  }

  async function submitDefect() {
    if (!form.work_detail && !defectForm.description) return;
    const docNo = await generateDocNumber("DEF", PROJECT_ID);
    const slaAt = calcSlaDueAt("defect", defectForm.severity);
    const { error } = await supabase.from("defects").insert({
      house_id: selectedHouse?.id ?? null,
      project_id: PROJECT_ID,
      defect_category: defectForm.defect_category,
      description: defectForm.description,
      severity: defectForm.severity,
      assigned_to: defectForm.assigned_to,
      due_date: defectForm.due_date || slaAt || null,
      status: "open",
      doc_number: docNo,
    });
    if (!error) {
      await createNotification({
        project_id: PROJECT_ID,
        type: "defect",
        title: `พบ Defect${selectedHouse ? ` บ้านเลขที่ ${selectedHouse.house_number}` : ""}`,
        message: defectForm.description,
        link: "/construction",
      });
      setDefectForm({ defect_category: "", description: "", severity: "medium", assigned_to: "", due_date: "" });
      setShowDefectForm(false);
      setToast({ msg: "บันทึก Defect เรียบร้อยแล้ว", type: "success" });
      fetchAll();
    }
  }

  async function doAdvanceInst(inst: Installment) {
    const nextStatus: Record<string, string> = { pending: "in_review", in_review: "approved", approved: "paid" };
    const next = nextStatus[inst.status];
    if (!next) return;
    const docNo = await generateDocNumber("INS", PROJECT_ID);
    const slaAt = calcSlaDueAt("installment", inst.status);
    await supabase.from("contractor_installments").update({ status: next, doc_number: docNo, sla_due_at: slaAt }).eq("id", inst.id);
    await supabase.from("approval_logs").insert({
      project_id: PROJECT_ID,
      doc_type: "installment",
      doc_id: inst.id,
      action: next,
      actor_id: user?.id ?? null,
      actor_name: user?.full_name ?? "ไม่ระบุ",
      note: `เปลี่ยนสถานะ ${instStatusConfig[inst.status]?.label} → ${instStatusConfig[next]?.label}`,
    });
    await createNotification({
      project_id: PROJECT_ID,
      type: "installment",
      title: `งวดงาน ${inst.name} — ${instStatusConfig[next]?.label}`,
      message: `อัปเดตสถานะงวดงานเรียบร้อยแล้ว`,
      link: "/construction",
    });
    setConfirmInst(null);
    setToast({ msg: `อัปเดตงวดงานเป็น "${instStatusConfig[next]?.label}" เรียบร้อยแล้ว`, type: "success" });
    fetchAll();
  }

  async function doRejectInst(inst: Installment, reason: string) {
    await supabase.from("contractor_installments").update({
      status: "rejected",
      rejection_reason: reason,
      rejection_count: (inst.rejection_count ?? 0) + 1,
    }).eq("id", inst.id);
    await supabase.from("approval_logs").insert({
      project_id: PROJECT_ID,
      doc_type: "installment",
      doc_id: inst.id,
      action: "rejected",
      actor_id: user?.id ?? null,
      actor_name: user?.full_name ?? "ไม่ระบุ",
      note: reason,
    });
    setShowRejectModal(null);
    setToast({ msg: "ปฏิเสธงวดงานเรียบร้อยแล้ว", type: "error" });
    fetchAll();
  }

  async function toggleInstTask(task: InstTask) {
    await supabase.from("installment_tasks").update({ is_complete: !task.is_complete }).eq("id", task.id);
    fetchAll();
  }

  const filteredHouses = houses.filter(h => {
    if (filterStatus === "all") return true;
    if (filterStatus === "building") return h.status === "on-track" || h.status === "delayed";
    return h.status === filterStatus;
  });

  const houseReports = selectedHouse ? reports.filter(r => r.house_id === selectedHouse.id) : [];
  const houseDefects = selectedHouse ? defects.filter(d => d.house_id === selectedHouse.id) : [];
  const houseInsts = selectedHouse ? installments.filter(i => i.house_id === selectedHouse.id) : [];

  const stats = {
    total: houses.length,
    complete: houses.filter(h => h.status === "complete").length,
    onTrack: houses.filter(h => h.status === "on-track").length,
    delayed: houses.filter(h => h.status === "delayed").length,
    openDefects: defects.filter(d => d.status === "open").length,
    pendingInst: installments.filter(i => i.status === "pending" || i.status === "in_review").length,
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-aviva-gold" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen pb-24 space-y-6 px-4 pt-4">
      <SectionHeader
        icon={<HardHat className="text-aviva-gold" size={22} />}
        title="ฝ่ายก่อสร้าง"
        subtitle="ติดตามความคืบหน้า งวดงาน และ Defect"
        right={
          <div className="flex items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            <button onClick={() => setShowAI(v => !v)} className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/20 text-aviva-gold">
              <Bot size={18} />
            </button>
          </div>
        }
      />

      {showAI && (
        <AIInsightPanel
          department="construction"
          contextData={{ stats, recentReports: reports.slice(0, 5), recentDefects: defects.slice(0, 5) }}
          onClose={() => setShowAI(false)}
        />
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "บ้านทั้งหมด", value: stats.total, color: "text-aviva-text" },
          { label: "เสร็จแล้ว", value: stats.complete, color: "text-green-400" },
          { label: "ตามแผน", value: stats.onTrack, color: "text-blue-400" },
          { label: "ล่าช้า", value: stats.delayed, color: "text-red-400" },
          { label: "Defect เปิด", value: stats.openDefects, color: "text-orange-400" },
          { label: "รอเบิกงวด", value: stats.pendingInst, color: "text-yellow-400" },
        ].map(s => (
          <GlassCard key={s.label} className="p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-aviva-secondary mt-0.5">{s.label}</div>
          </GlassCard>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(["all", "complete", "building", "on-track", "delayed"] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={clsx(
              "flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
              filterStatus === f
                ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}
          >
            {f === "all" ? "ทั้งหมด" : f === "complete" ? "เสร็จแล้ว" : f === "building" ? "กำลังก่อสร้าง" : f === "on-track" ? "ตามแผน" : "ล่าช้า"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filteredHouses.map(house => {
          const cfg = statusConfig[house.status] ?? statusConfig["on-track"];
          const Icon = cfg.icon;
          return (
            <GlassCard
              key={house.id}
              className={clsx("p-3 cursor-pointer border", cfg.bg, selectedHouse?.id === house.id && "ring-1 ring-aviva-gold")}
              onClick={() => setSelectedHouse(selectedHouse?.id === house.id ? null : house)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-bold text-aviva-text">บ้าน {house.house_number}</div>
                  {house.plot_number && <div className="text-xs text-aviva-secondary">แปลง {house.plot_number}</div>}
                </div>
                <Icon size={16} className={cfg.color} />
              </div>
              <ProgressBar value={house.progress} className="mb-1" />
              <div className="flex items-center justify-between">
                <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-aviva-secondary">{house.progress}%</span>
              </div>
              {house.delayed_days > 0 && (
                <div className="mt-1 text-xs text-red-400">ล่าช้า {house.delayed_days} วัน</div>
              )}
              {house.phase && (
                <div className="mt-1 text-xs text-aviva-secondary truncate">{house.phase}</div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {selectedHouse && (
        <GlassCard className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-aviva-text">บ้าน {selectedHouse.house_number}</h2>
              <div className="text-xs text-aviva-secondary space-y-0.5 mt-0.5">
                {selectedHouse.plot_number && <div>แปลงที่ {selectedHouse.plot_number}</div>}
                {selectedHouse.house_model && <div>แบบ {selectedHouse.house_model}</div>}
                {selectedHouse.land_size && <div>ขนาดที่ดิน {selectedHouse.land_size} ตร.ว.</div>}
                {selectedHouse.contractor && <div>ผู้รับเหมา: {selectedHouse.contractor}</div>}
                {selectedHouse.site_engineer && <div>วิศวกรสนาม: {selectedHouse.site_engineer}</div>}
                {selectedHouse.planned_completion_date && (
                  <div>กำหนดแล้วเสร็จ: {new Date(selectedHouse.planned_completion_date).toLocaleDateString("th-TH")}</div>
                )}
              </div>
            </div>
            <button onClick={() => setSelectedHouse(null)} className="text-aviva-secondary">
              <X size={18} />
            </button>
          </div>

          <ProgressBar value={selectedHouse.progress} label={`ความคืบหน้า ${selectedHouse.progress}%`} />

          <div className="flex gap-2">
            {(["reports", "defects"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={clsx(
                  "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                  activeTab === t ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                )}
              >
                {t === "reports" ? "รายงานงาน" : "Defect"}
              </button>
            ))}
          </div>

          {activeTab === "reports" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["daily", "inspect"] as Part[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setActivePart(p)}
                    className={clsx(
                      "flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all",
                      activePart === p ? "bg-aviva-gold/20 text-aviva-gold border-aviva-gold/30" : "text-aviva-secondary border-aviva-gold/10"
                    )}
                  >
                    {p === "daily" ? "รายงานประจำวัน" : "ตรวจงวดงาน"}
                  </button>
                ))}
              </div>

              {activePart === "daily" && (
                <>
                  <button
                    onClick={() => setShowForm(v => !v)}
                    className="w-full py-2.5 rounded-xl bg-aviva-gold/10 border border-aviva-gold/20 text-aviva-gold text-xs font-medium flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> เพิ่มรายงาน
                  </button>

                  {showForm && (
                    <div className="space-y-3 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                      <div>
                        <label className="text-xs text-aviva-secondary mb-1 block">ประเภทงาน</label>
                        <select
                          value={form.work_type}
                          onChange={e => setForm(f => ({ ...f, work_type: e.target.value }))}
                          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text"
                        >
                          <option value="">เลือกประเภทงาน</option>
                          {["งานโครงสร้าง", "งานสถาปัตย์", "งานระบบไฟฟ้า", "งานระบบประปา", "งานระบบสุขาภิบาล", "งานตกแต่ง", "งานภูมิทัศน์", "อื่นๆ"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียดงาน *</label>
                        <textarea
                          value={form.work_detail}
                          onChange={e => setForm(f => ({ ...f, work_detail: e.target.value }))}
                          rows={3}
                          placeholder="รายละเอียดงานที่ทำวันนี้..."
                          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder-aviva-secondary/40 resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-aviva-secondary mb-1 block">ความคืบหน้า (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.progress}
                          onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
                          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-aviva-secondary mb-1 block">ปัญหาที่พบ</label>
                        <textarea
                          value={form.issue}
                          onChange={e => setForm(f => ({ ...f, issue: e.target.value }))}
                          rows={2}
                          placeholder="ปัญหาหรืออุปสรรค (ถ้ามี)..."
                          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder-aviva-secondary/40 resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-aviva-secondary mb-1 block">ผู้รายงาน</label>
                        <input
                          type="text"
                          value={form.reported_by}
                          onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))}
                          placeholder={user?.full_name ?? "ชื่อผู้รายงาน"}
                          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder-aviva-secondary/40"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-aviva-secondary mb-1 block">รูปภาพ</label>
                        <input
                          ref={photoRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const url = await handlePhotoUpload(file, "photo_url");
                            if (url) setForm(f => ({ ...f, photo_url: url }));
                          }}
                        />
                        <button
                          onClick={() => photoRef.current?.click()}
                          className="w-full py-2 rounded-xl border border-dashed border-aviva-gold/20 text-aviva-secondary text-xs flex items-center justify-center gap-2"
                        >
                          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                          {form.photo_url ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                        </button>
                        {form.photo_url && (
                          <img src={form.photo_url} alt="preview" className="mt-2 w-full rounded-xl object-cover max-h-40" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-aviva-gold/20 text-aviva-secondary text-xs">ยกเลิก</button>
                        <button onClick={submitReport} disabled={!form.work_detail} className="flex-1 py-2.5 rounded-xl bg-aviva-gold text-aviva-bg text-xs font-bold disabled:opacity-40">บันทึก</button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {houseReports.length === 0 ? (
                      <p className="text-xs text-aviva-secondary text-center py-4">ยังไม่มีรายงาน</p>
                    ) : (
                      houseReports.map(r => (
                        <div key={r.id} className="p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10 space-y-1">
                          <div className="flex items-start justify-between">
                            <div className="text-xs font-medium text-aviva-text">{r.work_detail}</div>
                            <div className="text-xs text-aviva-secondary ml-2 flex-shrink-0">{r.progress}%</div>
                          </div>
                          {r.work_type && <div className="text-xs text-aviva-secondary">{r.work_type}</div>}
                          {r.issue && <div className="text-xs text-red-400">⚠ {r.issue}</div>}
                          {r.reported_by && <div className="text-xs text-aviva-secondary">โดย: {r.reported_by}</div>}
                          <div className="text-xs text-aviva-secondary">{new Date(r.created_at).toLocaleDateString("th-TH")}</div>
                          {r.photo_url && (
                            <img src={r.photo_url} alt="report" className="w-full rounded-lg object-cover max-h-32 mt-1" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {activePart === "inspect" && (
                <div className="space-y-3">
                  <div className="text-xs text-aviva-secondary">งวดงานทั้งหมด {houseInsts.length} งวด</div>
                  {houseInsts.map(inst => {
                    const cfg = instStatusConfig[inst.status] ?? instStatusConfig["pending"];
                    const isDetail = showInstDetail === inst.id;
                    const tmpl = instTemplates.find(t => t.installment_number === inst.installment_no);
                    const tasks = instTasks.filter(t => t.installment_id === inst.id);
                    const instInspections = inspections.filter(i => i.contractor_installment_id === inst.id);
                    const canAdvance = inst.status !== "paid" && inst.status !== "rejected";
                    const nextStatus: Record<string, string> = { pending: "in_review", in_review: "approved", approved: "paid" };
                    const nextLabel = instStatusConfig[nextStatus[inst.status]]?.label;

                    return (
                      <div key={inst.id} className="rounded-xl border border-aviva-gold/10 overflow-hidden">
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer bg-aviva-bg"
                          onClick={() => setShowInstDetail(isDetail ? null : inst.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-aviva-text truncate">
                              {INSTALLMENT_NAMES[inst.installment_no - 1] ?? inst.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                              {inst.amount > 0 && (
                                <span className="text-xs text-aviva-secondary">฿{inst.amount.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {isDetail ? <ChevronDown size={16} className="text-aviva-secondary" /> : <ChevronRight size={16} className="text-aviva-secondary" />}
                          </div>
                        </div>

                        {isDetail && (
                          <div className="p-3 space-y-3 border-t border-aviva-gold/10 bg-aviva-card/30">
                            {inst.rejection_reason && (
                              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                                เหตุผลที่ปฏิเสธ: {inst.rejection_reason}
                                {inst.rejection_count && inst.rejection_count > 1 && ` (ครั้งที่ ${inst.rejection_count})`}
                              </div>
                            )}

                            {tmpl?.description && (
                              <p className="text-xs text-aviva-secondary">{tmpl.description}</p>
                            )}

                            {tasks.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-aviva-text">รายการตรวจสอบ</div>
                                {tasks.map(task => (
                                  <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-aviva-bg">
                                    <button
                                      onClick={() => toggleInstTask(task)}
                                      className={clsx(
                                        "mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border",
                                        task.is_complete ? "bg-green-500 border-green-500" : "border-aviva-gold/30 bg-transparent"
                                      )}
                                    >
                                      {task.is_complete && <Check size={10} className="text-white" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <div className={clsx("text-xs", task.is_complete && "line-through text-aviva-secondary")}>
                                        {task.task_no}. {task.task_name}
                                      </div>
                                      {task.notes && <div className="text-xs text-aviva-secondary mt-0.5">{task.notes}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {instInspections.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-aviva-text">ผลการตรวจสอบ</div>
                                {instInspections.map(insp => (
                                  <div key={insp.id} className={clsx(
                                    "p-2 rounded-lg text-xs border",
                                    insp.result === "pass" ? "bg-green-500/10 border-green-500/20" :
                                    insp.result === "fail" ? "bg-red-500/10 border-red-500/20" :
                                    "bg-gray-500/10 border-gray-500/20"
                                  )}>
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">{insp.work_item_name}</span>
                                      <span className={insp.result === "pass" ? "text-green-400" : insp.result === "fail" ? "text-red-400" : "text-gray-400"}>
                                        {insp.result === "pass" ? "ผ่าน" : insp.result === "fail" ? "ไม่ผ่าน" : "รอตรวจ"}
                                      </span>
                                    </div>
                                    {insp.note && <div className="text-aviva-secondary mt-1">{insp.note}</div>}
                                    {insp.inspected_by && <div className="text-aviva-secondary mt-0.5">ตรวจโดย: {insp.inspected_by}</div>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {canAdvance && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmInst(inst)}
                                  className="flex-1 py-2 rounded-xl bg-aviva-gold text-aviva-bg text-xs font-bold"
                                >
                                  {nextLabel ? `ส่ง: ${nextLabel}` : "ดำเนินการต่อ"}
                                </button>
                                {inst.status === "in_review" && (
                                  <button
                                    onClick={() => setShowRejectModal({ inst, reason: "" })}
                                    className="py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                                  >
                                    ปฏิเสธ
                                  </button>
                                )}
                              </div>
                            )}

                            <button
                              onClick={async () => {
                                const printContent = `
                                  <html><head><title>งวดงาน ${inst.name}</title></head><body>
                                  <h2>${INSTALLMENT_NAMES[inst.installment_no - 1] ?? inst.name}</h2>
                                  <p>สถานะ: ${instStatusConfig[inst.status]?.label}</p>
                                  <p>มูลค่า: ฿${inst.amount.toLocaleString()}</p>
                                  ${tasks.map(t => `<p>${t.is_complete ? "✓" : "○"} ${t.task_no}. ${t.task_name}</p>`).join("")}
                                  </body></html>
                                `;
                                const w = window.open("", "_blank");
                                if (w) { w.document.write(printContent); w.document.close(); w.print(); }
                              }}
                              className="w-full py-2 rounded-xl border border-aviva-gold/20 text-aviva-secondary text-xs flex items-center justify-center gap-2"
                            >
                              <Printer size={12} /> พิมพ์ใบงวด
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "defects" && (
            <div className="space-y-3">
              <button
                onClick={() => setShowDefectForm(v => !v)}
                className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center justify-center gap-2"
              >
                <Bug size={14} /> แจ้ง Defect
              </button>

              {showDefectForm && (
                <div className="space-y-3 p-3 rounded-xl bg-aviva-bg border border-red-500/20">
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                    <select
                      value={defectForm.defect_category}
                      onChange={e => setDefectForm(f => ({ ...f, defect_category: e.target.value }))}
                      className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text"
                    >
                      <option value="">เลือกหมวดหมู่</option>
                      {["งานโครงสร้าง", "งานสถาปัตย์", "งานไฟฟ้า", "งานประปา", "งานสุขาภิบาล", "งานตกแต่ง", "อื่นๆ"].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                    <textarea
                      value={defectForm.description}
                      onChange={e => setDefectForm(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      placeholder="อธิบายปัญหาที่พบ..."
                      className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder-aviva-secondary/40 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">ความรุนแรง</label>
                    <div className="flex gap-2">
                      {[{ v: "low", l: "ต่ำ" }, { v: "medium", l: "กลาง" }, { v: "high", l: "สูง" }, { v: "critical", l: "วิกฤต" }].map(s => (
                        <button
                          key={s.v}
                          onClick={() => setDefectForm(f => ({ ...f, severity: s.v }))}
                          className={clsx(
                            "flex-1 py-1.5 rounded-xl text-xs border transition-all",
                            defectForm.severity === s.v
                              ? s.v === "critical" ? "bg-red-500 border-red-500 text-white"
                                : s.v === "high" ? "bg-orange-500 border-orange-500 text-white"
                                : s.v === "medium" ? "bg-yellow-500 border-yellow-500 text-aviva-bg"
                                : "bg-green-500 border-green-500 text-white"
                              : "border-aviva-gold/10 text-aviva-secondary"
                          )}
                        >
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">มอบหมายให้</label>
                    <input
                      type="text"
                      value={defectForm.assigned_to}
                      onChange={e => setDefectForm(f => ({ ...f, assigned_to: e.target.value }))}
                      placeholder="ชื่อผู้รับผิดชอบ..."
                      className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder-aviva-secondary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">กำหนดแก้ไข</label>
                    <input
                      type="date"
                      value={defectForm.due_date}
                      onChange={e => setDefectForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDefectForm(false)} className="flex-1 py-2.5 rounded-xl border border-aviva-gold/20 text-aviva-secondary text-xs">ยกเลิก</button>
                    <button onClick={submitDefect} disabled={!defectForm.description} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold disabled:opacity-40">แจ้ง Defect</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {houseDefects.length === 0 ? (
                  <p className="text-xs text-aviva-secondary text-center py-4">ไม่มี Defect</p>
                ) : (
                  houseDefects.map(d => (
                    <div key={d.defect_id} className={clsx(
                      "p-3 rounded-xl border space-y-1",
                      d.status === "open" ? "bg-red-500/5 border-red-500/20" :
                      d.status === "in_progress" ? "bg-yellow-500/5 border-yellow-500/20" :
                      "bg-green-500/5 border-green-500/20"
                    )}>
                      <div className="flex items-start justify-between">
                        <div className="text-xs font-medium text-aviva-text">{d.description}</div>
                        <span className={clsx(
                          "text-xs px-1.5 py-0.5 rounded ml-2 flex-shrink-0",
                          d.severity === "critical" ? "bg-red-500 text-white" :
                          d.severity === "high" ? "bg-orange-500 text-white" :
                          d.severity === "medium" ? "bg-yellow-500 text-aviva-bg" :
                          "bg-green-500 text-white"
                        )}>
                          {d.severity === "critical" ? "วิกฤต" : d.severity === "high" ? "สูง" : d.severity === "medium" ? "กลาง" : "ต่ำ"}
                        </span>
                      </div>
                      {d.defect_category && <div className="text-xs text-aviva-secondary">{d.defect_category}</div>}
                      {d.assigned_to && <div className="text-xs text-aviva-secondary">มอบหมาย: {d.assigned_to}</div>}
                      {d.due_date && <div className="text-xs text-aviva-secondary">กำหนด: {new Date(d.due_date).toLocaleDateString("th-TH")}</div>}
                      <div className="text-xs text-aviva-secondary">{new Date(d.reported_at).toLocaleDateString("th-TH")}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {!selectedHouse && (
        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-aviva-text flex items-center gap-2">
              <Bug size={16} className="text-red-400" /> Defect ทั้งหมด
            </h3>
            <button
              onClick={() => setShowDefectForm(v => !v)}
              className="text-xs text-aviva-gold flex items-center gap-1"
            >
              <Plus size={12} /> แจ้งใหม่
            </button>
          </div>

          {showDefectForm && (
            <div className="space-y-3 p-3 rounded-xl bg-aviva-bg border border-red-500/20">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select
                  value={defectForm.defect_category}
                  onChange={e => setDefectForm(f => ({ ...f, defect_category: e.target.value }))}
                  className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text"
                >
                  <option value="">เลือกหมวดหมู่</option>
                  {["งานโครงสร้าง", "งานสถาปัตย์", "งานไฟฟ้า", "งานประปา", "งานสุขาภิบาล", "งานตกแต่ง", "อื่นๆ"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                <textarea
                  value={defectForm.description}
                  onChange={e => setDefectForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="อธิบายปัญหาที่พบ..."
                  className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder-aviva-secondary/40 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ความรุนแรง</label>
                <div className="flex gap-2">
                  {[{ v: "low", l: "ต่ำ" }, { v: "medium", l: "กลาง" }, { v: "high", l: "สูง" }, { v: "critical", l: "วิกฤต" }].map(s => (
                    <button
                      key={s.v}
                      onClick={() => setDefectForm(f => ({ ...f, severity: s.v }))}
                      className={clsx(
                        "flex-1 py-1.5 rounded-xl text-xs border transition-all",
                        defectForm.severity === s.v
                          ? s.v === "critical" ? "bg-red-500 border-red-500 text-white"
                            : s.v === "high" ? "bg-orange-500 border-orange-500 text-white"
                            : s.v === "medium" ? "bg-yellow-500 border-yellow-500 text-aviva-bg"
                            : "bg-green-500 border-green-500 text-white"
                          : "border-aviva-gold/10 text-aviva-secondary"
                      )}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">มอบหมายให้</label>
                <input
                  type="text"
                  value={defectForm.assigned_to}
                  onChange={e => setDefectForm(f => ({ ...f, assigned_to: e.target.value }))}
                  placeholder="ชื่อผู้รับผิดชอบ..."
                  className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder-aviva-secondary/40"
                />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">กำหนดแก้ไข</label>
                <input
                  type="date"
                  value={defectForm.due_date}
                  onChange={e => setDefectForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowDefectForm(false)} className="flex-1 py-2.5 rounded-xl border border-aviva-gold/20 text-aviva-secondary text-xs">ยกเลิก</button>
                <button onClick={submitDefect} disabled={!defectForm.description} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold disabled:opacity-40">แจ้ง Defect</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {defects.length === 0 ? (
              <p className="text-xs text-aviva-secondary text-center py-4">ไม่มี Defect</p>
            ) : (
              defects.slice(0, 10).map(d => (
                <div key={d.defect_id} className={clsx(
                  "p-3 rounded-xl border space-y-1",
                  d.status === "open" ? "bg-red-500/5 border-red-500/20" :
                  d.status === "in_progress" ? "bg-yellow-500/5 border-yellow-500/20" :
                  "bg-green-500/5 border-green-500/20"
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-medium text-aviva-text">{d.description}</div>
                      {d.house_id && (
                        <div className="text-xs text-aviva-secondary">
                          บ้าน {houses.find(h => h.id === d.house_id)?.house_number ?? "—"}
                        </div>
                      )}
                    </div>
                    <span className={clsx(
                      "text-xs px-1.5 py-0.5 rounded ml-2 flex-shrink-0",
                      d.severity === "critical" ? "bg-red-500 text-white" :
                      d.severity === "high" ? "bg-orange-500 text-white" :
                      d.severity === "medium" ? "bg-yellow-500 text-aviva-bg" :
                      "bg-green-500 text-white"
                    )}>
                      {d.severity === "critical" ? "วิกฤต" : d.severity === "high" ? "สูง" : d.severity === "medium" ? "กลาง" : "ต่ำ"}
                    </span>
                  </div>
                  {d.defect_category && <div className="text-xs text-aviva-secondary">{d.defect_category}</div>}
                  {d.assigned_to && <div className="text-xs text-aviva-secondary">มอบหมาย: {d.assigned_to}</div>}
                  {d.due_date && <div className="text-xs text-aviva-secondary">กำหนด: {new Date(d.due_date).toLocaleDateString("th-TH")}</div>}
                </div>
              ))
            )}
          </div>
        </GlassCard>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-aviva-card rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-aviva-text">เหตุผลที่ปฏิเสธ</h2>
            <textarea
              value={showRejectModal.reason}
              onChange={e => setShowRejectModal(v => v ? { ...v, reason: e.target.value } : null)}
              rows={3}
              placeholder="ระบุเหตุผล..."
              className="w-full bg-aviva-bg border border-aviva-gold/10 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder-aviva-secondary/40 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(null)} className="flex-1 py-3 rounded-xl border border-aviva-gold/20 text-aviva-secondary text-sm">ยกเลิก</button>
              <button
                onClick={() => doRejectInst(showRejectModal.inst, showRejectModal.reason)}
                disabled={!showRejectModal.reason}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-40"
              >
                ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-aviva-card rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-aviva-text">ยืนยันการส่งเบิก?</h2>
            <p className="text-sm text-aviva-secondary">{confirmInst.name} — เปลี่ยนสถานะเป็น &quot;{instStatusConfig[({ pending: "in_review", in_review: "approved", approved: "paid" } as Record<string,string>)[confirmInst.status] ?? confirmInst.status]?.label}&quot;</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmInst(null)} className="flex-1 py-3 rounded-xl border border-aviva-gold/20 text-aviva-secondary text-sm">ยกเลิก</button>
              <button onClick={() => doAdvanceInst(confirmInst)} className="flex-1 py-3 rounded-xl bg-aviva-gold text-aviva-bg font-bold text-sm">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={async () => {
          const today = new Date().toISOString().split("T")[0];
          const items: AutoReportItem[] = [];
          const { data: rpts } = await supabase
            .from("construction_reports")
            .select("work_detail,work_type,issue")
            .eq("project_id", PROJECT_ID)
            .gte("created_at", today);
          (rpts ?? []).forEach((r: { work_detail: string; work_type: string | null; issue: string }) => {
            items.push({ category: "activity", description: `${r.work_type ?? "งาน"}: ${r.work_detail}${r.issue ? ` — ${r.issue}` : ""}` });
          });
          setReportAutoItems(items);
          setShowReportModal(true);
        }}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 bg-aviva-gold text-aviva-bg font-bold text-xs px-4 py-2.5 rounded-2xl shadow-lg shadow-aviva-gold/20 hover:bg-aviva-gold/90 active:scale-95 transition-all"
      >
        <Send size={14} /> ส่งรายงานวัน
      </button>

      <ReportSubmitModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        department={user?.department ?? "ฝ่ายก่อสร้าง"}
        autoItems={reportAutoItems}
        onSubmitted={() => setToast({ msg: "ส่งรายงานประจำวันเรียบร้อยแล้ว", type: "success" })}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
