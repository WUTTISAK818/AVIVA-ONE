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
  return `แปลงที่ ${h.plot_number ?? "—"} / ที่ดิน ${h.land_size ?? "—"} ตร.วา. / ${h.house_model ?? "AVA"}`;
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