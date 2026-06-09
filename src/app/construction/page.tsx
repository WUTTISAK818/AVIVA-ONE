"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AlertTriangle, CheckCircle, Clock, Plus, X, ClipboardList, Pencil, Bug, Printer, ChevronRight, ChevronDown, Camera, HardHat, FileText, Loader2, Check, Bot, Send, Trash2, ShoppingCart } from "lucide-react";
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
import AttachDocButton from "@/components/AttachDocButton";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import { logWorkflowEvent, createWorkQueue, closeWorkQueue, notifyPush, notifyContractor } from "@/lib/workflow-events";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

type HouseStatus = "complete" | "on-track" | "delayed";
type FilterStatus = "all" | "complete" | "building" | "on-track" | "delayed";
type Tab = "reports" | "defects";
type Part = "inspect" | "daily" | "purchase";

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
  contractor_line_id: string | null;
  contractor_phone: string | null;
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
  installment_no?: number | null;
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
  created_by_name?: string | null;
  contractor_ack_name?: string | null;
  contractor_acknowledged_at?: string | null;
  paid_by?: string | null;
  paid_at?: string | null;
  labor_cost?: number | null;
  material_cost?: number | null;
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

interface PurchaseOrder {
  id: string;
  po_number: string | null;
  supplier_name: string;
  items: { name: string; qty: number; unit: string; unit_price: number }[];
  total_amount: number | null;
  status: string;
  requested_by: string | null;
  notes: string | null;
  created_at: string;
  approved_by?: string | null;
}

interface PrLineItem {
  name: string;
  qty: string;
  unit: string;
  unit_price: string;
}

