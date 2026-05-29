"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Clock, Plus, X, ClipboardList, Pencil, Bug, Printer, ChevronRight, ChevronDown, Camera, HardHat, FileText, Loader2 } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import Toast, { type ToastType } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/notify";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

type HouseStatus = "complete" | "on-track" | "delayed";
type Tab = "units" | "reports" | "defects" | "installments";
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
}

interface Report {
  id: string;
  house_id: string;
  work_detail: string;
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

const statusConfig = {
  complete: { label: "เสร็จแล้ว", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  "on-track": { label: "ตามแผน", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  delayed: { label: "ล่าช้า", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
};

const instStatusConfig: Record<string, { label: string; color: string }> = {
  pending:    { label: "รอดำเนินการ", color: "bg-gray-500/20 text-gray-400" },
  in_review:  { label: "รอตรวจสอบ", color: "bg-yellow-500/20 text-yellow-400" },
  approved:   { label: "อนุมัติแล้ว", color: "bg-blue-500/20 text-blue-400" },
  paid:       { label: "จ่ายแล้ว",  color: "bg-green-500/20 text-green-400" },
};

const INSTALLMENT_NAMES = [
  "งวด 1 — งานฐานราก",
  "งวด 2 — งานเสาและคาน",
  "งวด 3 — งานพื้นชั้น 1",
  "งวด 4 — งานผนังชั้น 1",
  "งวด 5 — งานโครงหลังคา",
  "งวด 6 — งานหลังคา",
  "งวด 7 — งานผนังภายนอก",
  "งวด 8 — งานระบบน้ำ-ไฟ",
  "งวด 9 — งานตกแต่งภายใน",
  "งวด 10 — งานส่งมอบ",
];

const defectStatusConfig: Record<string, { label: string; color: string }> = {
  Open: { label: "พบปัญหา", color: "bg-red-500/20 text-red-400" },
  "In Progress": { label: "กำลังแก้ไข", color: "bg-yellow-500/20 text-yellow-400" },
  Resolved: { label: "แก้ไขแล้ว", color: "bg-green-500/20 text-green-400" },
};

const DEFECT_CATEGORIES = ["งานสี", "งานฝ้า", "งานพื้น", "งานประตู-หน้าต่าง", "งานระบบน้ำ", "งานไฟฟ้า", "อื่นๆ"];

const progressColor = (pct: number): "gold" | "green" | "red" =>
  pct === 100 ? "green" : pct < 50 ? "red" : "gold";

export default function ConstructionPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | HouseStatus>("all");
  const [part, setPart] = useState<Part>("inspect");
  const [tab, setTab] = useState<Tab>("units");
  const [showModal, setShowModal] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [showHouseEditModal, setShowHouseEditModal] = useState(false);
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectHouse, setDefectHouse] = useState<House | null>(null);

  const [instHouse, setInstHouse] = useState<House | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [instTasks, setInstTasks] = useState<InstTask[]>([]);
  const [expandedInst, setExpandedInst] = useState<string | null>(null);
  const [loadingInst, setLoadingInst] = useState(false);

  const [houseForm, setHouseForm] = useState({ house_number: "", contractor: "", phase: "", delayed_days: "", status: "on-track" as HouseStatus, progress: "", planned_completion_date: "", site_engineer: "" });
  const [form, setForm] = useState({ house_id: "", work_detail: "", progress: "", issue: "", new_status: "on-track" as HouseStatus, reported_by: "" });
  const [defectForm, setDefectForm] = useState({ house_id: "", defect_category: "งานสี", description: "", severity: "medium", assigned_to: "", due_date: "" });

  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [confirmInst, setConfirmInst] = useState<Installment | null>(null);

  const [dailyPhoto, setDailyPhoto] = useState<File | null>(null);
  const [dailyPhotoPreview, setDailyPhotoPreview] = useState("");
  const [uploadingDailyPhoto, setUploadingDailyPhoto] = useState(false);

  const [rptPeriod, setRptPeriod] = useState<Period>("month");
  const [rptStart, setRptStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [rptEnd, setRptEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [rptLimit, setRptLimit] = useState(50);

  const fetchData = (limit = rptLimit) => {
    let rptQ = supabase.from("construction_reports").select("*");
    if (rptStart) rptQ = rptQ.gte("created_at", rptStart);
    if (rptEnd) rptQ = rptQ.lte("created_at", rptEnd + "T23:59:59");
    Promise.all([
      supabase.from("houses").select("*").eq("project_id", PROJECT_ID).order("plot_number"),
      rptQ.order("created_at", { ascending: false }).limit(limit),
      supabase.from("defects").select("*").order("reported_at", { ascending: false }).limit(50),
    ]).then(([hRes, rRes, dRes]) => {
      setHouses((hRes.data as House[]) ?? []);
      setReports((rRes.data as Report[]) ?? []);
      setDefects((dRes.data as Defect[]) ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { setRptLimit(50); fetchData(50); }, [rptStart, rptEnd]);

  const fetchInstallments = async (house: House) => {
    setInstHouse(house);
    setLoadingInst(true);
    setTab("installments");
    const { data: existing } = await supabase.from("contractor_installments").select("*").eq("house_id", house.id).order("installment_no");
    let insts = (existing as Installment[]) ?? [];
    if (insts.length === 0) {
      const rows = INSTALLMENT_NAMES.map((name, i) => ({ house_id: house.id, installment_no: i + 1, name, status: "pending", amount: 0 }));
      const { data: created } = await supabase.from("contractor_installments").insert(rows).select();
      insts = (created as Installment[]) ?? [];
    }
    setInstallments(insts);
    const { data: tasks } = await supabase.from("installment_tasks").select("*").in("installment_id", insts.map((i) => i.id)).order("task_no");
    setInstTasks((tasks as InstTask[]) ?? []);
    setLoadingInst(false);
  };

  const toggleTask = async (task: InstTask) => {
    const updated = !task.is_complete;
    await supabase.from("installment_tasks").update({ is_complete: updated, verified_at: updated ? new Date().toISOString() : null }).eq("id", task.id);
    setInstTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, is_complete: updated } : t));
  };

  const doAdvanceInst = async (inst: Installment) => {
    const next: Record<string, string> = { pending: "in_review", in_review: "approved", approved: "paid" };
    const newStatus = next[inst.status] ?? inst.status;
    if (newStatus === inst.status) return;

    // ตรวจสอบ: task ต้องครบก่อน submit
    if (inst.status === "pending") {
      const tasks = instTasks.filter((t) => t.installment_id === inst.id);
      if (tasks.length > 0 && !tasks.every((t) => t.is_complete)) {
        setToast({ msg: "ต้องทำ task ให้ครบทุกรายการก่อนส่งตรวจสอบ", type: "error" });
        setConfirmInst(null);
        return;
      }
    }

    // ตรวจสอบ: ต้องไม่มี defect Open อยู่สำหรับยูนิตนี้
    if (inst.status === "pending" && instHouse) {
      const openDefs = defects.filter((d) => d.house_id === instHouse.id && d.status === "Open");
      if (openDefs.length > 0) {
        setToast({ msg: `มี Defect เปิดอยู่ ${openDefs.length} รายการ — ต้องแก้ไขให้ครบก่อนส่งตรวจสอบ`, type: "error" });
        setConfirmInst(null);
        return;
      }
    }

    await supabase.from("contractor_installments").update({ status: newStatus }).eq("id", inst.id);
    setInstallments((prev) => prev.map((i) => i.id === inst.id ? { ...i, status: newStatus } : i));
    const statusLabels: Record<string, string> = { in_review: "ส่งตรวจสอบแล้ว", approved: "อนุมัติงวดแล้ว", paid: "บันทึกจ่ายเงินแล้ว" };
    const notifType: Record<string, "info" | "approval" | "success"> = { in_review: "info", approved: "approval", paid: "success" };
    if (newStatus === "in_review") {
      await supabase.from("approval_logs").insert({
        workflow_type: "Installment_Review",
        source_doc_index: `${inst.name}${instHouse ? ` — ${instHouse.house_number}` : ""}`,
        source_record_id: inst.id,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: inst.amount ?? null,
      });
    }
    await createNotification({
      type: notifType[newStatus] ?? "info",
      title: `${inst.name} — ${statusLabels[newStatus] ?? newStatus}`,
      message: instHouse ? `ยูนิต ${instHouse.house_number}` : "",
      from_dept: "ฝ่ายก่อสร้าง",
    });
    setToast({ msg: statusLabels[newStatus] ?? newStatus, type: "success" });
    setConfirmInst(null);
  };

  const advanceInstStatus = (inst: Installment) => {
    const next: Record<string, string> = { pending: "in_review", in_review: "approved", approved: "paid" };
    if (next[inst.status] === inst.status || !next[inst.status]) return;
    setConfirmInst(inst);
  };

  const printInstallments = () => { window.print(); };

  const printDailyReport = () => {
    const dateStr = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const rows = reports.map((r) => {
      const house = houses.find((h) => h.id === r.house_id);
      const d = new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      const photoCell = r.photo_url ? `<img src="${r.photo_url}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #ddd;" />` : "—";
      return `<tr>
        <td>${d}</td>
        <td>${house?.house_number ?? "—"}</td>
        <td>${r.work_detail ?? "—"}</td>
        <td style="text-align:center">${r.progress ?? 0}%</td>
        <td style="color:#c0392b">${r.issue ?? "—"}</td>
        <td style="text-align:center">${photoCell}</td>
      </tr>`;
    }).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
    <title>รายงานรายวัน — ฝ่ายก่อสร้าง</title>
    <style>
      body { font-family: 'Sarabun', Arial, sans-serif; margin: 32px; font-size: 13px; color: #1a1a1a; }
      h1 { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #555; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #1E4A35; color: #D4AF37; padding: 8px 10px; text-align: left; font-size: 12px; }
      td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-size: 12px; vertical-align: top; }
      tr:nth-child(even) td { background: #f9f9f9; }
      .footer { margin-top: 32px; display: flex; justify-content: flex-end; font-size: 12px; }
      .sig { text-align: center; width: 180px; }
      .sig-line { border-top: 1px solid #555; margin: 40px 0 4px; }
      @media print { button { display: none; } }
    </style></head><body>
    <h1>รายงานประจำวัน — ฝ่ายก่อสร้าง</h1>
    <div class="meta">วันที่พิมพ์: ${dateStr} &nbsp;|&nbsp; จำนวน ${reports.length} รายการ</div>
    <table>
      <thead><tr><th>วันที่</th><th>ยูนิต</th><th>รายละเอียดงาน</th><th>คืบหน้า</th><th>ปัญหา/หมายเหตุ</th><th>รูป</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      <div class="sig">
        <div class="sig-line"></div>
        <div>ผู้จัดทำรายงาน</div>
        <div style="color:#555;font-size:11px;margin-top:4px">(...............................................)</div>
      </div>
    </div>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>`);
    w.document.close();
  };

  const uploadTaskPhoto = async (task: InstTask, file: File) => {
    setUploadingTask(task.id);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `tasks/${task.id}.${ext}`;
    const { error } = await supabase.storage.from("installment-photos").upload(path, file, { upsert: true });
    if (error) {
      setUploadingTask(null);
      setToast({ msg: "อัปโหลดรูปไม่สำเร็จ: " + error.message, type: "error" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("installment-photos").getPublicUrl(path);
    await supabase.from("installment_tasks").update({ photo_url: publicUrl }).eq("id", task.id);
    setInstTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, photo_url: publicUrl } : t));
    setUploadingTask(null);
    setToast({ msg: "อัปโหลดรูปสำเร็จ", type: "success" });
  };

  const counts = {
    complete: houses.filter((h) => h.status === "complete").length,
    "on-track": houses.filter((h) => h.status === "on-track").length,
    delayed: houses.filter((h) => h.status === "delayed").length,
  };
  const overallProgress = houses.length ? Math.round(houses.reduce((s, h) => s + h.progress, 0) / houses.length) : 0;
  const filtered = filter === "all" ? houses : houses.filter((h) => h.status === filter);
  const openDefects = defects.filter((d) => d.status === "Open").length;
  const delayedCount = counts.delayed;

  const openReport = (house: House) => {
    setSelectedHouse(house);
    setEditingReport(null);
    setForm({ house_id: house.id, work_detail: "", progress: String(house.progress), issue: "", new_status: house.status, reported_by: house.site_engineer ?? "" });
    setDailyPhoto(null);
    setDailyPhotoPreview("");
    setShowModal(true);
  };

  const openEditReport = (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReport(report);
    setSelectedHouse(null);
    setForm({ house_id: report.house_id, work_detail: report.work_detail, progress: String(report.progress), issue: report.issue ?? "", new_status: "on-track", reported_by: report.reported_by ?? "" });
    setDailyPhoto(null);
    setDailyPhotoPreview(report.photo_url ?? "");
    setShowModal(true);
  };

  const openEditHouse = (house: House, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingHouse(house);
    setHouseForm({ house_number: house.house_number, contractor: house.contractor ?? "", phase: house.phase ?? "", delayed_days: String(house.delayed_days ?? 0), status: house.status, progress: String(house.progress), planned_completion_date: house.planned_completion_date ?? "", site_engineer: house.site_engineer ?? "" });
    setShowHouseEditModal(true);
  };

  const openDefectModal = (house: House, e: React.MouseEvent) => {
    e.stopPropagation();
    setDefectHouse(house);
    setDefectForm({ house_id: house.id, defect_category: "งานสี", description: "", severity: "medium", assigned_to: "", due_date: "" });
    setShowDefectModal(true);
  };

  const handleSaveHouse = async () => {
    if (!editingHouse) return;
    setSaving(true);
    await supabase.from("houses").update({ house_number: houseForm.house_number, contractor: houseForm.contractor, phase: houseForm.phase, delayed_days: Number(houseForm.delayed_days) || 0, status: houseForm.status, progress: Number(houseForm.progress) || 0, planned_completion_date: houseForm.planned_completion_date || null, site_engineer: houseForm.site_engineer || null, updated_at: new Date().toISOString() }).eq("id", editingHouse.id);
    setSaving(false);
    setShowHouseEditModal(false);
    setEditingHouse(null);
    fetchData();
  };

  const handleSave = async () => {
    if (!form.work_detail) return;
    setSaving(true);
    let reportId = editingReport?.id ?? null;
    if (editingReport) {
      await supabase.from("construction_reports").update({ work_detail: form.work_detail, progress: Number(form.progress) || 0, issue: form.issue, updated_at: new Date().toISOString() }).eq("id", editingReport.id);
    } else {
      if (!form.house_id) { setSaving(false); return; }
      const { data: inserted } = await supabase.from("construction_reports").insert({ house_id: form.house_id, work_detail: form.work_detail, progress: Number(form.progress) || 0, issue: form.issue, reported_by: form.reported_by || null }).select().single();
      reportId = (inserted as Report | null)?.id ?? null;
      await supabase.from("houses").update({ progress: Number(form.progress) || 0, status: form.new_status }).eq("id", form.house_id);
    }
    if (dailyPhoto && reportId) {
      setUploadingDailyPhoto(true);
      const ext = dailyPhoto.name.split(".").pop() ?? "jpg";
      const path = `daily/${reportId}.${ext}`;
      const { error } = await supabase.storage.from("construction-daily-photos").upload(path, dailyPhoto, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("construction-daily-photos").getPublicUrl(path);
        await supabase.from("construction_reports").update({ photo_url: publicUrl }).eq("id", reportId);
        setToast({ msg: "อัปโหลดรูปสำเร็จ", type: "success" });
      } else {
        setToast({ msg: "อัปโหลดรูปไม่สำเร็จ: " + error.message, type: "error" });
      }
      setUploadingDailyPhoto(false);
    }
    setSaving(false);
    setShowModal(false);
    setSelectedHouse(null);
    setEditingReport(null);
    setDailyPhoto(null);
    setDailyPhotoPreview("");
    fetchData();
  };

  const handleSaveDefect = async () => {
    if (!defectForm.description || !defectForm.house_id) return;
    setSaving(true);
    await supabase.from("defects").insert({
      house_id: defectForm.house_id,
      defect_category: defectForm.defect_category,
      description: defectForm.description,
      status: "Open",
      severity: defectForm.severity,
      assigned_to: defectForm.assigned_to || null,
      due_date: defectForm.due_date || null,
    });
    setSaving(false);
    setShowDefectModal(false);
    setDefectHouse(null);
    setDefectForm({ house_id: "", defect_category: "งานสี", description: "", severity: "medium", assigned_to: "", due_date: "" });
    fetchData();
  };

  const updateDefectStatus = async (id: string, newStatus: string) => {
    const update: Record<string, string> = { status: newStatus };
    if (newStatus === "Resolved") update.resolved_at = new Date().toISOString();
    await supabase.from("defects").update(update).eq("defect_id", id);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardHat size={20} className="text-aviva-gold" />
              <div>
                <h1 className="text-xl font-bold text-aviva-text">การก่อสร้าง</h1>
                <p className="text-xs text-aviva-secondary">
                  {loading ? "กำลังโหลด..." : `${houses.length} ยูนิต`}
                </p>
              </div>
            </div>
            {part === "daily" && (
              <button onClick={() => { setSelectedHouse(null); setEditingReport(null); setForm({ house_id: "", work_detail: "", progress: "", issue: "", new_status: "on-track", reported_by: "" }); setShowModal(true); }}
                className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
                <Plus size={14} /> รายงาน
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setPart("inspect"); setTab("units"); }}
              className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                part === "inspect" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              <HardHat size={13} /> ตรวจงวดงาน
            </button>
            <button onClick={() => { setPart("daily"); setTab("reports"); }}
              className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                part === "daily" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              <FileText size={13} /> งานรายวัน
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {delayedCount > 0 && (
          <AIInsightPanel type="alert" priority="high"
            title={`มี ${delayedCount} ยูนิตล่าช้ากว่าแผน`}
            message="ควรตรวจสอบผู้รับเหมาและระบุสาเหตุ เพื่อวางแผนเร่งงานก่อนส่งมอบ" />
        )}
        {openDefects > 0 && (
          <AIInsightPanel type="warning" priority="medium"
            title={`Defect เปิดอยู่ ${openDefects} รายการ`}
            message="ต้องดำเนินการแก้ไขก่อนส่งมอบบ้านให้ลูกค้า" />
        )}

        <GlassCard gold className="p-4">
          <SectionHeader title="ภาพรวมการก่อสร้าง" />
          {houses.length === 0 ? (
            <p className="text-aviva-secondary text-sm text-center py-4">ยังไม่มีข้อมูลยูนิต</p>
          ) : (
            <ProgressBar label="ความคืบหน้าโดยรวม" value={overallProgress} sublabel={`${houses.length} ยูนิต`} />
          )}
        </GlassCard>

        <div className="grid grid-cols-3 gap-3">
          {(["complete", "on-track", "delayed"] as HouseStatus[]).map((s) => {
            const { label, icon: Icon, color, bg } = statusConfig[s];
            return (
              <button key={s} onClick={() => setFilter(filter === s ? "all" : s)}
                className={clsx("rounded-2xl border p-3 flex flex-col items-center gap-1.5 transition-all", bg, filter === s && "ring-2 ring-aviva-gold/50")}>
                <Icon size={18} className={color} />
                <span className={clsx("text-xl font-bold", color)}>{loading ? "—" : counts[s]}</span>
                <span className="text-[10px] text-aviva-secondary">{label}</span>
              </button>
            );
          })}
        </div>

        {part === "inspect" && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([
              ["units", "ยูนิต"],
              ["installments", "งวดงาน"],
            ] as [Tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => { if (k !== "installments") setTab(k); else if (instHouse) setTab("installments"); }}
                className={clsx("flex-shrink-0 flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                  tab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}>{l}</button>
            ))}
          </div>
        )}
        {part === "daily" && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([
              ["reports", `รายงาน (${reports.length})`],
              ["defects", `Defects${openDefects > 0 ? ` (${openDefects})` : ""}`],
            ] as [Tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k as Tab)}
                className={clsx("flex-shrink-0 flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                  tab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}>{l}</button>
            ))}
          </div>
        )}

        {tab === "units" && (
          <>
            <div className="flex gap-2">
              {(["all", "complete", "on-track", "delayed"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    filter === f ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                  )}>
                  {f === "all" ? "ทั้งหมด" : statusConfig[f].label}
                </button>
              ))}
            </div>
            <div>
              <SectionHeader title={`ยูนิต (${filtered.length})`} subtitle="แตะเพื่อบันทึกรายงาน | กด ⚙ งวดงาน" />
              {loading ? (
                <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-aviva-card/50 animate-pulse" />)}</div>
              ) : filtered.length === 0 ? (
                <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีข้อมูล</p></GlassCard>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filtered.map((house) => {
                    const { label, icon: Icon, color, bg } = statusConfig[house.status] ?? statusConfig["on-track"];
                    return (
                      <GlassCard key={house.id} className={clsx("p-3 border cursor-pointer active:scale-[0.97] transition-transform", bg)} onClick={() => openReport(house)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-aviva-text">{house.house_number}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); fetchInstallments(house); }}
                              className="px-1.5 py-0.5 rounded bg-aviva-gold/20 text-aviva-gold text-[9px] font-bold">งวด</button>
                            <button onClick={(e) => openDefectModal(house, e)} className="p-1 rounded-lg bg-aviva-bg/50 hover:bg-aviva-bg transition-all">
                              <Bug size={11} className="text-orange-400" />
                            </button>
                            <button onClick={(e) => openEditHouse(house, e)} className="p-1 rounded-lg bg-aviva-bg/50 hover:bg-aviva-bg transition-all">
                              <Pencil size={11} className="text-aviva-secondary" />
                            </button>
                            <Icon size={14} className={color} />
                          </div>
                        </div>
                        <ProgressBar label="" value={house.progress} showPercent={false} color={progressColor(house.progress)} />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-aviva-secondary truncate">{house.phase ?? label}</span>
                          <span className={clsx("text-xs font-bold", color)}>{house.progress}%</span>
                        </div>
                        {house.delayed_days > 0 && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <AlertTriangle size={10} className="text-red-400" />
                            <span className="text-[10px] text-red-400">ล่าช้า {house.delayed_days} วัน</span>
                          </div>
                        )}
                        {house.planned_completion_date && (
                          <div className="mt-1 text-[9px] text-aviva-secondary/70">
                            กำหนดเสร็จ {new Date(house.planned_completion_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </div>
                        )}
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "reports" && (
          <div className="space-y-3">
            <PeriodFilter period={rptPeriod} onChange={(p, s, e) => { setRptPeriod(p); setRptStart(s); setRptEnd(e); }} />
            <div className="flex items-center justify-between">
              <SectionHeader title="รายงานประจำวัน" subtitle="กรองตามช่วงเวลา" />
              {reports.length > 0 && (
                <button onClick={printDailyReport} className="flex items-center gap-1.5 text-[11px] text-aviva-gold border border-aviva-gold/30 px-2 py-1.5 rounded-xl">
                  <Printer size={12} /> พิมพ์รายงาน
                </button>
              )}
            </div>
            {reports.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <ClipboardList size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีข้อมูล</p>
              </GlassCard>
            ) : (
              reports.map((r) => {
                const house = houses.find((h) => h.id === r.house_id);
                return (
                  <GlassCard key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-aviva-gold">{house?.house_number ?? "—"}</span>
                          <span className="text-[10px] text-aviva-secondary">{new Date(r.created_at).toLocaleDateString("th-TH")}</span>
                        </div>
                        <p className="text-sm text-aviva-text mt-0.5">{r.work_detail}</p>
                        {r.issue && <p className="text-xs text-red-400 mt-0.5">⚠ {r.issue}</p>}
                        {r.photo_url && (
                          <a href={r.photo_url} target="_blank" rel="noreferrer" className="mt-2 block">
                            <img src={r.photo_url} alt="รูปตรวจงาน" className="w-full max-w-[160px] h-24 rounded-xl object-cover border border-aviva-gold/20" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={(e) => openEditReport(r, e)} className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/10 hover:border-aviva-gold/40 transition-all">
                          <Pencil size={12} className="text-aviva-secondary" />
                        </button>
                        <div className="text-right">
                          <p className="text-lg font-bold text-aviva-gold">{r.progress}%</p>
                          <p className="text-[10px] text-aviva-secondary">ความคืบหน้า</p>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })
            )}
            {!loading && reports.length >= rptLimit && (
              <button onClick={() => { const next = rptLimit + 50; setRptLimit(next); fetchData(next); }}
                className="w-full py-2.5 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-card hover:border-aviva-gold/30 transition-all">
                โหลดเพิ่มเติม (แสดง {rptLimit} รายการแล้ว)
              </button>
            )}
          </div>
        )}

        {tab === "defects" && (
          <div className="space-y-3">
            <SectionHeader title="Defect Tracking" subtitle="ปัญหาที่ตรวจพบ" />
            {defects.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <Bug size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีรายการ Defect</p>
              </GlassCard>
            ) : (
              defects.map((d) => {
                const house = houses.find((h) => h.id === d.house_id);
                const ds = defectStatusConfig[d.status] ?? defectStatusConfig["Open"];
                const severityMap: Record<string, { label: string; color: string }> = {
                  low: { label: "เล็กน้อย", color: "text-blue-400 bg-blue-400/10" },
                  medium: { label: "ปานกลาง", color: "text-yellow-400 bg-yellow-400/10" },
                  high: { label: "สูง", color: "text-orange-400 bg-orange-400/10" },
                  critical: { label: "วิกฤต", color: "text-red-400 bg-red-400/10" },
                };
                const sev = severityMap[d.severity ?? "medium"] ?? severityMap.medium;
                const daysOpen = d.status !== "Resolved" ? Math.floor((Date.now() - new Date(d.reported_at).getTime()) / 86400000) : null;
                const overdue = d.due_date && d.status !== "Resolved" && new Date(d.due_date) < new Date();
                return (
                  <GlassCard key={d.defect_id} className={clsx("p-4", overdue && "border border-red-500/40")}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-aviva-gold">{house?.house_number ?? "—"}</span>
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{d.defect_category}</span>
                          <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full", sev.color)}>{sev.label}</span>
                          {daysOpen !== null && daysOpen > 7 && (
                            <span className="text-[10px] text-red-400 font-bold">⚠ {daysOpen} วัน</span>
                          )}
                        </div>
                        <p className="text-sm text-aviva-text mt-0.5">{d.description}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-[10px] text-aviva-secondary">{new Date(d.reported_at).toLocaleDateString("th-TH")}</p>
                          {d.assigned_to && <p className="text-[10px] text-aviva-secondary">ผู้รับผิดชอบ: {d.assigned_to}</p>}
                          {d.due_date && <p className={clsx("text-[10px]", overdue ? "text-red-400 font-bold" : "text-aviva-secondary")}>ครบกำหนด: {new Date(d.due_date).toLocaleDateString("th-TH")}</p>}
                        </div>
                      </div>
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded-full flex-shrink-0", ds.color)}>{ds.label}</span>
                    </div>
                    {d.status !== "Resolved" && (
                      <div className="flex gap-2">
                        {d.status === "Open" && (
                          <button onClick={() => updateDefectStatus(d.defect_id, "In Progress")}
                            className="flex-1 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-[10px] font-medium">เริ่มแก้ไข</button>
                        )}
                        <button onClick={() => updateDefectStatus(d.defect_id, "Resolved")}
                          className="flex-1 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-[10px] font-medium">แก้ไขแล้ว</button>
                      </div>
                    )}
                  </GlassCard>
                );
              })
            )}
          </div>
        )}

        {tab === "installments" && (
          <div className="space-y-3">
            {!instHouse ? (
              <GlassCard className="p-8 text-center">
                <p className="text-aviva-secondary text-sm">กดปุ่ม "งวด" บนการ์ดยูนิตเพื่อดูงวดงาน</p>
              </GlassCard>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <SectionHeader title={`งวดงาน — ${instHouse.house_number}`} subtitle="10 งวด" />
                  <button onClick={printInstallments} className="flex items-center gap-1.5 text-[11px] text-aviva-gold border border-aviva-gold/30 px-2 py-1.5 rounded-xl">
                    <Printer size={12} /> พิมพ์
                  </button>
                </div>
                {loadingInst ? (
                  [1,2,3].map((i) => <div key={i} className="h-14 rounded-2xl bg-aviva-card/50 animate-pulse" />)
                ) : (
                  installments.map((inst) => {
                    const tasks = instTasks.filter((t) => t.installment_id === inst.id);
                    const doneCount = tasks.filter((t) => t.is_complete).length;
                    const isExpanded = expandedInst === inst.id;
                    const sc = instStatusConfig[inst.status] ?? instStatusConfig["pending"];
                    return (
                      <GlassCard key={inst.id} className="p-3">
                        <button className="w-full flex items-center justify-between gap-2" onClick={() => setExpandedInst(isExpanded ? null : inst.id)}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isExpanded ? <ChevronDown size={14} className="text-aviva-secondary flex-shrink-0" /> : <ChevronRight size={14} className="text-aviva-secondary flex-shrink-0" />}
                            <span className="text-xs font-semibold text-aviva-text truncate">{inst.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {tasks.length > 0 && <span className="text-[10px] text-aviva-secondary">{doneCount}/{tasks.length}</span>}
                            {inst.amount > 0 && <span className="text-[10px] text-aviva-gold font-medium">฿{inst.amount.toLocaleString()}</span>}
                            <span className={clsx("text-[10px] px-2 py-0.5 rounded-full", sc.color)}>{sc.label}</span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="mt-3 space-y-2 border-t border-aviva-gold/10 pt-3">
                            {tasks.length === 0 ? (
                              <p className="text-[11px] text-aviva-secondary/60 text-center py-2">ยังไม่มีรายการงาน</p>
                            ) : (
                              tasks.map((task) => (
                                <div key={task.id} className="flex items-center gap-3">
                                  <button onClick={() => toggleTask(task)} className="flex items-center gap-3 flex-1 text-left">
                                    <div className={clsx("w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all",
                                      task.is_complete ? "bg-green-500 border-green-500" : "border-aviva-secondary/40"
                                    )}>
                                      {task.is_complete && <CheckCircle size={10} className="text-white" />}
                                    </div>
                                    <span className={clsx("text-xs", task.is_complete ? "text-aviva-secondary line-through" : "text-aviva-text")}>{task.task_name}</span>
                                  </button>
                                  <label className="cursor-pointer flex-shrink-0">
                                    <input type="file" accept="image/*" capture="environment" className="hidden"
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTaskPhoto(task, f); }} />
                                    {uploadingTask === task.id
                                      ? <div className="w-8 h-8 rounded-lg bg-aviva-bg border border-aviva-gold/10 flex items-center justify-center">
                                          <Loader2 size={12} className="text-aviva-gold animate-spin" />
                                        </div>
                                      : task.photo_url
                                        ? <img src={task.photo_url} alt="รูป" className="w-8 h-8 rounded-lg object-cover border border-aviva-gold/20" />
                                        : <div className="w-8 h-8 rounded-lg bg-aviva-bg border border-aviva-gold/10 flex items-center justify-center">
                                            <Camera size={12} className="text-aviva-secondary/50" />
                                          </div>
                                    }
                                  </label>
                                </div>
                              ))
                            )}
                            {inst.status !== "paid" && (
                              <button onClick={() => advanceInstStatus(inst)}
                                className="w-full mt-2 py-2 bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/30 rounded-xl text-xs font-medium">
                                {inst.status === "pending" ? "ส่งตรวจสอบ" : inst.status === "in_review" ? "อนุมัติงวดนี้" : "บันทึกจ่ายเงิน"}
                              </button>
                            )}
                          </div>
                        )}
                      </GlassCard>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showDefectModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">บันทึก Defect{defectHouse ? ` — ${defectHouse.house_number}` : ""}</h2>
              <button onClick={() => { setShowDefectModal(false); setDefectHouse(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              {!defectHouse && (
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เลือกยูนิต *</label>
                  <select value={defectForm.house_id} onChange={(e) => setDefectForm({ ...defectForm, house_id: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">-- เลือกยูนิต --</option>
                    {houses.map((h) => <option key={h.id} value={h.id}>{h.house_number}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ประเภทปัญหา</label>
                <select value={defectForm.defect_category} onChange={(e) => setDefectForm({ ...defectForm, defect_category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {DEFECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                <textarea value={defectForm.description} onChange={(e) => setDefectForm({ ...defectForm, description: e.target.value })}
                  placeholder="อธิบายปัญหาที่พบ..." rows={3}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความรุนแรง</label>
                  <select value={defectForm.severity} onChange={(e) => setDefectForm({ ...defectForm, severity: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="low">เล็กน้อย</option>
                    <option value="medium">ปานกลาง</option>
                    <option value="high">สูง</option>
                    <option value="critical">วิกฤต</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">กำหนดแก้ไขภายใน</label>
                  <input type="date" value={defectForm.due_date} onChange={(e) => setDefectForm({ ...defectForm, due_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">มอบหมายให้</label>
                <input type="text" value={defectForm.assigned_to} onChange={(e) => setDefectForm({ ...defectForm, assigned_to: e.target.value })}
                  placeholder="ชื่อผู้รับผิดชอบหรือผู้รับเหมา"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handleSaveDefect} disabled={saving || !defectForm.description || (!defectHouse && !defectForm.house_id)}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึก Defect"}
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">
                {editingReport ? "แก้ไขรายงาน" : selectedHouse ? `บันทึกรายงาน — ${selectedHouse.house_number}` : "บันทึกรายงานประจำวัน"}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingReport(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              {!selectedHouse && !editingReport && (
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เลือกยูนิต *</label>
                  <select value={form.house_id} onChange={(e) => setForm({ ...form, house_id: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">-- เลือกยูนิต --</option>
                    {houses.map((h) => <option key={h.id} value={h.id}>{h.house_number} ({h.progress}%)</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">งานที่ทำวันนี้ *</label>
                <textarea value={form.work_detail} onChange={(e) => setForm({ ...form, work_detail: e.target.value })}
                  placeholder="อธิบายงานที่ดำเนินการ..." rows={3}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความคืบหน้า (%)</label>
                  <input type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })}
                    placeholder="0-100"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                {!editingReport && (
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                    <select value={form.new_status} onChange={(e) => setForm({ ...form, new_status: e.target.value as HouseStatus })}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                      <option value="on-track">ตามแผน</option>
                      <option value="delayed">ล่าช้า</option>
                      <option value="complete">เสร็จแล้ว</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้จัดทำรายงาน</label>
                <input type="text" value={form.reported_by} onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
                  placeholder="ชื่อวิศวกร / ช่างควบคุมงาน"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ปัญหา / ข้อสังเกต</label>
                <input type="text" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  placeholder="ถ้าไม่มีปัญหาให้เว้นว่าง"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">แนบรูปภาพการตรวจงาน</label>
                <label className="cursor-pointer flex items-center gap-3 w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3">
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setDailyPhoto(f); setDailyPhotoPreview(URL.createObjectURL(f)); }
                    }} />
                  {uploadingDailyPhoto ? <Loader2 size={16} className="text-aviva-gold animate-spin" /> : <Camera size={16} className="text-aviva-secondary/60" />}
                  <span className="text-sm text-aviva-secondary/60 flex-1">{dailyPhoto ? dailyPhoto.name : "ถ่ายรูป / เลือกจากคลัง"}</span>
                  {dailyPhotoPreview && <img src={dailyPhotoPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-aviva-gold/20" />}
                </label>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || uploadingDailyPhoto || !form.work_detail || (!selectedHouse && !editingReport && !form.house_id)}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving || uploadingDailyPhoto ? "กำลังบันทึก..." : editingReport ? "บันทึกการแก้ไข" : "บันทึกรายงาน"}
            </button>
          </div>
        </div>
      )}

      {showHouseEditModal && editingHouse && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">แก้ไขยูนิต — {editingHouse.house_number}</h2>
              <button onClick={() => { setShowHouseEditModal(false); setEditingHouse(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">หมายเลขยูนิต</label>
                  <input type="text" value={houseForm.house_number} onChange={(e) => setHouseForm({ ...houseForm, house_number: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                  <select value={houseForm.status} onChange={(e) => setHouseForm({ ...houseForm, status: e.target.value as HouseStatus })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="on-track">ตามแผน</option>
                    <option value="delayed">ล่าช้า</option>
                    <option value="complete">เสร็จแล้ว</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้รับเหมา</label>
                <input type="text" value={houseForm.contractor} onChange={(e) => setHouseForm({ ...houseForm, contractor: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เฟส / ขั้นตอน</label>
                <input type="text" value={houseForm.phase} onChange={(e) => setHouseForm({ ...houseForm, phase: e.target.value })}
                  placeholder="เช่น งานโครงสร้าง"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความคืบหน้า (%)</label>
                  <input type="number" min="0" max="100" value={houseForm.progress} onChange={(e) => setHouseForm({ ...houseForm, progress: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ล่าช้า (วัน)</label>
                  <input type="number" min="0" value={houseForm.delayed_days} onChange={(e) => setHouseForm({ ...houseForm, delayed_days: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">กำหนดเสร็จ</label>
                  <input type="date" value={houseForm.planned_completion_date} onChange={(e) => setHouseForm({ ...houseForm, planned_completion_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">วิศวกร/ช่างควบคุม</label>
                  <input type="text" value={houseForm.site_engineer} onChange={(e) => setHouseForm({ ...houseForm, site_engineer: e.target.value })}
                    placeholder="ชื่อวิศวกรประจำยูนิต"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
            </div>
            <button onClick={handleSaveHouse} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </div>
      )}

      {confirmInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-aviva-card rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-aviva-text">ยืนยันการส่งเบิก?</h2>
            <p className="text-sm text-aviva-secondary">{confirmInst.name} — เปลี่ยนสถานะเป็น "{instStatusConfig[{ pending: "in_review", in_review: "approved", approved: "paid" }[confirmInst.status] ?? confirmInst.status]?.label}"</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmInst(null)}
                className="flex-1 py-3 rounded-xl border border-aviva-gold/20 text-aviva-secondary text-sm">ยกเลิก</button>
              <button onClick={() => doAdvanceInst(confirmInst)}
                className="flex-1 py-3 rounded-xl bg-aviva-gold text-aviva-bg font-bold text-sm">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