const statusConfig = {
  complete: { label: "เสร็จแล้ว", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  "on-track": { label: "ตามแผน", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  delayed: { label: "ล่าช้า", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
};

const instStatusConfig: Record<string, { label: string; color: string }> = {
  pending:   { label: "รอดำเนินการ", color: "bg-gray-500/20 text-gray-400" },
  in_review: { label: "รอตรวจสอบ",  color: "bg-yellow-500/20 text-yellow-400" },
  approved:  { label: "อนุมัติแล้ว", color: "bg-blue-500/20 text-blue-400" },
  paid:      { label: "จ่ายแล้ว",    color: "bg-green-500/20 text-green-400" },
  rejected:   { label: "ถูกปฏิเสธ",  color: "bg-red-500/20 text-red-400" },
};

const INSTALLMENT_NAMES = [
  "งวด 1 — งานฝานราก", "งวด 2 — งานเสาและคาน", "งวด 3 — งานพื้นชั้น 1",
  "งวด 4 — งานผนังชั้น 1", "งวด 5 — งานโครงหลังคา", "งวด 6 — งานหลังคา",
  "งวด 7 — งานผนังภายนอก", "งวด 8 — งานระบบน้ำ-ไฟ", "งวด 9 — งานตกแต่งภายใน",
  "งวด 10 — งานส่งมอบ",
];

const defectStatusConfig: Record<string, { label: string; color: string }> = {
  Open:        { label: "พบปัญหา",    color: "bg-red-500/20 text-red-400" },
  "In Progress":{ label: "กำลังแก้ไข", color: "bg-yellow-500/20 text-yellow-400" },
  Resolved:    { label: "แก้ไขแล้ว",  color: "bg-green-500/20 text-green-400" },
};

const DEFECT_CATEGORIES = ["งานสี", "งานฝ้า", "งานพื้น", "งานประตู-หน้าต่าง", "งานระบบน้ำ", "งานไฟฟ้า", "อื่นๆ"];
const WORK_TYPES = ["งานตรวจสอบ", "ติดตามงานเก่า", "แก้ไขงานซ่อมแซม", "งานเอกสาร", "งานติดต่อภายนอก", "อื่นๆ"];

const progressColor = (pct: number): "gold" | "green" | "red" =>
  pct === 100 ? "green" : pct < 50 ? "red" : "gold";

function houseLabel(h: House): string {
  return `แปลงที่ ${h.plot_number ?? "—"} / ที่ดิน ${h.land_size ?? "—"} ตร.วา / ${h.house_model ?? "AVA"}`;
}

const filterBoxes: { key: FilterStatus; label: string; border: string; numColor: string }[] = [
  { key: "all",      label: "ทั้งหมด",       border: "border-aviva-gold/30",   numColor: "text-aviva-gold"   },
  { key: "complete", label: "เสร็จแล้ว",     border: "border-green-400/30",    numColor: "text-green-400"    },
  { key: "building", label: "กำลังก่อสร้าง", border: "border-blue-400/30",     numColor: "text-blue-400"     },
  { key: "on-track", label: "ตามแผน",         border: "border-sky-400/30",      numColor: "text-sky-400"      },
  { key: "delayed",  label: "ล่าช้า",          border: "border-red-400/30",      numColor: "text-red-400"      },
];

function InspectionPanel({
  inst, inspections, instTemplates, instWorkItems,
  uploadingInsp, savingInsp, onEnsure, onSave, onUpload,
}: {
  inst: Installment;
  inspections: Inspection[];
  instTemplates: InstTemplate[];
  instWorkItems: WorkItem[];
  uploadingInsp: string | null;
  savingInsp: boolean;
  onEnsure: () => Promise<Inspection[]>;
  onSave: (insp: Inspection, result: 'pass' | 'fail', note: string, sub: string) => Promise<void>;
  onUpload: (insp: Inspection, file: File) => Promise<void>;
}) {
  const [loaded, setLoaded] = useState(false);
  const [localInsps, setLocalInsps] = useState<Inspection[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (inspections.length > 0) {
      setLocalInsps(inspections);
      setLoaded(true);
    }
  }, [inspections]);

  const init = async () => {
    const result = await onEnsure();
    setLocalInsps(result);
    setLoaded(true);
  };

  if (!loaded) {
    return (
      <button onClick={init} className="w-full py-2 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-bg/50 hover:border-aviva-gold/30">
        โหลดรายการตรวจงาน
      </button>
    );
  }

  const tmpl = instTemplates.find(t => t.installment_number === inst.installment_no);
  const wis = instWorkItems.filter(w => w.template_id === (tmpl?.id ?? ""));

  if (wis.length === 0 && localInsps.length === 0) {
    return <p className="text-[11px] text-aviva-secondary/60 text-center py-2">ยังไม่มีรายการงานในงวดนี้</p>;
  }

  const displayInsps = localInsps.length > 0 ? localInsps : inspections;
  const passCount = displayInsps.filter(i => i.result === 'pass').length;
  const failCount = displayInsps.filter(i => i.result === 'fail').length;

  return (
    <div className="space-y-2">
      {displayInsps.length > 0 && (
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-aviva-secondary">รายการงาน:</span>
          <span className="text-green-400 font-bold">✓ {passCount}</span>
          <span className="text-red-400 font-bold">✗ {failCount}</span>
          <span className="text-aviva-secondary/60">/ {displayInsps.length}</span>
        </div>
      )}
      {displayInsps.map(insp => (
        <div key={insp.id} className={clsx("bg-aviva-bg rounded-xl p-3 border", insp.result === 'pass' ? "border-green-500/30" : insp.result === 'fail' ? "border-red-500/30" : "border-aviva-gold/10")}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs font-medium text-aviva-text">{insp.work_item_name}</p>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onSave(insp, 'pass', notes[insp.id] ?? insp.note ?? "", subs[insp.id] ?? insp.sub_contractor_name ?? "")}
                disabled={savingInsp}
                className={clsx("px-2 py-1 rounded-lg text-[10px] font-bold border transition-all", insp.result === 'pass' ? "bg-green-500 text-white border-green-500" : "bg-aviva-bg text-green-400 border-green-500/30 hover:bg-green-500/10")}>
                ✓ ผ่าน
              </button>
              <button onClick={() => onSave(insp, 'fail', notes[insp.id] ?? insp.note ?? "", subs[insp.id] ?? insp.sub_contractor_name ?? "")}
                disabled={savingInsp}
                className={clsx("px-2 py-1 rounded-lg text-[10px] font-bold border transition-all", insp.result === 'fail' ? "bg-red-500 text-white border-red-500" : "bg-aviva-bg text-red-400 border-red-500/30 hover:bg-red-500/10")}>
                ✗ ไม่ผ่าน
              </button>
            </div>
          </div>
          <input placeholder="หมายเหตุ / เหตุผล"
            defaultValue={insp.note ?? ""}
            onChange={e => setNotes(prev => ({ ...prev, [insp.id]: e.target.value }))}
            className="w-full bg-aviva-bg/50 border border-aviva-gold/10 rounded-lg px-2 py-1 text-[11px] text-aviva-secondary placeholder:text-aviva-secondary/30 outline-none mb-1.5" />
          <input placeholder="ผู้รับเหมาเฉพาะงานนี้ (ถ้ามี)"
            defaultValue={insp.sub_contractor_name ?? ""}
            onChange={e => setSubs(prev => ({ ...prev, [insp.id]: e.target.value }))}
            className="w-full bg-aviva-bg/50 border border-aviva-gold/10 rounded-lg px-2 py-1 text-[11px] text-aviva-secondary placeholder:text-aviva-secondary/30 outline-none mb-1.5" />
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(insp, f); }} />
              {uploadingInsp === insp.id
                ? <div className="w-10 h-10 rounded-lg bg-aviva-bg border border-aviva-gold/10 flex items-center justify-center"><Loader2 size={12} className="text-aviva-gold animate-spin" /></div>
                : insp.photo_url
                  ? <img src={insp.photo_url} alt="รูปตรวจ" className="w-10 h-10 rounded-lg object-cover border border-aviva-gold/20" />
                  : <div className="w-10 h-10 rounded-lg bg-aviva-bg border border-aviva-gold/10 flex items-center justify-center"><Camera size={12} className="text-aviva-secondary/50" /></div>
              }
            </label>
            {insp.inspected_by && (
              <p className="text-[10px] text-aviva-secondary/60">ตรวจโดย: {insp.inspected_by}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ConstructionPage() {
  const user = useCurrentUser();
  const [houses, setHouses] = useState<House[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [part, setPart] = useState<Part>("inspect");
  const [tab, setTab] = useState<Tab>("reports");
  const [showModal, setShowModal] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [showHouseEditModal, setShowHouseEditModal] = useState(false);
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectHouse, setDefectHouse] = useState<House | null>(null);

  const [instHouse, setInstHouse] = useState<House | null>(null);
  const [houseCustomer, setHouseCustomer] = useState<{ customer_name: string; phone: string; status: string; notes: string | null; loan_approved_date: string | null; delivery_date: string | null } | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [instTasks, setInstTasks] = useState<InstTask[]>([]);
  const [expandedInst, setExpandedInst] = useState<string | null>(null);
  const [loadingInst, setLoadingInst] = useState(false);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [instTemplates, setInstTemplates] = useState<InstTemplate[]>([]);
  const [instWorkItems, setInstWorkItems] = useState<WorkItem[]>([]);
  const [uploadingInsp, setUploadingInsp] = useState<string | null>(null);
  const fetchGenRef = useRef(0);
  const [savingInsp, setSavingInsp] = useState(false);

  const [houseForm, setHouseForm] = useState({ house_number: "", contractor: "", phase: "", delayed_days: "", status: "on-track" as HouseStatus, progress: "", planned_completion_date: "", site_engineer: "" });
  const [form, setForm] = useState({ house_id: "", work_detail: "", progress: "", issue: "", new_status: "on-track" as HouseStatus, reported_by: "", work_type: "งานตรวจสอบ" });
  const [defectForm, setDefectForm] = useState({ house_id: "", defect_category: "งานสี", description: "", severity: "medium", assigned_to: "", due_date: "", installment_no: "" });

  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [confirmInst, setConfirmInst] = useState<Installment | null>(null);
  const [showAckModal, setShowAckModal] = useState(false);
  const [ackName, setAckName] = useState("");
  const [ackInst, setAckInst] = useState<Installment | null>(null);
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});
  const [customerPlots, setCustomerPlots] = useState<Set<number>>(new Set());
  const [showAI, setShowAI] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [showPRModal, setShowPRModal] = useState(false);
  const [savingPR, setSavingPR] = useState(false);
  const [prForm, setPrForm] = useState({ supplier_name: "", notes: "" });
  const [prItems, setPrItems] = useState<PrLineItem[]>([{ name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }]);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [dailyPhoto, setDailyPhoto] = useState<File | null>(null);
  const [dailyPhotoPreview, setDailyPhotoPreview] = useState("");
  const [uploadingDailyPhoto, setUploadingDailyPhoto] = useState(false);

  const [rptPeriod, setRptPeriod] = useState<Period>("month");
  const [rptStart, setRptStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [rptEnd, setRptEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [rptLimit, setRptLimit] = useState(50);

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryForm, setSummaryForm] = useState({ reporter: "", contractor_summary: "", daily_summary: "", problems: "", date: "" });
  const [summaryPhoto, setSummaryPhoto] = useState<File | null>(null);
  const [summaryPhotoPreview, setSummaryPhotoPreview] = useState("");
  const [uploadingSummaryPhoto, setUploadingSummaryPhoto] = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);

  const instPanelRef = useRef<HTMLDivElement>(null);

  const fetchData = (limit = rptLimit) => {
    let rptQ = supabase.from("construction_reports").select("*");
    if (rptStart) rptQ = rptQ.gte("created_at", rptStart);
    if (rptEnd) rptQ = rptQ.lte("created_at", rptEnd + "T23:59:59");
    Promise.all([
      supabase.from("houses").select("*").eq("project_id", PROJECT_ID).order("plot_number"),
      rptQ.order("created_at", { ascending: false }).limit(limit),
      supabase.from("defects").select("*").order("reported_at", { ascending: false }).limit(50),
      supabase.from("leads").select("plot_number").eq("project_id", PROJECT_ID).in("status", ["Booking", "Loan Process", "Closed Deal"]),
    ]).then(([hRes, rRes, dRes, leadRes]) => {
      setHouses((hRes.data as House[]) ?? []);
      setReports((rRes.data as Report[]) ?? []);
      setDefects((dRes.data as Defect[]) ?? []);
      const plots = new Set<number>((leadRes.data ?? []).filter((d: { plot_number: number | null }) => d.plot_number != null).map((d: { plot_number: number }) => d.plot_number));
      setCustomerPlots(plots);
      setLoading(false);
    });
  };

  useEffect(() => { setRptLimit(50); fetchData(50); }, [rptStart, rptEnd]);

  useEffect(() => {
    supabase.from("purchase_orders").select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setPurchaseOrders((data as PurchaseOrder[]) ?? []));
  }, []);

  const fetchInstallments = async (house: House) => {
    const gen = ++fetchGenRef.current;
    setInstHouse(house);
    setHouseCustomer(null);
    setLoadingInst(true);
    setExpandedInst(null);
    setInspections([]);
    if (house.plot_number) {
      const { data: cust } = await supabase.from("leads")
        .select("customer_name,phone,status,notes,loan_approved_date,delivery_date")
        .eq("project_id", PROJECT_ID)
        .eq("plot_number", house.plot_number)
        .in("status", ["Booking", "Loan Process", "Closed Deal"])
        .maybeSingle();
      if (fetchGenRef.current !== gen) return;
      if (cust) setHouseCustomer(cust as { customer_name: string; phone: string; status: string; notes: string | null; loan_approved_date: string | null; delivery_date: string | null });
    }

    const { data: templates } = await supabase.from("installment_templates")
      .select("id,installment_number,name,description")
      .eq("project_id", PROJECT_ID)
      .order("installment_number");
    const tmplList = (templates as InstTemplate[]) ?? [];
    setInstTemplates(tmplList);

    const tmplIds = tmplList.map(t => t.id);
    let wiList: WorkItem[] = [];
    if (tmplIds.length > 0) {
      const { data: wis } = await supabase.from("installment_work_items")
        .select("id,template_id,item_name,seq_order")
        .in("template_id", tmplIds)
        .order("seq_order");
      wiList = (wis as WorkItem[]) ?? [];
    }
    setInstWorkItems(wiList);

    const { data: existing, error: fetchErr } = await supabase.from("contractor_installments")
      .select("*").eq("house_id", house.id).order("installment_no");
    let insts = (existing as Installment[]) ?? [];
    if (!fetchErr && insts.length === 0 && tmplList.length > 0) {
      const rows = tmplList.map(t => ({ house_id: house.id, installment_no: t.installment_number, name: t.name, status: "pending", amount: 0 }));
      const { data: created } = await supabase.from("contractor_installments").insert(rows).select();
      insts = (created as Installment[]) ?? [];
    } else if (!fetchErr && insts.length === 0) {
      const rows = INSTALLMENT_NAMES.map((name, i) => ({ house_id: house.id, installment_no: i + 1, name, status: "pending", amount: 0 }));
      const { data: created } = await supabase.from("contractor_installments").insert(rows).select();
      insts = (created as Installment[]) ?? [];
    }
    if (fetchGenRef.current !== gen) return;
    setInstallments(insts);

    if (insts.length > 0) {
      const { data: insps } = await supabase.from("installment_inspections")
        .select("*").in("contractor_installment_id", insts.map(i => i.id));
      if (fetchGenRef.current !== gen) return;
      setInspections((insps as Inspection[]) ?? []);
    }

    const { data: tasks } = await supabase.from("installment_tasks")
      .select("*").in("installment_id", insts.map(i => i.id)).order("task_no");
    if (fetchGenRef.current !== gen) return;
    setInstTasks((tasks as InstTask[]) ?? []);

    setLoadingInst(false);
    setTimeout(() => instPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  const ensureInspections = async (inst: Installment): Promise<Inspection[]> => {
    const tmpl = instTemplates.find(t => t.installment_number === inst.installment_no);
    if (!tmpl) return [];
    const wis = instWorkItems.filter(w => w.template_id === tmpl.id);
    const existing = inspections.filter(i => i.contractor_installment_id === inst.id);
    const missingWis = wis.filter(wi => !existing.some(e => e.work_item_id === wi.id));
    if (missingWis.length > 0) {
      const rows = missingWis.map(wi => ({ contractor_installment_id: inst.id, work_item_id: wi.id, work_item_name: wi.item_name, result: 'pending' }));
      const { data: created } = await supabase.from("installment_inspections").insert(rows).select();
      const newInsps = (created as Inspection[]) ?? [];
      setInspections(prev => [...prev, ...newInsps]);
      return [...existing, ...newInsps];
    }
    return existing;
  };

  const saveInspectionResult = async (insp: Inspection, result: 'pass' | 'fail', note: string, subContractor: string) => {
    setSavingInsp(true);
    const updates = { result, note: note || null, sub_contractor_name: subContractor || null, inspected_by: user?.full_name ?? user?.email ?? null, inspected_at: new Date().toISOString() };
    await supabase.from("installment_inspections").update(updates).eq("id", insp.id);
    setInspections(prev => prev.map(i => i.id === insp.id ? { ...i, ...updates } : i));
    setSavingInsp(false);
  };

  const uploadInspectionPhoto = async (insp: Inspection, file: File) => {
    setUploadingInsp(insp.id);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `inspections/${insp.id}.${ext}`;
    const { error } = await supabase.storage.from("installment-photos").upload(path, file, { upsert: true });
    if (error) { setUploadingInsp(null); setToast({ msg: "อัปโหลดรูปไม่สำเร็จ: " + error.message, type: "error" }); return; }
    const { data: { publicUrl } } = supabase.storage.from("installment-photos").getPublicUrl(path);
    await supabase.from("installment_inspections").update({ photo_url: publicUrl }).eq("id", insp.id);
    setInspections(prev => prev.map(i => i.id === insp.id ? { ...i, photo_url: publicUrl } : i));
    setUploadingInsp(null);
    setToast({ msg: "อัปโหลดรูปสำเร็จ", type: "success" });
  };

  const toggleTask = async (task: InstTask) => {
    const updated = !task.is_complete;
    await supabase.from("installment_tasks").update({ is_complete: updated, verified_at: updated ? new Date().toISOString() : null }).eq("id", task.id);
    setInstTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_complete: updated } : t));
  };

  const doAdvanceInst = async (inst: Installment) => {
    const next: Record<string, string> = { pending: "in_review", in_review: "approved", approved: "paid" };
    const newStatus = next[inst.status] ?? inst.status;
    if (newStatus === inst.status) return;
    if (inst.status === "pending") {
      const instInsps = inspections.filter(i => i.contractor_installment_id === inst.id);
      if (instInsps.length > 0 && !instInsps.every(i => i.result === 'pass')) {
        setToast({ msg: "ต้องตรวจผ่านทุกรายการงานก่อนส่งตรวจสอบ", type: "error" });
        setConfirmInst(null); return;
      }
      if (instHouse) {
        const openDefs = defects.filter(d => d.house_id === instHouse.id && (d.status === "Open" || d.status === "In Progress"));
        if (openDefs.length > 0) {
          setToast({ msg: `มี Defect ที่ยังไม่แก้ไข ${openDefs.length} รายการ — ต้องแก้ไขให้ครบ (Resolved) ก่อนส่งตรวจสอบ`, type: "error" });
          setConfirmInst(null); return;
        }
      }
    }
    if (inst.status === "in_review" && !user?.isManager) {
      setToast({ msg: "ต้องรออนุมัติจากผู้จัดการผ่านหน้าระบบอนุมัติ", type: "error" });
      setConfirmInst(null); return;
    }
    if (inst.status === "approved") {
      const { data: approvedLogs } = await supabase.from("approval_logs")
        .select("approval_id").eq("source_record_id", inst.id)
        .eq("workflow_type", "Installment_Review").eq("action_taken", "Approved").limit(1);
      if (!approvedLogs || approvedLogs.length === 0) {
        setToast({ msg: "ยังไม่มีบันทึกการอนุมัติ — กรุณาอนุมัติจากหน้าระบบอนุมัติก่อน", type: "error" });
        setConfirmInst(null); return;
      }
    }
    const byName = user?.full_name ?? user?.email ?? "Unknown";
    const updatePayload: Record<string, string | null> = { status: newStatus };
    if (newStatus === "in_review") updatePayload.created_by_name = byName;
    if (newStatus === "paid") { updatePayload.paid_by = byName; updatePayload.paid_at = new Date().toISOString(); }
    await supabase.from("contractor_installments").update(updatePayload).eq("id", inst.id);
    setInstallments(prev => prev.map(i => i.id === inst.id ? { ...i, status: newStatus, ...(newStatus === "in_review" ? { created_by_name: byName } : {}) } : i));
    const statusLabels: Record<string, string> = { in_review: "ส่งตรวจสอบแล้ว", approved: "อนุมัติงวดแล้ว", paid: "บันทึกจ่ายเงินแล้ว" };
    const notifType: Record<string, "info" | "approval" | "success"> = { in_review: "info", approved: "approval", paid: "success" };
    if (newStatus === "in_review") {
      const docNum = await generateDocNumber("INST");
      const docIndex = `${docNum} | ${inst.name}${instHouse ? ` — ${instHouse.house_number}` : ""} | โดย ${byName}`;
      const slaDue = calcSlaDueAt("Installment_Review");
      await supabase.from("approval_logs").insert({
        workflow_type: "Installment_Review",
        source_doc_index: docIndex,
        source_record_id: inst.id,
        current_approver_role: user?.isAdmin ? "admin" : "manager",
        action_taken: "Pending",
        amount: inst.amount ?? null,
        sla_due_at: slaDue,
        assigned_to_name: "ผู้จัดการ",
      });
      // Phase 1 — audit trail + route work to the manager's inbox
      await logWorkflowEvent({
        workflowType: "Installment_Review",
        sourceRecordId: inst.id,
        docIndex,
        eventType: "submitted",
        stageFrom: "pending",
        stageTo: "in_review",
        actorName: byName,
        actorRole: user?.isManager ? "manager" : "engineer",
        routedToRole: "manager",
        routedToName: "ผู้จัดการ",
        amount: inst.amount ?? null,
      });
      await createWorkQueue({
        workflowType: "Installment_Review",
        sourceRecordId: inst.id,
        docIndex,
        title: `อนุมัติงวดงาน: ${inst.name}${instHouse ? ` — ${instHouse.house_number}` : ""}`,
        amount: inst.amount ?? null,
        assignedRole: "manager",
        slaDueAt: slaDue,
      });
      notifyPush("ฝ่ายบริหาร", "งวดงานรออนุมัติ", `${inst.name}${instHouse ? ` — ${instHouse.house_number}` : ""}`, "/approvals", `inst-${inst.id}`);
    }
    if (newStatus === "paid") {
      // Phase 1 — close the finance queue + record the payment event
      await closeWorkQueue(inst.id, "finance", byName);
      await logWorkflowEvent({
        workflowType: "Installment_Review",
        sourceRecordId: inst.id,
        eventType: "paid",
        stageFrom: "approved",
        stageTo: "paid",
        actorName: byName,
        actorRole: "finance",
        amount: inst.amount ?? null,
      });
      // Phase 3 — notify the contractor (LINE/SMS + track link)
      notifyContractor(instHouse?.contractor_line_id, "paid", inst.name);
    }
    await createNotification({
      type: notifType[newStatus] ?? "info",
      title: `${inst.name} — ${statusLabels[newStatus] ?? newStatus}`,
      message: `${instHouse ? `ยูนิต ${instHouse.house_number} · ` : ""}โดย ${byName}`,
      from_dept: "ฝ่ายก่อสร้าง",
      to_dept: newStatus === "in_review" ? "ผู้บริหาร" : undefined,
    });
    setToast({ msg: statusLabels[newStatus] ?? newStatus, type: "success" });
    setConfirmInst(null);
  };

  const rejectInstallment = async (inst: Installment, reason: string) => {
    await supabase.from("contractor_installments").update({
      status: "rejected", rejection_reason: reason, rejected_at: new Date().toISOString(), rejection_count: (inst.rejection_count ?? 0) + 1,
    }).eq("id", inst.id);
    await supabase.from("approval_logs").update({ action_taken: "Rejected" })
      .eq("source_record_id", inst.id).eq("action_taken", "Pending");
    await closeWorkQueue(inst.id, "manager", user?.full_name ?? user?.email ?? null);
    await logWorkflowEvent({
      workflowType: "Installment_Review",
      sourceRecordId: inst.id,
      eventType: "rejected",
      actorName: user?.full_name ?? user?.email ?? "ผู้บริหาร",
      actorRole: "manager",
      routedToRole: "engineer",
      conditionNote: reason || "ตีกลับให้แก้ไข",
      amount: inst.amount ?? null,
    });
    notifyPush("ฝ่ายก่อสร้าง", "งวดงานถูกตีกลับ", `${inst.name} — ${reason || "กรุณาตรวจสอบ"}`, "/construction", `inst-${inst.id}`);
    notifyContractor(instHouse?.contractor_line_id, "rejected", reason);
    setInstallments(prev => prev.map(i => i.id === inst.id ? { ...i, status: "rejected", rejection_reason: reason } : i));
    await createNotification({ type: "info", title: `${inst.name} — ถูกปฏิเสธ`, message: reason || "กรุณาตรวจสอบและแก้ไขก่อนส่งใหม่", from_dept: "ผู้บริหาร" });
    setToast({ msg: "ปฏิเสธงวดงานแล้ว — แจ้งวิศวกรแล้ว", type: "success" });
  };

  const advanceInstStatus = (inst: Installment) => {
    const next: Record<string, string> = { pending: "in_review", rejected: "in_review", in_review: "approved", approved: "paid" };
    if (!next[inst.status] || next[inst.status] === inst.status) return;
    if (inst.status === "pending" || inst.status === "rejected") {
      setAckInst(inst);
      setAckName(instHouse?.contractor ?? "");
      setShowAckModal(true);
      return;
    }
    setConfirmInst(inst);
  };

  const handleAckAndSubmit = async () => {
    if (!ackInst || !ackName.trim()) return;
    const now = new Date().toISOString();
    await supabase.from("contractor_installments").update({
      contractor_ack_name: ackName.trim(),
      contractor_acknowledged_at: now,
    }).eq("id", ackInst.id);
    setInstallments(prev => prev.map(i => i.id === ackInst.id ? { ...i, contractor_ack_name: ackName.trim(), contractor_acknowledged_at: now } : i));
    await logWorkflowEvent({
      workflowType: "Installment_Review",
      sourceRecordId: ackInst.id,
      eventType: "acknowledged",
      actorName: ackName.trim(),
      actorRole: "contractor",
      conditionNote: "ผู้รับเหมารับทราบงวดงาน",
    });
    const inst = ackInst;
    setShowAckModal(false);
    setAckInst(null);
    setAckName("");
    setConfirmInst(inst);
  };

  const printCertificate = (inst: Installment) => {
    if (!instHouse) return;
    const dateStr = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const instInsps = inspections.filter(i => i.contractor_installment_id === inst.id);
    const passCount = instInsps.filter(i => i.result === "pass").length;
    const rows = instInsps.map(i => `<tr><td>${i.work_item_name}</td><td style="color:${i.result === "pass" ? "#1E4A35" : "#c0392b"};font-weight:bold">${i.result === "pass" ? "✓ ผ่าน" : "✗ ไม่ผ่าน"}</td><td>${i.note ?? ""}</td><td>${i.inspected_by ?? ""}</td></tr>`).join("");
    const ackDate = inst.contractor_acknowledged_at ? new Date(inst.contractor_acknowledged_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "—";
    const paidDate = inst.paid_at ? new Date(inst.paid_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "—";
    const laborLine = (inst.labor_cost || inst.material_cost) ? `<div><b>ค่าแรง:</b> ฿${(inst.labor_cost ?? 0).toLocaleString("th-TH")}</div><div><b>ค่าวัสดุ:</b> ฿${(inst.material_cost ?? 0).toLocaleString("th-TH")}</div>` : "";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ใบรับรองผลงาน — ${inst.name}</title><style>*{box-sizing:border-box}body{font-family:"IBM Plex Sans Thai","Noto Sans Thai",Arial,sans-serif;margin:0;padding:32px;font-size:13px;color:#1a1a1a}.header{border-bottom:3px solid #1E4A35;padding-bottom:16px;margin-bottom:20px}.logo{font-size:20px;font-weight:900;color:#1E4A35;letter-spacing:2px}.logo span{color:#D4AF37}h2{font-size:15px;font-weight:700;margin:6px 0 0}.meta{font-size:11px;color:#666;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px;margin:12px 0}th{background:#1E4A35;color:#D4AF37;padding:8px;text-align:left;font-size:11px}td{padding:7px 8px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#fafafa}.box{background:#f9f9f9;border:1px solid #ddd;border-radius:8px;padding:12px;margin:10px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}.box-green{background:#f0f7f3;border-color:#1E4A35}.sig-row{display:flex;gap:32px;margin-top:48px;padding-top:16px;border-top:1px solid #eee}.sig{flex:1;text-align:center}.sig-line{border-top:1px solid #555;margin:40px 0 6px}.sig-role{font-size:11px;color:#444;font-weight:600}.sig-name{font-size:10px;color:#888;margin-top:2px}.btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}@media print{.btns{display:none!important}}</style></head><body><div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div><div class="header"><div class="logo">AVIVA <span>Private</span></div><h2>ใบรับรองผลงาน (Certificate of Completion)</h2><div class="meta">โครงการ AVIVA Private &nbsp;·&nbsp; วันที่พิมพ์: ${dateStr}</div></div><div class="box"><div><b>ยูนิต:</b> ${instHouse.house_number}</div><div><b>ผู้รับเหมา:</b> ${instHouse.contractor ?? "—"}</div><div><b>งวดงาน:</b> ${inst.name}</div><div><b>มูลค่างวด:</b> ฿${inst.amount.toLocaleString("th-TH")}</div><div><b>วิศวกรควบคุม:</b> ${instHouse.site_engineer ?? "—"}</div><div><b>สถานะ:</b> <span style="color:#1E4A35;font-weight:bold">จ่ายแล้ว ✓</span></div>${laborLine}</div><p style="font-size:12px;margin:8px 0">ผลการตรวจงาน: ผ่าน <b style="color:#1E4A35">${passCount}</b> / ${instInsps.length} รายการ</p><table><thead><tr><th>รายการงาน</th><th>ผล</th><th>หมายเหตุ</th><th>ตรวจโดย</th></tr></thead><tbody>${rows || "<tr><td colspan='4' style='text-align:center;color:#999'>ยังไม่มีรายการตรวจ</td></tr>"}</tbody></table><div class="box box-green"><div><b>ผู้รับเหมาลงชื่อรับทราบ:</b> ${inst.contractor_ack_name ?? "—"}</div><div><b>วันที่รับทราบ:</b> ${ackDate}</div><div><b>อนุมัติจ่ายโดย:</b> ${inst.paid_by ?? "—"}</div><div><b>วันที่จ่าย:</b> ${paidDate}</div></div><div class="sig-row"><div class="sig"><div class="sig-line"></div><div class="sig-role">วิศวกรควบคุมงาน</div><div class="sig-name">(${instHouse.site_engineer ?? "..................................."})</div></div><div class="sig"><div class="sig-line"></div><div class="sig-role">ผู้จัดการโครงการ</div><div class="sig-name">(...................................)</div></div><div class="sig"><div class="sig-line"></div><div class="sig-role">ผู้รับเหมา</div><div class="sig-name">(${inst.contractor_ack_name ?? "..................................."})</div></div></div><p style="margin-top:20px;font-size:10px;color:#bbb;text-align:center">จัดทำโดยระบบ AVIVA ONE &nbsp;·&nbsp; เอกสารนี้ออกโดยระบบอัตโนมัติหลังอนุมัติงวดงาน</p></body></html>`);
    w.document.close();
  };

  const printRejectionNotice = (inst: Installment) => {
    if (!instHouse) return;
    const dateStr = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const instInsps = inspections.filter(i => i.contractor_installment_id === inst.id);
    const failItems = instInsps.filter(i => i.result === "fail");
    const rows = failItems.map(i => `<tr><td>${i.work_item_name}</td><td style="color:#c0392b;font-weight:bold">✗ ไม่ผ่าน</td><td>${i.note ?? "—"}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>หนังสือแจ้งข้อบกพร่อง — ${inst.name}</title><style>*{box-sizing:border-box}body{font-family:"IBM Plex Sans Thai","Noto Sans Thai",Arial,sans-serif;margin:0;padding:32px;font-size:13px;color:#1a1a1a}.header{border-bottom:3px solid #c0392b;padding-bottom:16px;margin-bottom:20px}.logo{font-size:20px;font-weight:900;color:#1E4A35;letter-spacing:2px}.logo span{color:#D4AF37}h2{font-size:15px;font-weight:700;margin:6px 0 0;color:#c0392b}.meta{font-size:11px;color:#666;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px;margin:12px 0}th{background:#c0392b;color:#fff;padding:8px;text-align:left;font-size:11px}td{padding:7px 8px;border-bottom:1px solid #eee}.box{background:#fff5f5;border:1px solid #f5c6c6;border-radius:8px;padding:12px;margin:10px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}.reason-box{background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:12px;margin:10px 0}.sig-row{display:flex;gap:32px;margin-top:48px;padding-top:16px;border-top:1px solid #eee}.sig{flex:1;text-align:center}.sig-line{border-top:1px solid #555;margin:40px 0 6px}.sig-role{font-size:11px;color:#444;font-weight:600}.btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#c0392b;color:#fff}.btn-c{background:#eee;color:#333}@media print{.btns{display:none!important}}</style></head><body><div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div><div class="header"><div class="logo">AVIVA <span>Private</span></div><h2>หนังสือแจ้งข้อบกพร่อง (Defect Notice)</h2><div class="meta">โครงการ AVIVA Private &nbsp;·&nbsp; วันที่: ${dateStr}</div></div><div class="box"><div><b>ยูนิต:</b> ${instHouse.house_number}</div><div><b>ผู้รับเหมา:</b> ${instHouse.contractor ?? "—"}</div><div><b>งวดงาน:</b> ${inst.name}</div><div><b>มูลค่างวด:</b> ฿${inst.amount.toLocaleString("th-TH")}</div></div>${inst.rejection_reason ? `<div class="reason-box"><b>เหตุผลที่ปฏิเสธ:</b><p style="margin:6px 0 0;color:#795548">${inst.rejection_reason}</p></div>` : ""}<p style="font-size:12px;margin:16px 0 4px;font-weight:700">รายการงานที่ไม่ผ่านการตรวจ (${failItems.length} รายการ)</p><table><thead><tr><th>รายการงาน</th><th>ผล</th><th>หมายเหตุ/เหตุผล</th></tr></thead><tbody>${rows || "<tr><td colspan='3' style='text-align:center;color:#999'>ไม่มีรายการที่ระบุ</td></tr>"}</tbody></table><p style="font-size:12px;color:#555;margin:16px 0">กรุณาแก้ไขรายการข้างต้นให้เรียบร้อยแล้วส่งตรวจซ้ำอีกครั้ง ภายใน 7 วันทำงาน นับจากวันที่ได้รับหนังสือฉบับนี้</p><div class="sig-row"><div class="sig"><div class="sig-line"></div><div class="sig-role">วิศวกรควบคุมงาน</div></div><div class="sig"><div class="sig-line"></div><div class="sig-role">ผู้จัดการโครงการ</div></div><div class="sig"><div class="sig-line"></div><div class="sig-role">ผู้รับเหมา (รับทราบ)</div></div></div><p style="margin-top:20px;font-size:10px;color:#bbb;text-align:center">จัดทำโดยระบบ AVIVA ONE</p></body></html>`);
    w.document.close();
  };

  const printDailyReport = () => {
    const dateStr = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const uniqueHouseIds = new Set(reports.map(r => r.house_id)).size;
    const avgProgress = reports.length > 0 ? Math.round(reports.reduce((s, r) => s + r.progress, 0) / reports.length) : 0;
    const rows = reports.map(r => {
      const house = houses.find(h => h.id === r.house_id);
      const d = new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
      const t = new Date(r.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const photo = r.photo_url ? `<img src="${r.photo_url}" style="width:52px;height:52px;object-fit:cover;border-radius:5px;border:1px solid #ddd;" />` : "—";
      return `<tr><td style="white-space:nowrap">${d}<br><span style="color:#888;font-size:10px">${t}</span></td><td style="font-weight:600">${house?.house_number ?? "—"}</td><td>${r.work_type ?? "—"}</td><td>${r.work_detail ?? "—"}</td><td style="text-align:center;font-weight:700">${r.progress ?? 0}%</td><td style="color:#c0392b">${r.issue || "—"}</td><td style="text-align:center">${r.reported_by ?? "—"}</td><td style="text-align:center">${photo}</td></tr>`;
    }).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>รายงานประจำวัน — ฝ่ายก่อสร้าง</title><style>*{box-sizing:border-box}body{font-family:'IBM Plex Sans Thai','Noto Sans Thai',Arial,sans-serif;margin:0;padding:32px;font-size:12px;color:#1a1a1a}.header{border-bottom:3px solid #1E4A35;padding-bottom:12px;margin-bottom:16px}.logo{font-size:20px;font-weight:900;color:#1E4A35;letter-spacing:2px}.logo span{color:#D4AF37}h2{font-size:15px;font-weight:700;margin:4px 0 0;color:#333}.meta{font-size:11px;color:#666;margin-top:4px}.summary{display:flex;gap:12px;margin:12px 0 16px}.sb{background:#f5f5f5;border-radius:8px;padding:10px 14px;flex:1;border-left:3px solid #1E4A35}.sb .num{font-size:20px;font-weight:900;color:#1E4A35}.sb .lbl{font-size:10px;color:#666;margin-top:2px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#1E4A35}th{color:#D4AF37;padding:7px 8px;text-align:left;font-size:11px;font-weight:600}td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}tr:nth-child(even) td{background:#fafafa}.footer{margin-top:36px;display:flex;justify-content:space-between;align-items:flex-end}.sig{text-align:center;width:200px}.sig-line{border-top:1px solid #555;margin:48px 0 6px}.sig-name{font-size:11px;color:#555}.btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}@media print{.btns{display:none!important}body{padding:20px}}</style></head><body><div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div><div class="header"><div class="logo">AVIVA <span>Private</span></div><h2>รายงานประจำวัน — ฝ่ายก่อสร้าง</h2><div class="meta">วันที่พิมพ์: ${dateStr}</div></div><div class="summary"><div class="sb"><div class="num">${reports.length}</div><div class="lbl">รายการทั้งหมด</div></div><div class="sb"><div class="num">${uniqueHouseIds}</div><div class="lbl">ยูนิตที่รายงาน</div></div><div class="sb"><div class="num">${avgProgress}%</div><div class="lbl">เฉลี่ยความคืบหน้า</div></div></div><table><thead><tr><th>วันที่/เวลา</th><th>ยูนิต</th><th>ประเภทงาน</th><th>รายละเอียดงาน</th><th style="text-align:center">คืบหน้า</th><th>ปัญหา/หมายเหตุ</th><th style="text-align:center">ผู้รายงาน</th><th style="text-align:center">รูป</th></tr></thead><tbody>${rows}</tbody></table><div class="footer"><div style="font-size:11px;color:#aaa">จัดทำโดยระบบ AVIVA ONE — ${dateStr}</div><div class="sig"><div class="sig-line"></div><div class="sig-name">ผู้จัดทำรายงาน</div><div style="color:#aaa;font-size:10px;margin-top:2px">(...............................................)</div></div></div></body></html>`);
    w.document.close();
  };

  const printInstReport = () => {
    if (!instHouse) return;
    const dateStr = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const rows = installments.map(inst => {
      const tasks = instTasks.filter(t => t.installment_id === inst.id);
      const done = tasks.filter(t => t.is_complete).length;
      const statusTh: Record<string,string> = { pending: "รอดำเนินการ", in_review: "รออนุมัติ", approved: "อนุมัติแล้ว", paid: "เบิกแล้ว", rejected: "ปฏิเสธ" };
      return `<tr><td>${inst.installment_no}</td><td>${inst.name}</td><td>${done}/${tasks.length}</td><td>฿${inst.amount.toLocaleString("th-TH")}</td><td>${statusTh[inst.status] ?? inst.status}</td></tr>`;
    }).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>รายงานงวดงาน — ${instHouse.house_number}</title><style>*{box-sizing:border-box}body{font-family:'IBM Plex Sans Thai','Noto Sans Thai',Arial,sans-serif;margin:0;padding:32px;font-size:13px;color:#1a1a1a}.header{border-bottom:3px solid #1E4A35;padding-bottom:12px;margin-bottom:16px}.logo{font-size:18px;font-weight:900;color:#1E4A35;letter-spacing:2px}.logo span{color:#D4AF37}h2{font-size:14px;font-weight:700;margin:4px 0 0;color:#333}.meta{font-size:11px;color:#666;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}thead tr{background:#1E4A35}th{color:#D4AF37;padding:7px 8px;text-align:left;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#fafafa}.btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}@media print{.btns{display:none!important}body{padding:20px}}</style></head><body><div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div><div class="header"><div class="logo">AVIVA <span>Private</span></div><h2>รายงานงวดงาน — ${instHouse.house_number}</h2><div class="meta">วันที่พิมพ์: ${dateStr} · ผู้รับเหมา: ${instHouse.contractor ?? "—"} · วิศวกร: ${instHouse.site_engineer ?? "—"}</div></div><table><thead><tr><th>งวดที่</th><th>ชื่องวด</th><th>เช็คลิสต์</th><th>มูลค่า</th><th>สถานะ</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
  };

  const uploadTaskPhoto = async (task: InstTask, file: File) => {
    setUploadingTask(task.id);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `tasks/${task.id}.${ext}`;
    const { error } = await supabase.storage.from("installment-photos").upload(path, file, { upsert: true });
    if (error) { setUploadingTask(null); setToast({ msg: "อัปโหลดรูปไม่สำเร็จ: " + error.message, type: "error" }); return; }
    const { data: { publicUrl } } = supabase.storage.from("installment-photos").getPublicUrl(path);
    await supabase.from("installment_tasks").update({ photo_url: publicUrl }).eq("id", task.id);
    setInstTasks(prev => prev.map(t => t.id === task.id ? { ...t, photo_url: publicUrl } : t));
    setUploadingTask(null);
    setToast({ msg: "อัปโหลดรูปสำเร็จ", type: "success" });
  };

  const counts = {
    all: houses.length,
    complete: houses.filter(h => h.status === "complete").length,
    building: houses.filter(h => h.status !== "complete").length,
    "on-track": houses.filter(h => h.status === "on-track").length,
    delayed: houses.filter(h => h.status === "delayed").length,
  };
  const overallProgress = useMemo(
    () => houses.length ? Math.round(houses.reduce((s, h) => s + h.progress, 0) / houses.length) : 0,
    [houses]
  );
  const filtered = useMemo(
    () => filterStatus === "all" ? houses : filterStatus === "building" ? houses.filter(h => h.status !== "complete") : houses.filter(h => h.status === filterStatus),
    [houses, filterStatus]
  );
  const openDefects = defects.filter(d => d.status === "Open").length;
  const reporterNames = [...new Set(reports.filter(r => r.reported_by).map(r => r.reported_by as string))];

  const addTask = async (inst: Installment, taskName: string) => {
    if (!taskName.trim()) return;
    const existing = instTasks.filter(t => t.installment_id === inst.id);
    const { data } = await supabase.from("installment_tasks").insert({
      installment_id: inst.id,
      task_no: existing.length + 1,
      task_name: taskName.trim(),
      is_complete: false,
      photo_url: null,
      notes: null,
    }).select().single();
    if (data) {
      setInstTasks(prev => [...prev, data as InstTask]);
      setNewTaskInputs(prev => ({ ...prev, [inst.id]: "" }));
    }
  };

  const removeTask = async (taskId: string) => {
    await supabase.from("installment_tasks").delete().eq("id", taskId);
    setInstTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const sendAiMessage = async () => {
    const q = aiInput.trim();
    if (!q || aiLoading) return;
    setAiMessages(prev => [...prev, { role: "user", content: q }]);
    setAiInput("");
    setAiLoading(true);
    const ctx = `ข้อมูลฝ่ายก่อสร้าง AVIVA Private: ยูนิตทั้งหมด ${houses.length} หน่วย | เสร็จแล้ว ${counts.complete} | กำลังก่อสร้าง ${counts.building} (ตามแผน ${counts["on-track"]} ล่าช้า ${counts.delayed}) | ความคืบหน้าเฉลี่ย ${overallProgress}% | Defect เปิดอยู่ ${openDefects} รายการ | มีลูกค้าจอง ${customerPlots.size} หน่วย`;
    try {
      const res = await fetch("/api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q, context: ctx }) });
      const d = await res.json();
      setAiMessages(prev => [...prev, { role: "assistant", content: d.reply ?? "ขออภัย เกิดข้อผิดพลาด" }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "ขออภัย ไม่สามารถเชื่อมต่อได้ในขณะนี้" }]);
    }
    setAiLoading(false);
  };

  const openEditReport = (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReport(report);
    setSelectedHouse(null);
    setForm({ house_id: report.house_id, work_detail: report.work_detail, progress: String(report.progress), issue: report.issue ?? "", new_status: "on-track", reported_by: report.reported_by ?? "", work_type: report.work_type ?? "งานตรวจสอบ" });
    setDailyPhoto(null);
    setDailyPhotoPreview(report.photo_url ?? "");
    setShowModal(true);
  };

  const openEditHouse = (house: House) => {
    setEditingHouse(house);
    setHouseForm({ house_number: house.house_number, contractor: house.contractor ?? "", phase: house.phase ?? "", delayed_days: String(house.delayed_days ?? 0), status: house.status, progress: String(house.progress), planned_completion_date: house.planned_completion_date ?? "", site_engineer: house.site_engineer ?? "" });
    setShowHouseEditModal(true);
  };

  const openDefectModal = (house: House) => {
    setDefectHouse(house);
    setDefectForm({ house_id: house.id, defect_category: "งานสี", description: "", severity: "medium", assigned_to: "", due_date: "", installment_no: "" });
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
      await supabase.from("construction_reports").update({ work_detail: form.work_detail, work_type: form.work_type, progress: Number(form.progress) || 0, issue: form.issue, updated_at: new Date().toISOString() }).eq("id", editingReport.id);
      await supabase.from("houses").update({ progress: Number(form.progress) || 0, status: form.new_status }).eq("id", editingReport.house_id);
    } else {
      if (!form.house_id) { setSaving(false); return; }
      const { data: inserted } = await supabase.from("construction_reports").insert({ house_id: form.house_id, work_detail: form.work_detail, work_type: form.work_type, progress: Number(form.progress) || 0, issue: form.issue, reported_by: form.reported_by || null }).select().single();
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
    await supabase.from("defects").insert({ house_id: defectForm.house_id, defect_category: defectForm.defect_category, description: defectForm.description, status: "Open", severity: defectForm.severity, assigned_to: defectForm.assigned_to || null, due_date: defectForm.due_date || null, installment_no: defectForm.installment_no ? Number(defectForm.installment_no) : null });
    setSaving(false);
    setShowDefectModal(false);
    setDefectHouse(null);
    setDefectForm({ house_id: "", defect_category: "งานสี", description: "", severity: "medium", assigned_to: "", due_date: "", installment_no: "" });
    fetchData();
  };

  const updateDefectStatus = async (id: string, newStatus: string) => {
    const update: Record<string, string> = { status: newStatus };
    if (newStatus === "Resolved") update.resolved_at = new Date().toISOString();
    await supabase.from("defects").update(update).eq("defect_id", id);
    fetchData();
  };

  const handleSubmitPR = async () => {
    const validItems = prItems.filter(it => it.name.trim());
    if (!prForm.supplier_name || validItems.length === 0) return;
    setSavingPR(true);
    const itemsData = validItems.map(it => ({
      name: it.name.trim(),
      qty: Number(it.qty) || 1,
      unit: it.unit || "ชิ้น",
      unit_price: Number(it.unit_price) || 0,
    }));
    const totalAmount = itemsData.reduce((s, it) => s + it.qty * it.unit_price, 0);
    const byName = user?.full_name ?? user?.email ?? "Unknown";
    const docNum = await generateDocNumber("PO");
    const { data: po } = await supabase.from("purchase_orders").insert({
      project_id: PROJECT_ID,
      po_number: docNum,
      supplier_name: prForm.supplier_name,
      items: itemsData,
      total_amount: totalAmount,
      status: "pending",
      requested_by: byName,
      notes: prForm.notes || null,
    }).select().single();
    if (po) {
      await supabase.from("approval_logs").insert({
        workflow_type: "Material_Purchase",
        source_doc_index: `${docNum} | จัดซื้อจาก ${prForm.supplier_name} | โดย ${byName}`,
        source_record_id: (po as PurchaseOrder).id,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: totalAmount || null,
        sla_due_at: calcSlaDueAt("Material_Purchase"),
        assigned_to_name: "ผู้จัดการ",
      });
      await createNotification({
        type: "approval",
        title: `ขออนุมัติจัดซื้อ ${docNum}`,
        message: `${prForm.supplier_name} · ฿${totalAmount.toLocaleString("th-TH")} · โดย ${byName}`,
        from_dept: "ฝ่ายก่อสร้าง",
        to_dept: "ผู้บริหาร",
      });
      setPurchaseOrders(prev => [po as PurchaseOrder, ...prev]);
      setToast({ msg: `ส่งขออนุมัติ ${docNum} แล้ว ✓`, type: "success" });
    }
    setShowPRModal(false);
    setPrForm({ supplier_name: "", notes: "" });
    setPrItems([{ name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }]);
    setSavingPR(false);
  };

  const openSummaryModal = async () => {
    setLoadingSummary(true);
    const today = new Date().toISOString().split("T")[0];
    const { data: todayRpts } = await supabase
      .from("construction_reports")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`)
      .neq("work_type", "สรุปประจำวัน")
      .order("created_at");
    const rpts = (todayRpts as Report[]) ?? [];
    const dailyText = rpts.length > 0
      ? rpts.map(r => {
          const h = houses.find(hh => hh.id === r.house_id);
          return `• ${h?.house_number ?? "—"}: ${r.work_detail}${r.work_type ? ` [${r.work_type}]` : ""} — ${r.progress}%${r.issue ? `\n  ⚠ ${r.issue}` : ""}`;
        }).join("\n")
      : "ไม่มีรายงานงานรายวันในวันนี้";
    const todayInsps = inspections.filter(i => i.inspected_at?.startsWith(today) && i.result !== "pending");
    const contractorText = todayInsps.length > 0
      ? installments.filter(inst => inspections.some(i => i.contractor_installment_id === inst.id && i.inspected_at?.startsWith(today))).map(inst => {
          const h = houses.find(hh => hh.id === inst.house_id);
          const ii = inspections.filter(i => i.contractor_installment_id === inst.id && i.inspected_at?.startsWith(today));
          const pass = ii.filter(i => i.result === "pass").length;
          const fail = ii.filter(i => i.result === "fail").length;
          return `• ${h?.house_number ?? "—"} ${inst.name}: ผ่าน ${pass}/${ii.length}${fail > 0 ? ` (ไม่ผ่าน ${fail})` : ""}`;
        }).join("\n")
      : "ไม่มีการบันทึกตรวจงานผู้รับเหมาในวันนี้\n(กรุณาเพิ่มรายละเอียดในช่องด้านล่าง)";
    const openDefs = defects.filter(d => d.status === "Open");
    const problemsText = openDefs.length > 0
      ? `Defect เปิดอยู่ ${openDefs.length} รายการ:\n` + openDefs.slice(0, 5).map(d => {
          const h = houses.find(hh => hh.id === d.house_id);
          return `• ${h?.house_number ?? "—"}: ${d.description}`;
        }).join("\n") + (openDefs.length > 5 ? `\n... และอีก ${openDefs.length - 5} รายการ` : "")
      : "";
    setSummaryForm({ reporter: user?.full_name ?? "", contractor_summary: contractorText, daily_summary: dailyText, problems: problemsText, date: today });
    setSummaryPhoto(null);
    setSummaryPhotoPreview("");
    setLoadingSummary(false);
    setShowSummaryModal(true);
  };

  const printSummaryReport = () => {
    const dateStr = new Date(summaryForm.date + "T00:00:00").toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const w = window.open("", "_blank");
    if (!w) return;
    const photoHtml = summaryPhotoPreview ? `<div style="margin:16px 0"><img src="${summaryPhotoPreview}" style="max-width:100%;max-height:280px;border-radius:8px;border:1px solid #ddd;display:block" /></div>` : "";
    w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>รายงานสรุปประจำวัน — ฝ่ายก่อสร้าง</title><style>*{box-sizing:border-box}body{font-family:'IBM Plex Sans Thai','Noto Sans Thai',Arial,sans-serif;margin:0;padding:32px;font-size:13px;color:#1a1a1a}.header{border-bottom:3px solid #1E4A35;padding-bottom:12px;margin-bottom:20px}.logo{font-size:20px;font-weight:900;color:#1E4A35;letter-spacing:2px}.logo span{color:#D4AF37}h2{font-size:15px;font-weight:700;margin:4px 0 0;color:#333}.meta{font-size:11px;color:#666;margin-top:6px}.summary-bar{display:flex;gap:12px;background:#f9f9f9;border-radius:8px;padding:10px 14px;margin-bottom:20px;border-left:3px solid #1E4A35}.sb-item{flex:1}.sb-num{font-size:18px;font-weight:900;color:#1E4A35}.sb-lbl{font-size:10px;color:#888;margin-top:2px}section{margin-bottom:20px}h3{font-size:13px;font-weight:700;color:#1E4A35;border-bottom:1px solid #e0e0e0;padding-bottom:6px;margin-bottom:10px}pre{white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.8;color:#333;margin:0;background:#fafafa;border-radius:6px;padding:10px}.footer{margin-top:36px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #ddd;padding-top:16px}.sig{text-align:center;width:180px}.sig-line{border-top:1px solid #555;margin:48px 0 6px}.sig-name{font-size:11px;color:#555}.btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}@media print{.btns{display:none!important}body{padding:20px}}</style></head><body><div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div><div class="header"><div class="logo">AVIVA <span>Private</span></div><h2>รายงานสรุปประจำวัน — ฝ่ายก่อสร้าง</h2><div class="meta">วันที่: ${dateStr} &nbsp;·&nbsp; ผู้จัดทำ: ${summaryForm.reporter || "—"} &nbsp;·&nbsp; ความคืบหน้าเฉลี่ย: ${overallProgress}%</div></div><div class="summary-bar"><div class="sb-item"><div class="sb-num">${houses.length}</div><div class="sb-lbl">ยูนิตทั้งหมด</div></div><div class="sb-item"><div class="sb-num">${overallProgress}%</div><div class="sb-lbl">คืบหน้าเฉลี่ย</div></div><div class="sb-item"><div class="sb-num">${counts.complete}</div><div class="sb-lbl">เสร็จแล้ว</div></div><div class="sb-item"><div class="sb-num">${defects.filter(d=>d.status==="Open").length}</div><div class="sb-lbl">Defect เปิด</div></div></div><section><h3>งานตรวจผู้รับเหมา</h3><pre>${summaryForm.contractor_summary}</pre></section><section><h3>งานรายวัน</h3><pre>${summaryForm.daily_summary}</pre></section>${summaryForm.problems ? `<section><h3>ปัญหา / ข้อสังเกต</h3><pre>${summaryForm.problems}</pre></section>` : ""}${photoHtml}<div class="footer"><div style="font-size:11px;color:#aaa">จัดทำโดยระบบ AVIVA ONE — ${dateStr}</div><div class="sig"><div class="sig-line"></div><div class="sig-name">${summaryForm.reporter || "ผู้จัดทำรายงาน"}</div><div style="color:#aaa;font-size:10px;margin-top:2px">(...............................................)</div></div></div></body></html>`);
    w.document.close();
  };

  const submitSummaryReport = async () => {
    setSendingSummary(true);
    let photoUrl: string | null = null;
    if (summaryPhoto) {
      setUploadingSummaryPhoto(true);
      const ext = summaryPhoto.name.split(".").pop() ?? "jpg";
      const filePath = `daily/summary-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("construction-daily-photos").upload(filePath, summaryPhoto, { upsert: true });
      if (error) {
        setToast({ msg: "อัปโหลดรูปไม่สำเร็จ: " + error.message, type: "error" });
      } else {
        const { data: { publicUrl } } = supabase.storage.from("construction-daily-photos").getPublicUrl(filePath);
        photoUrl = publicUrl;
      }
      setUploadingSummaryPhoto(false);
    }
    // Persist summary report to construction_reports table
    await supabase.from("construction_reports").insert({
      work_type: "สรุปประจำวัน",
      work_detail: `[สรุป] ${summaryForm.contractor_summary}\n[รายวัน] ${summaryForm.daily_summary}${summaryForm.problems ? `\n[ปัญหา] ${summaryForm.problems}` : ""}`,
      progress: overallProgress,
      reported_by: summaryForm.reporter || null,
      photo_url: photoUrl,
      issue: summaryForm.problems || null,
    });
    const dateStr = new Date(summaryForm.date + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    await createNotification({
      type: "info",
      title: "รายงานสรุปประจำวัน — ฝ่ายก่อสร้าง",
      message: `${dateStr} · ${summaryForm.reporter || "วิศวกร"} · คืบหน้าเฉลี่ย ${overallProgress}%`,
      from_dept: "ฝ่ายก่อสร้าง",
    });
    setSendingSummary(false);
    setShowSummaryModal(false);
    setSummaryPhoto(null);
    setSummaryPhotoPreview("");
    setToast({ msg: "ส่งรายงานสรุปให้ผู้บริหารแล้ว ✓", type: "success" });
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardHat size={20} className="text-aviva-gold" />
              <div>
                <h1 className="text-xl font-bold text-aviva-text">ฝ่ายก่อสร้าง</h1>
                <p className="text-xs text-aviva-secondary">{loading ? "กำลังโหลด..." : `${houses.length} ยูนิต`}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={openSummaryModal} disabled={loadingSummary}
                className="flex items-center gap-1 text-[11px] text-aviva-gold border border-aviva-gold/30 px-2 py-1.5 rounded-xl bg-aviva-gold/5 hover:bg-aviva-gold/10 transition-all disabled:opacity-50">
                {loadingSummary ? <Loader2 size={11} className="animate-spin" /> : <ClipboardList size={11} />}
                สรุปรายงาน
              </button>
              {part === "inspect" && (
                <button onClick={() => setShowAI(p => !p)} className={clsx("flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all", showAI ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/20")}>
                  <Bot size={14} /> AI
                </button>
              )}
              {part === "daily" && (
                <button onClick={() => { setSelectedHouse(null); setEditingReport(null); setForm({ house_id: "", work_detail: "", progress: "", issue: "", new_status: "on-track", reported_by: "", work_type: "งานตรวจสอบ" }); setShowModal(true); }}
                  className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
                  <Plus size={14} /> รายงาน
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setPart("inspect")} className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all", part === "inspect" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10")}><HardHat size={13} /> ตรวจงาน</button>
            <button onClick={() => setPart("daily")} className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all", part === "daily" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10")}><FileText size={13} /> รายวัน</button>
            <button onClick={() => setPart("purchase")} className={clsx("relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all", part === "purchase" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10")}>
              <ShoppingCart size={13} /> จัดซื้อ
              {purchaseOrders.filter(p => p.status === "pending").length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-400 text-[9px] font-bold text-white flex items-center justify-center">{purchaseOrders.filter(p => p.status === "pending").length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {counts.delayed > 0 && (
          <button className="w-full text-left" onClick={() => { setPart("inspect"); setFilterStatus("delayed"); }}>
            <AIInsightPanel type="alert" priority="high" title={`มี ${counts.delayed} ยูนิตล่าช้ากว่าแผน`} message="กดเพื่อดูรายการยูนิตที่ล่าช้า — ควรตรวจสอบผู้รับเหมาและวางแผนเร่งงาน" />
          </button>
        )}
        {openDefects > 0 && (
          <button className="w-full text-left" onClick={() => { setPart("daily"); setTab("defects"); }}>
            <AIInsightPanel type="warning" priority="medium" title={`Defect เปิดอยู่ ${openDefects} รายการ`} message="กดเพื่อดูรายการ — ต้องดำเนินการแก้ไขก่อนส่งมอบบ้านให้ลูกค้า" />
          </button>
        )}

        <GlassCard gold className="p-4">
          <SectionHeader title="ภาพรวมการก่อสร้าง" />
          {houses.length === 0 ? (
            <p className="text-aviva-secondary text-sm text-center py-4">ยังไม่มีข้อมูลยูนิต</p>
          ) : (
            <>
              <ProgressBar label="ความคืบหน้าโดยรวม" value={overallProgress} sublabel={`${houses.length} ยูนิต`} />
              <div className="grid grid-cols-5 gap-1.5 mt-3">
                {filterBoxes.map(({ key, label, border, numColor }) => (
                  <button key={key} onClick={() => setFilterStatus(key)} className={clsx("rounded-xl border p-1.5 flex flex-col items-center gap-0.5 transition-all", border, filterStatus === key ? "ring-2 ring-aviva-gold/50 bg-aviva-gold/5" : "bg-aviva-bg/30")}>
                    <span className={clsx("text-base font-bold leading-none", numColor)}>{loading ? "—" : counts[key]}</span>
                    <span className="text-[8px] text-aviva-secondary leading-tight text-center">{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </GlassCard>

        {part === "inspect" && (
          <>
            {showAI && (
              <GlassCard className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Bot size={15} className="text-aviva-gold" />
                  <p className="text-sm font-semibold text-aviva-text">AI ฝ่ายก่อสร้าง</p>
                  <p className="text-[10px] text-aviva-secondary ml-auto">ช่วยวิเคราะห์งานก่อสร้าง</p>
                </div>
                {aiMessages.length > 0 && (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {aiMessages.map((m, i) => (
                      <div key={i} className={clsx("rounded-xl px-3 py-2 text-xs leading-relaxed", m.role === "user" ? "bg-aviva-gold/20 text-aviva-gold ml-8 text-right" : "bg-aviva-bg text-aviva-text mr-8")}>{m.content}</div>
                    ))}
                    {aiLoading && <div className="bg-aviva-bg rounded-xl px-3 py-2 text-xs text-aviva-secondary mr-8">กำลังประมวลผล...</div>}
                  </div>
                )}
                {aiMessages.length === 0 && !aiLoading && (
                  <div className="text-xs text-aviva-secondary/60 space-y-1">
                    <p>ตัวอย่างคำถาม:</p>
                    {["ยูนิตไหนล่าช้าที่สุด?", "สรุปสถานะการก่อสร้างวันนี้", "Defect ที่ต้องแก้ไขด่วนมีอะไรบ้าง?"].map(q => (
                      <button key={q} onClick={() => setAiInput(q)} className="block text-aviva-gold hover:text-aviva-gold/80 underline text-left">{q}</button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendAiMessage(); }} placeholder="ถามเกี่ยวกับงานก่อสร้าง..." className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/50" />
                  <button onClick={sendAiMessage} disabled={!aiInput.trim() || aiLoading} className="px-3 py-2 bg-aviva-gold text-aviva-bg rounded-xl disabled:opacity-40">
                    <Send size={13} />
                  </button>
                </div>
              </GlassCard>
            )}
            <div>
              <SectionHeader title={`ยูนิต (${filtered.length})`} subtitle="แตะยูนิตเพื่อดูงวดงานผู้รับเหมา" />
              {loading ? (
                <div className="grid grid-cols-4 gap-2">{[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-aviva-card/50 animate-pulse" />)}</div>
              ) : filtered.length === 0 ? (
                <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีข้อมูล</p></GlassCard>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {filtered.map(house => {
                    const isSelected = instHouse?.id === house.id;
                    const hasCustomer = house.plot_number != null && customerPlots.has(house.plot_number);
                    const statusBorder = house.status === "complete" ? "border-green-400/80"
                      : house.status === "delayed" ? "border-red-500/70"
                      : "border-sky-400/60";
                    return (
                      <button key={house.id} onClick={() => fetchInstallments(house)} className={clsx("relative rounded-xl border-2 p-2 flex flex-col items-center gap-0.5 transition-all active:scale-95", isSelected ? "bg-aviva-gold border-aviva-gold" : `bg-aviva-card ${statusBorder}`)}>
                        {hasCustomer && !isSelected && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-aviva-gold border border-aviva-bg" />
                        )}
                        <span className={clsx("text-sm font-black leading-none", isSelected ? "text-aviva-bg" : "text-aviva-gold")}>{(house.house_model ?? "A").charAt(0)}{house.plot_number ?? 0}</span>
                        <span className={clsx("text-[9px] leading-tight", isSelected ? "text-aviva-bg/70" : "text-aviva-secondary")}>{house.land_size ?? "—"}ตร.ว.</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!loading && filtered.length > 0 && (
                <div className="flex items-center gap-3 mt-2 flex-wrap text-[9px] text-aviva-secondary/60">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border-2 border-green-400/80 bg-aviva-card inline-block" />เสร็จแล้ว</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border-2 border-sky-400/60 bg-aviva-card inline-block" />ตามแผน</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border-2 border-red-500/70 bg-aviva-card inline-block" />ล่าช้า</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-aviva-gold inline-block" />มีลูกค้า</span>
                </div>
              )}
            </div>

            {instHouse && (
              <div ref={instPanelRef} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-aviva-text">{houseLabel(instHouse)}</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openDefectModal(instHouse)} className="p-1.5 rounded-xl border border-orange-400/30 text-orange-400 bg-orange-400/5"><Bug size={13} /></button>
                    <button onClick={() => openEditHouse(instHouse)} className="p-1.5 rounded-xl border border-aviva-gold/20 text-aviva-secondary bg-aviva-bg/50"><Pencil size={13} /></button>
                    <button onClick={printInstReport} className="flex items-center gap-1 text-[11px] text-aviva-gold border border-aviva-gold/30 px-2 py-1.5 rounded-xl"><Printer size={12} /> พิมพ์</button>
                    <button onClick={() => { setInstHouse(null); setHouseCustomer(null); }} className="p-1.5 rounded-xl border border-aviva-gold/20 text-aviva-secondary"><X size={13} /></button>
                  </div>
                </div>

                {houseCustomer && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3">
                    <p className="text-[10px] text-blue-400 font-semibold mb-1.5">ข้อมูลลูกค้า</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-aviva-text">{houseCustomer.customer_name}</p>
                        <p className="text-xs text-aviva-gold font-medium mt-0.5">{houseCustomer.phone}</p>
                      </div>
                      <span className="text-[10px] bg-aviva-bg px-2 py-1 rounded-full text-aviva-secondary">
                        {({ Booking: "จอง", "Loan Process": "กำลังกู้", "Closed Deal": "โอนแล้ว" } as Record<string, string>)[houseCustomer.status] ?? houseCustomer.status}
                      </span>
                    </div>
                    {houseCustomer.loan_approved_date && (
                      <p className="text-[10px] text-green-400 mt-1.5">🏦 กู้ผ่านแล้ว {new Date(houseCustomer.loan_approved_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</p>
                    )}
                    {houseCustomer.delivery_date && (
                      <p className="text-[10px] text-aviva-gold mt-0.5">🏠 นัดส่งมอบ {new Date(houseCustomer.delivery_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                    )}
                    {houseCustomer.notes && (
                      <p className="text-[10px] text-aviva-secondary/70 mt-1.5 leading-relaxed line-clamp-2">{houseCustomer.notes}</p>
                    )}
                  </div>
                )}

                {loadingInst ? (
                  [1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-aviva-card/50 animate-pulse" />)
                ) : (
                  installments.map(inst => {
                    const tasks = instTasks.filter(t => t.installment_id === inst.id);
                    const doneCount = tasks.filter(t => t.is_complete).length;
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
                          <div className="mt-3 space-y-3 border-t border-aviva-gold/10 pt-3">
                            {inst.created_by_name && (
                              <p className="text-[10px] text-aviva-gold bg-aviva-gold/10 px-2 py-1 rounded-lg inline-block">ส่งตรวจโดย {inst.created_by_name}</p>
                            )}
                            {inst.contractor_ack_name && (
                              <p className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                                ✍ ผู้รับเหมารับทราบ: <span className="font-semibold">{inst.contractor_ack_name}</span>
                                {inst.contractor_acknowledged_at && (
                                  <span className="text-green-400/60 ml-1">({new Date(inst.contractor_acknowledged_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })})</span>
                                )}
                              </p>
                            )}
                            {inst.paid_by && (
                              <p className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                                💰 จ่ายโดย: <span className="font-semibold">{inst.paid_by}</span>
                                {inst.paid_at && (
                                  <span className="text-blue-400/60 ml-1">({new Date(inst.paid_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })})</span>
                                )}
                              </p>
                            )}
                            {inst.status === "paid" && (
                              <button onClick={() => printCertificate(inst)} className="flex items-center gap-1 text-[11px] text-green-400 border border-green-500/30 px-2 py-1.5 rounded-xl bg-green-500/5 hover:bg-green-500/10 transition-all">
                                <Printer size={11} /> ใบรับรองผลงาน
                              </button>
                            )}
                            {inst.status === "rejected" && inst.rejection_reason && (
                              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                                <div className="flex items-center justify-between mb-0.5">
                                  <p className="text-[10px] text-red-400 font-semibold">เหตุผลที่ปฏิเสธ</p>
                                  <button onClick={() => printRejectionNotice(inst)} className="flex items-center gap-1 text-[10px] text-red-400/80 border border-red-500/20 px-1.5 py-0.5 rounded-lg hover:bg-red-500/10">
                                    <Printer size={9} /> แจ้งผู้รับเหมา
                                  </button>
                                </div>
                                <p className="text-xs text-red-300">{inst.rejection_reason}</p>
                                {inst.rejection_count && inst.rejection_count > 0 && (
                                  <p className="text-[10px] text-red-400/70 mt-0.5">ถูกปฏิเสธ {inst.rejection_count} ครั้ง</p>
                                )}
                              </div>
                            )}
                            {user?.isAdmin && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-aviva-secondary">มูลค่างวด (บาท)</span>
                                  <input type="number" defaultValue={inst.amount}
                                    onBlur={async e => {
                                      const v = Number(e.target.value);
                                      if (!isNaN(v)) {
                                        await supabase.from("contractor_installments").update({ amount: v }).eq("id", inst.id);
                                        setInstallments(prev => prev.map(i => i.id === inst.id ? { ...i, amount: v } : i));
                                      }
                                    }}
                                    className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-xs text-aviva-text outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-[10px] text-aviva-secondary mb-0.5">ค่าแรง (บาท)</p>
                                    <input type="number" defaultValue={inst.labor_cost ?? 0}
                                      onBlur={async e => {
                                        const v = Number(e.target.value);
                                        if (!isNaN(v)) {
                                          await supabase.from("contractor_installments").update({ labor_cost: v }).eq("id", inst.id);
                                          setInstallments(prev => prev.map(i => i.id === inst.id ? { ...i, labor_cost: v } : i));
                                        }
                                      }}
                                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-xs text-aviva-text outline-none" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-aviva-secondary mb-0.5">ค่าวัสดุ (บาท)</p>
                                    <input type="number" defaultValue={inst.material_cost ?? 0}
                                      onBlur={async e => {
                                        const v = Number(e.target.value);
                                        if (!isNaN(v)) {
                                          await supabase.from("contractor_installments").update({ material_cost: v }).eq("id", inst.id);
                                          setInstallments(prev => prev.map(i => i.id === inst.id ? { ...i, material_cost: v } : i));
                                        }
                                      }}
                                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-xs text-aviva-text outline-none" />
                                  </div>
                                </div>
                              </div>
                            )}
                            {((inst.labor_cost ?? 0) > 0 || (inst.material_cost ?? 0) > 0) && (
                              <p className="text-[10px] text-aviva-secondary/70">ค่าแรง ฿{(inst.labor_cost ?? 0).toLocaleString("th-TH")} · ค่าวัสดุ ฿{(inst.material_cost ?? 0).toLocaleString("th-TH")}</p>
                            )}
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/inspection?id=${inst.id}`;
                                navigator.clipboard.writeText(url);
                              }}
                              className="w-full py-1.5 text-[11px] text-aviva-secondary border border-aviva-gold/20 rounded-xl bg-aviva-bg/50 hover:border-aviva-gold/40 flex items-center justify-center gap-1.5"
                            >
                              <FileText size={11} /> สร้างลิงก์ตรวจสอบ
                            </button>
                            <InspectionPanel
                              inst={inst}
                              inspections={inspections.filter(i => i.contractor_installment_id === inst.id)}
                              instTemplates={instTemplates}
                              instWorkItems={instWorkItems}
                              uploadingInsp={uploadingInsp}
                              savingInsp={savingInsp}
                              onEnsure={() => ensureInspections(inst)}
                              onSave={saveInspectionResult}
                              onUpload={uploadInspectionPhoto}
                            />
                            <div>
                              <AttachDocButton entityType="contractor_installment" entityId={inst.id} attachedBy={user?.full_name ?? ""} />
                            </div>
                            <div className="space-y-2 pt-1 border-t border-aviva-gold/10">
                              <p className="text-[10px] text-aviva-secondary/60 font-semibold uppercase tracking-wider pt-1">รายการงานย่อย</p>
                              {tasks.map(task => (
                                <div key={task.id} className="bg-aviva-bg/70 rounded-xl p-2.5 border border-aviva-gold/10 flex items-center gap-2">
                                  <button onClick={() => toggleTask(task)} className={clsx("w-5 h-5 rounded-md flex-shrink-0 border-2 flex items-center justify-center transition-all", task.is_complete ? "bg-green-500 border-green-500" : "border-aviva-gold/40")}>
                                    {task.is_complete && <Check size={10} className="text-white" />}
                                  </button>
                                  <span className={clsx("text-xs flex-1 text-left", task.is_complete ? "line-through text-aviva-secondary/50" : "text-aviva-text")}>{task.task_name}</span>
                                  <label className="cursor-pointer flex-shrink-0">
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadTaskPhoto(task, f); }} />
                                    {uploadingTask === task.id
                                      ? <Loader2 size={13} className="text-aviva-gold animate-spin" />
                                      : task.photo_url
                                        ? <img src={task.photo_url} alt="" className="w-7 h-7 rounded-lg object-cover border border-aviva-gold/20" />
                                        : <Camera size={13} className="text-aviva-secondary/40" />
                                    }
                                  </label>
                                  <button onClick={() => removeTask(task.id)} className="flex-shrink-0 text-aviva-secondary/30 hover:text-red-400 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="เพิ่มรายการงาน..."
                                  value={newTaskInputs[inst.id] ?? ""}
                                  onChange={e => setNewTaskInputs(prev => ({ ...prev, [inst.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter") addTask(inst, newTaskInputs[inst.id] ?? ""); }}
                                  className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/50"
                                />
                                <button onClick={() => addTask(inst, newTaskInputs[inst.id] ?? "")} className="px-3 py-2 bg-aviva-gold/20 text-aviva-gold rounded-xl border border-aviva-gold/30 active:bg-aviva-gold/40">
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>
                            {inst.status !== "paid" && (
                              <div className="space-y-2 pt-1">
                                {inst.status === "in_review" && user?.isManager ? (
                                  <div className="flex gap-2">
                                    <button onClick={() => doAdvanceInst(inst)} className="flex-1 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium">✓ อนุมัติ</button>
                                    <button onClick={() => { const reason = window.prompt("ระบุเหตุผลที่ปฏิเสธ:"); if (reason !== null) rejectInstallment(inst, reason); }} className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium">✗ ปฏิเสธ</button>
                                  </div>
                                ) : inst.status === "in_review" && !user?.isManager ? (
                                  <div className="w-full py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-xl text-xs text-center">รออนุมัติจากผู้จัดการ</div>
                                ) : inst.status !== "in_review" ? (
                                  <button onClick={() => advanceInstStatus(inst)} disabled={inst.status === "approved"}
                                    className={clsx("w-full py-2 rounded-xl text-xs font-medium border", inst.status === "pending" || inst.status === "rejected" ? "bg-aviva-gold/20 text-aviva-gold border-aviva-gold/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30")}>
                                    {inst.status === "pending" ? "ส่งตรวจสอบ" : inst.status === "rejected" ? "ส่งตรวจสอบอีกครั้ง" : "รออนุมัติจากระบบ"}
                                  </button>
                                ) : null}
                              </div>
                            )}
                            {inst.status !== "pending" && (
                              <div className="border-t border-aviva-gold/10 pt-2 mt-1">
                                <p className="text-[10px] font-semibold text-aviva-secondary/70 mb-1">ประวัติการส่งต่องาน</p>
                                <WorkflowTimeline sourceRecordId={inst.id} />
                              </div>
                            )}
                          </div>
                        )}
                      </GlassCard>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {part === "daily" && (
          <>
            <div className="flex gap-2">
              {(["reports", "defects"] as Tab[]).map(k => (
                <button key={k} onClick={() => setTab(k)} className={clsx("flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all", tab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10")}>
                  {k === "reports" ? `รายงาน (${reports.length})` : openDefects ? `Defects (${openDefects})` : "Defects"}
                </button>
              ))}
            </div>

            {tab === "reports" && (
              <div className="space-y-3">
                <PeriodFilter period={rptPeriod} onChange={(p, s, e) => { setRptPeriod(p); setRptStart(s); setRptEnd(e); }} />
                <div className="flex items-center justify-between">
                  <SectionHeader title="รายงานประจำวัน" subtitle="กรองตามช่วงเวลา" />
                  {reports.length > 0 && (
                    <button onClick={printDailyReport} className="flex items-center gap-1.5 text-[11px] text-aviva-gold border border-aviva-gold/30 px-2 py-1.5 rounded-xl"><Printer size={12} /> พิมพ์รายงาน</button>
                  )}
                </div>
                {reports.length === 0 ? (
                  <GlassCard className="p-8 text-center"><ClipboardList size={28} className="text-aviva-secondary/30 mx-auto mb-2" /><p className="text-aviva-secondary text-sm">ยังไม่มีข้อมูล</p></GlassCard>
                ) : reports.map(r => {
                  const house = houses.find(h => h.id === r.house_id);
                  return (
                    <GlassCard key={r.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-aviva-gold">{house ? houseLabel(house) : "—"}</span>
                            {r.work_type && <span className="text-[10px] bg-aviva-gold/10 text-aviva-gold/80 px-1.5 py-0.5 rounded-full">{r.work_type}</span>}
                            <span className="text-[10px] text-aviva-secondary">{new Date(r.created_at).toLocaleDateString("th-TH")} {new Date(r.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-sm text-aviva-text mt-0.5">{r.work_detail}</p>
                          {r.reported_by && <p className="text-[10px] text-aviva-secondary mt-0.5">โดย: {r.reported_by}</p>}
                          {r.issue && <p className="text-xs text-red-400 mt-0.5">⚠ {r.issue}</p>}
                          {r.photo_url && (
                            <a href={r.photo_url} target="_blank" rel="noreferrer" className="mt-2 block">
                              <img src={r.photo_url} alt="รูปตรวจงาน" className="w-full max-w-[160px] h-24 rounded-xl object-cover border border-aviva-gold/20" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={e => openEditReport(r, e)} className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/10 hover:border-aviva-gold/40 transition-all"><Pencil size={12} className="text-aviva-secondary" /></button>
                          <div className="text-right"><p className="text-lg font-bold text-aviva-gold">{r.progress}%</p><p className="text-[10px] text-aviva-secondary">ความคืบหน้า</p></div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
                {!loading && reports.length >= rptLimit && (
                  <button onClick={() => { const next = rptLimit + 50; setRptLimit(next); fetchData(next); }} className="w-full py-2.5 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-card hover:border-aviva-gold/30 transition-all">โหลดเพิ่มเติม (แสดง {rptLimit} รายการแล้ว)</button>
                )}
              </div>
            )}

            {tab === "defects" && (
              <div className="space-y-3">
                <SectionHeader title="Defect Tracking" subtitle="ปัญหาที่ตรวจพบ" />
                {defects.length === 0 ? (
                  <GlassCard className="p-8 text-center"><Bug size={28} className="text-aviva-secondary/30 mx-auto mb-2" /><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ Defect</p></GlassCard>
                ) : defects.map(d => {
                  const house = houses.find(h => h.id === d.house_id);
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
                            <span className="text-xs font-bold text-aviva-gold">{house ? houseLabel(house) : "—"}</span>
                            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{d.defect_category}</span>
                            <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full", sev.color)}>{sev.label}</span>
                            {daysOpen !== null && daysOpen > 7 && <span className="text-[10px] text-red-400 font-bold">⚠ {daysOpen} วัน</span>}
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
                            <button onClick={() => updateDefectStatus(d.defect_id, "In Progress")} className="flex-1 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-[10px] font-medium">เริ่มแก้ไข</button>
                          )}
                          <button onClick={() => updateDefectStatus(d.defect_id, "Resolved")} className="flex-1 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-[10px] font-medium">แก้ไขแล้ว</button>
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </>
        )}

        {part === "purchase" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionHeader title={`ใบขอสั่งซื้อ (${purchaseOrders.length})`} subtitle="ขออนุมัติจัดซื้อวัสดุ-อุปกรณ์" />
              <button onClick={() => setShowPRModal(true)}
                className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
                <Plus size={14} /> ขอสั่งซื้อ
              </button>
            </div>
            {purchaseOrders.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <ShoppingCart size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีใบขอสั่งซื้อ</p>
                <p className="text-xs text-aviva-secondary/60 mt-1">กด &quot;ขอสั่งซื้อ&quot; เพื่อส่งขออนุมัติ</p>
              </GlassCard>
            ) : purchaseOrders.map(po => {
              const poStatusConfig: Record<string, { label: string; color: string }> = {
                pending:  { label: "รออนุมัติ",   color: "bg-yellow-500/20 text-yellow-400" },
                approved: { label: "อนุมัติแล้ว",  color: "bg-green-500/20 text-green-400" },
                rejected: { label: "ถูกปฏิเสธ",   color: "bg-red-500/20 text-red-400" },
                draft:    { label: "ร่าง",          color: "bg-gray-500/20 text-gray-400" },
              };
              const sc = poStatusConfig[po.status] ?? poStatusConfig.draft;
              const items = (po.items ?? []) as { name: string; qty: number; unit: string; unit_price: number }[];
              return (
                <GlassCard key={po.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-aviva-gold font-mono">{po.po_number ?? "—"}</span>
                        <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium", sc.color)}>{sc.label}</span>
                      </div>
                      <p className="text-sm text-aviva-text mt-0.5">จากบริษัท: {po.supplier_name}</p>
                      {po.requested_by && <p className="text-[10px] text-aviva-secondary mt-0.5">ขอโดย: {po.requested_by}</p>}
                      <p className="text-[10px] text-aviva-secondary/60">{new Date(po.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    {po.total_amount != null && po.total_amount > 0 && (
                      <p className="text-sm font-bold text-aviva-gold flex-shrink-0">฿{Number(po.total_amount).toLocaleString("th-TH")}</p>
                    )}
                  </div>
                  {items.length > 0 && (
                    <div className="bg-aviva-bg/50 rounded-xl p-2.5 space-y-1">
                      {items.map((it, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-aviva-text flex-1 truncate">{it.name}</span>
                          <span className="text-aviva-secondary">{it.qty} {it.unit}</span>
                          {it.unit_price > 0 && <span className="text-aviva-gold font-medium">฿{(it.qty * it.unit_price).toLocaleString("th-TH")}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {po.notes && <p className="text-[10px] text-aviva-secondary/70 leading-relaxed">{po.notes}</p>}
                  {po.status === "approved" && po.approved_by && (
                    <p className="text-[10px] text-green-400">✓ อนุมัติโดย {po.approved_by}</p>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">สรุปรายงานประจำวัน</h2>
                <p className="text-[11px] text-aviva-secondary mt-0.5">รวบรวมงานทั้งวัน — แก้ไขได้ก่อนส่ง/พิมพ์</p>
              </div>
              <button onClick={() => setShowSummaryModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่รายงาน</label>
                <input type="date" value={summaryForm.date} onChange={e => setSummaryForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้จัดทำรายงาน</label>
                <input type="text" value={summaryForm.reporter} onChange={e => setSummaryForm(p => ({ ...p, reporter: e.target.value }))}
                  placeholder="ชื่อวิศวกร / หัวหน้าทีม"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
              </div>
            </div>
            <div className="bg-aviva-gold/5 border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-xs text-aviva-secondary flex gap-4">
              <span className="text-aviva-gold font-semibold">ภาพรวมวันนี้</span>
              <span>ยูนิต: <strong className="text-aviva-text">{houses.length}</strong></span>
              <span>คืบหน้า: <strong className="text-aviva-gold">{overallProgress}%</strong></span>
              <span>Defect: <strong className={defects.filter(d => d.status === "Open").length > 0 ? "text-red-400" : "text-green-400"}>{defects.filter(d => d.status === "Open").length}</strong></span>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-aviva-secondary/70 mb-1 block uppercase tracking-wider">งานตรวจผู้รับเหมา</label>
              <textarea value={summaryForm.contractor_summary}
                onChange={e => setSummaryForm(p => ({ ...p, contractor_summary: e.target.value }))}
                rows={4}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50 resize-none leading-relaxed" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-aviva-secondary/70 mb-1 block uppercase tracking-wider">งานรายวัน</label>
              <textarea value={summaryForm.daily_summary}
                onChange={e => setSummaryForm(p => ({ ...p, daily_summary: e.target.value }))}
                rows={4}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50 resize-none leading-relaxed" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-aviva-secondary/70 mb-1 block uppercase tracking-wider">ปัญหา / ข้อสังเกตพิเศษ</label>
              <textarea value={summaryForm.problems}
                onChange={e => setSummaryForm(p => ({ ...p, problems: e.target.value }))}
                rows={3}
                placeholder="ระบุปัญหาเพิ่มเติม หรือข้อสังเกตสำหรับผู้บริหาร..."
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-xs text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/50 resize-none leading-relaxed" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-aviva-secondary/70 mb-1 block uppercase tracking-wider">แนบรูปภาพเพิ่มเติม</label>
              <label className="cursor-pointer flex items-center gap-3 w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 hover:border-aviva-gold/40 transition-all">
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setSummaryPhoto(f); setSummaryPhotoPreview(URL.createObjectURL(f)); } }} />
                <Camera size={15} className="text-aviva-secondary/60 flex-shrink-0" />
                <span className="text-xs text-aviva-secondary/60 flex-1">{summaryPhoto ? summaryPhoto.name : "ถ่ายรูป / เลือกจากคลัง"}</span>
                {summaryPhotoPreview && (
                  <img src={summaryPhotoPreview} alt="preview" className="w-14 h-14 rounded-lg object-cover border border-aviva-gold/20 flex-shrink-0" />
                )}
              </label>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={printSummaryReport}
                className="flex-1 py-3 flex items-center justify-center gap-2 border border-aviva-gold/30 text-aviva-gold rounded-xl text-sm font-medium hover:bg-aviva-gold/5 transition-all">
                <Printer size={14} /> พิมพ์รายงาน
              </button>
              <button onClick={submitSummaryReport}
                disabled={sendingSummary || uploadingSummaryPhoto}
                className="flex-1 py-3 bg-aviva-gold text-aviva-bg font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {sendingSummary || uploadingSummaryPhoto ? <><Loader2 size={14} className="animate-spin" /> กำลังส่ง...</> : <><Send size={14} /> ส่งรายงาน</>}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <select value={defectForm.house_id} onChange={e => setDefectForm({ ...defectForm, house_id: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">-- เลือกยูนิต --</option>
                    {houses.map(h => <option key={h.id} value={h.id}>{houseLabel(h)}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ประเภทปัญหา</label>
                <select value={defectForm.defect_category} onChange={e => setDefectForm({ ...defectForm, defect_category: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {DEFECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                <textarea value={defectForm.description} onChange={e => setDefectForm({ ...defectForm, description: e.target.value })} placeholder="อธิบายปัญหาที่พบ..." rows={3} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความรุนแรง</label>
                  <select value={defectForm.severity} onChange={e => setDefectForm({ ...defectForm, severity: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="low">เล็กน้อย</option><option value="medium">ปานกลาง</option><option value="high">สูง</option><option value="critical">วิกฤต</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">กำหนดแก้ไขภายใน</label>
                  <input type="date" value={defectForm.due_date} onChange={e => setDefectForm({ ...defectForm, due_date: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">งวดงานที่เกี่ยวข้อง</label>
                <select value={defectForm.installment_no} onChange={e => setDefectForm({ ...defectForm, installment_no: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="">— ไม่ระบุ —</option>
                  {INSTALLMENT_NAMES.map((n, i) => <option key={i + 1} value={String(i + 1)}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">มอบหมายให้</label>
                <input type="text" value={defectForm.assigned_to} onChange={e => setDefectForm({ ...defectForm, assigned_to: e.target.value })} placeholder="ชื่อผู้รับผิดชอบหรือผู้รับเหมา" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handleSaveDefect} disabled={saving || !defectForm.description || (!defectHouse && !defectForm.house_id)} className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึก Defect"}</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">{editingReport ? "แก้ไขรายงาน" : selectedHouse ? `บันทึกรายงาน — ${selectedHouse.house_number}` : "บันทึกรายงานประจำวัน"}</h2>
              <button onClick={() => { setShowModal(false); setEditingReport(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              {!selectedHouse && !editingReport && (
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เลือกยูนิต *</label>
                  <select value={form.house_id} onChange={e => setForm({ ...form, house_id: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">-- เลือกยูนิต --</option>
                    {houses.map(h => <option key={h.id} value={h.id}>{houseLabel(h)} ({h.progress}%)</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ประเภทงาน</label>
                <select value={form.work_type} onChange={e => setForm({ ...form, work_type: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {WORK_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">งานที่ทำวันนี้ *</label>
                <textarea value={form.work_detail} onChange={e => setForm({ ...form, work_detail: e.target.value })} placeholder="อธิบายงานที่ดำเนินการ..." rows={3} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความคืบหน้า</label>
                  <select value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">-- เลือก --</option>
                    {[10,20,30,40,50,60,70,80,90,100].map(p => <option key={p} value={String(p)}>{p}%</option>)}
                  </select>
                </div>
                {!editingReport && (
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                    <select value={form.new_status} onChange={e => setForm({ ...form, new_status: e.target.value as HouseStatus })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                      <option value="on-track">ตามแผน</option><option value="delayed">ล่าช้า</option><option value="complete">เสร็จแล้ว</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้จัดทำรายงาน</label>
                <input type="text" value={form.reported_by} onChange={e => setForm({ ...form, reported_by: e.target.value })} list="reporter-list" placeholder="ชื่อวิศวกร / ช่างควบคุมงาน" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                <datalist id="reporter-list">{reporterNames.map(name => <option key={name} value={name} />)}</datalist>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ปัญหา / ข้อสังเกต</label>
                <input type="text" value={form.issue} onChange={e => setForm({ ...form, issue: e.target.value })} placeholder="ถ้าไม่มีปัญหาให้เว้นว่าง" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">แนบรูปภาพการตรวจงาน</label>
                <label className="cursor-pointer flex items-center gap-3 w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3">
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setDailyPhoto(f); setDailyPhotoPreview(URL.createObjectURL(f)); } }} />
                  {uploadingDailyPhoto ? <Loader2 size={16} className="text-aviva-gold animate-spin" /> : <Camera size={16} className="text-aviva-secondary/60" />}
                  <span className="text-sm text-aviva-secondary/60 flex-1">{dailyPhoto ? dailyPhoto.name : "ถ่ายรูป / เลือกจากคลัง"}</span>
                  {dailyPhotoPreview && <img src={dailyPhotoPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-aviva-gold/20" />}
                </label>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || uploadingDailyPhoto || !form.work_detail || (!selectedHouse && !editingReport && !form.house_id)} className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">{saving || uploadingDailyPhoto ? "กำลังบันทึก..." : editingReport ? "บันทึกการแก้ไข" : "บันทึกรายงาน"}</button>
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
                  <input type="text" value={houseForm.house_number} onChange={e => setHouseForm({ ...houseForm, house_number: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                  <select value={houseForm.status} onChange={e => setHouseForm({ ...houseForm, status: e.target.value as HouseStatus })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="on-track">ตามแผน</option><option value="delayed">ล่าช้า</option><option value="complete">เสร็จแล้ว</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้รับเหมา</label>
                <input type="text" value={houseForm.contractor} onChange={e => setHouseForm({ ...houseForm, contractor: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เฟส / ขั้นตอน</label>
                <input type="text" value={houseForm.phase} onChange={e => setHouseForm({ ...houseForm, phase: e.target.value })} placeholder="เช่น งานโครงสร้าง" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความคืบหน้า (%)</label>
                  <input type="number" min="0" max="100" value={houseForm.progress} onChange={e => setHouseForm({ ...houseForm, progress: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ล่าช้า (วัน)</label>
                  <input type="number" min="0" value={houseForm.delayed_days} onChange={e => setHouseForm({ ...houseForm, delayed_days: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">กำหนดเสร็จ</label>
                  <input type="date" value={houseForm.planned_completion_date} onChange={e => setHouseForm({ ...houseForm, planned_completion_date: e.target.value })} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">วิศวกร/ช่างควบคุม</label>
                  <input type="text" value={houseForm.site_engineer} onChange={e => setHouseForm({ ...houseForm, site_engineer: e.target.value })} placeholder="ชื่อวิศวกรประจำยูนิต" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
            </div>
            <button onClick={handleSaveHouse} disabled={saving} className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</button>
          </div>
        </div>
      )}

      {showAckModal && ackInst && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-aviva-text">ผู้รับเหมาลงชื่อรับทราบ</h2>
                <p className="text-xs text-aviva-secondary mt-0.5">{ackInst.name} — {instHouse?.house_number}</p>
              </div>
              <button onClick={() => { setShowAckModal(false); setAckInst(null); setAckName(""); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="bg-aviva-gold/5 border border-aviva-gold/20 rounded-xl p-3 space-y-1 text-[11px] text-aviva-secondary">
              <p className="font-semibold text-aviva-gold mb-1">ผลการตรวจงาน</p>
              {(() => {
                const instInsps = inspections.filter(i => i.contractor_installment_id === ackInst.id);
                const pass = instInsps.filter(i => i.result === "pass").length;
                const total = instInsps.length;
                return total > 0
                  ? <p>ผ่าน <span className="text-green-400 font-bold">{pass}</span> / {total} รายการ {pass === total ? "✓ ครบทุกรายการ" : ""}</p>
                  : <p className="text-aviva-secondary/60">ยังไม่มีรายการตรวจ</p>;
              })()}
              <p>มูลค่างวด: <span className="text-aviva-gold font-semibold">฿{ackInst.amount.toLocaleString("th-TH")}</span></p>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1.5 block font-medium">ชื่อผู้รับเหมา (ลงชื่อรับทราบผลการตรวจ) *</label>
              <input
                type="text"
                value={ackName}
                onChange={e => setAckName(e.target.value)}
                placeholder="กรอกชื่อ-นามสกุลผู้รับเหมา"
                className="w-full bg-aviva-bg border border-aviva-gold/30 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/70"
              />
              <p className="text-[10px] text-aviva-secondary/60 mt-1">การกรอกชื่อและกด &quot;ยืนยันและส่งตรวจสอบ&quot; ถือเป็นการลงชื่อรับทราบผลการตรวจงานของผู้รับเหมา</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowAckModal(false); setAckInst(null); setAckName(""); }} className="flex-1 py-3 rounded-xl border border-aviva-gold/20 text-aviva-secondary text-sm">ยกเลิก</button>
              <button onClick={handleAckAndSubmit} disabled={!ackName.trim()} className="flex-1 py-3 rounded-xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">ยืนยันและส่งตรวจสอบ</button>
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

      {showPRModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">ใบขอสั่งซื้อ</h2>
                <p className="text-[11px] text-aviva-secondary mt-0.5">Purchase Request — ฝ่ายก่อสร้าง</p>
              </div>
              <button onClick={() => setShowPRModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ผู้จัดจำหน่าย / บริษัทที่สั่งซื้อ *</label>
              <input type="text" value={prForm.supplier_name} onChange={e => setPrForm(p => ({ ...p, supplier_name: e.target.value }))}
                placeholder="ชื่อร้านค้า / บริษัท"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-aviva-secondary font-medium">รายการสั่งซื้อ *</label>
                <button onClick={() => setPrItems(p => [...p, { name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }])}
                  className="flex items-center gap-1 text-[11px] text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg bg-aviva-gold/5 hover:bg-aviva-gold/10 transition-all">
                  <Plus size={11} /> เพิ่มรายการ
                </button>
              </div>
              <div className="space-y-2">
                {prItems.map((it, i) => (
                  <div key={i} className="bg-aviva-bg/60 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <input type="text" placeholder="ชื่อวัสดุ/อุปกรณ์ *" value={it.name}
                        onChange={e => setPrItems(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/50" />
                      {prItems.length > 1 && (
                        <button onClick={() => setPrItems(p => p.filter((_, j) => j !== i))} className="text-red-400/60 hover:text-red-400 p-1 transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[9px] text-aviva-secondary mb-1">จำนวน</p>
                        <input type="number" min="1" value={it.qty}
                          onChange={e => setPrItems(p => p.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                          className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                      </div>
                      <div>
                        <p className="text-[9px] text-aviva-secondary mb-1">หน่วย</p>
                        <input type="text" value={it.unit}
                          onChange={e => setPrItems(p => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}
                          className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                      </div>
                      <div>
                        <p className="text-[9px] text-aviva-secondary mb-1">ราคา/หน่วย</p>
                        <input type="number" min="0" value={it.unit_price}
                          onChange={e => setPrItems(p => p.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))}
                          className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                      </div>
                    </div>
                    {Number(it.qty) > 0 && Number(it.unit_price) > 0 && (
                      <p className="text-[11px] text-aviva-gold text-right">รวม: ฿{(Number(it.qty) * Number(it.unit_price)).toLocaleString("th-TH")}</p>
                    )}
                  </div>
                ))}
              </div>
              {prItems.some(it => it.name.trim() && Number(it.unit_price) > 0) && (
                <div className="flex justify-between items-center mt-2 px-1">
                  <span className="text-xs text-aviva-secondary">มูลค่ารวมทั้งสิ้น</span>
                  <span className="text-sm font-bold text-aviva-gold">
                    ฿{prItems.filter(it => it.name.trim()).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0).toLocaleString("th-TH")}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ / เหตุผลที่ต้องการสั่งซื้อ</label>
              <textarea value={prForm.notes} onChange={e => setPrForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="อธิบายความจำเป็นและการใช้งาน..."
                rows={3}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
            </div>
            <div className="bg-aviva-gold/5 border border-aviva-gold/20 rounded-xl p-3 text-[11px] text-aviva-secondary space-y-0.5">
              <p>ผู้ขอ: <span className="text-aviva-text font-medium">{user?.full_name ?? user?.email ?? "—"}</span></p>
              <p>หลังส่งคำขอ ผู้จัดการจะได้รับแจ้งเตือนเพื่ออนุมัติในหน้า &quot;ระบบอนุมัติ&quot;</p>
            </div>
            <button onClick={handleSubmitPR}
              disabled={savingPR || !prForm.supplier_name || !prItems.some(it => it.name.trim())}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {savingPR ? <><Loader2 size={14} className="animate-spin" /> กำลังส่ง...</> : <><ShoppingCart size={14} /> ส่งขออนุมัติ</>}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}