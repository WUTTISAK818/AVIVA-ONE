"use client";
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, X, Clock, ClipboardCheck,
  Receipt, FileText, Users, Phone, Briefcase, AlertCircle, Megaphone,
  Sparkles, Wrench, CheckCircle, AlertTriangle, Star, Download,
  XCircle, ShieldAlert, Package, Printer, ChevronDown, ChevronUp,
  FolderOpen, Upload, Search, Home, BookOpen, Pencil, ShoppingCart, Paperclip,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { downloadCsv } from "@/lib/export-csv";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import AttachDocButton from "@/components/AttachDocButton";
import { renderDocShell, renderItemsTable, esc, type DocTemplate } from "@/lib/doc-templates";
import { supabase } from "@/lib/supabase";
import { postJv, yymm } from "@/lib/jv";
import { logAction } from "@/lib/audit";
import { attachDocumentToEntity } from "@/lib/doc-attach";
import { useCurrentUser } from "@/lib/user-context";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import { createNotification } from "@/lib/notify";
import { loadMySwaps, loadPendingSwaps, requestSwap, decideSwap, thDate as thSwapDate, type OffDaySwap } from "@/lib/off-day-swaps";
import Toast, { type ToastType } from "@/components/Toast";
import { parseAmount, parseAmountOrZero, AMOUNT_ERROR } from "@/lib/money";
import { thaiDbError } from "@/lib/db-errors";
import { uploadFailText } from "@/lib/upload-photos";
import { MATERIAL_CATEGORIES, DEFAULT_MATERIAL_CATEGORY } from "@/lib/material-categories";
import DeptAIChat from "@/components/DeptAIChat";
import DeptBriefingPanel from "@/components/DeptBriefingPanel";
import { generateDocNumber } from "@/lib/doc-numbers";
import { uploadPhotos } from "@/lib/upload-photos";
import MultiPhotoInput from "@/components/MultiPhotoInput";
import { createLeaveRequest } from "@/lib/work-actions";
import { resolveApprovalQueue, closeWorkQueue } from "@/lib/workflow-events";
import { finalizeSale } from "@/lib/sales-finalize";
import { broadcastCelebration } from "@/lib/celebrate";
import { SLA_DAYS, calcSlaDueAt, APPR_LABEL, APPR_DEPT, summarizeApproval } from "@/lib/approval-matrix";
import ApprovalRouteBar from "@/components/ApprovalRouteBar";
import ApprovalVerifyModal, { type VerifyLog } from "@/components/ApprovalVerifyModal";
import PettyCashPanel from "@/components/PettyCashPanel";
import PurchaseRequestPanel from "@/components/PurchaseRequestPanel";
import { useFocusHighlight } from "@/lib/use-focus-highlight";
import RecurringExpensePanel from "@/components/RecurringExpensePanel";
import { expenseAccountFor, revenueAccountFor, categoryFromDescription, calcTax, calcContractorPay, CASH, BANK, INPUT_VAT, WHT_PAYABLE, RETENTION_PAYABLE, WIP, DEFAULT_CONTRACTOR_WHT, DEFAULT_RETENTION } from "@/lib/gl-accounts";
import { thaiDateStr } from "@/lib/thai-date";
import dynamic from "next/dynamic";
import { thaiMonthStr } from "@/lib/thai-date";

// แผงการเงินสองตัวนี้ใช้ recharts และอยู่ในแท็บเฉพาะ — โหลดตอนเปิดแท็บจริงเท่านั้น
export const loadingPanel = () => <p className="text-xs text-aviva-secondary/60 py-6 text-center">กำลังโหลด…</p>;
export const ProfitabilityPanel = dynamic(() => import("@/components/ProfitabilityPanel"), { ssr: false, loading: loadingPanel });
export const FinancialStatementsPanel = dynamic(() => import("@/components/FinancialStatementsPanel"), { ssr: false, loading: loadingPanel });

export type OfficeTab = "finance" | "accounting" | "marketing" | "hr" | "after-sales" | "approvals" | "materials" | "community" | "documents" | "commands" | "audit";

export const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// สิทธิวันลาต่อปี (ตาม พ.ร.บ.คุ้มครองแรงงาน) สำหรับติดตามโควต้า
export const LEAVE_QUOTA: Record<string, number> = { "ลาป่วย": 30, "ลากิจ": 3, "ลาพักร้อน": 6, "ลาคลอด": 98 };
export function leaveDays(from: string, to: string) {
  const d = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  return d > 0 ? d : 1;
}
export const today = thaiDateStr();

// ─── Shared formatters ──────────────────────────────────────────────────────────────────────────────────

export function formatM(n: number) {
  return `฿${Math.abs(n).toLocaleString("th-TH")}`;
}

export function formatThb(n: number) {
  return n.toLocaleString("th-TH");
}

// ─── Construction Payment Interfaces ─────────────────────────────────────────────────────

export interface ContractorInstallmentPay {
  id: string;
  installment_no: number;
  name: string;
  amount: number;
  status: string;
  house_id: string;
  house_number?: string;
  contractor_ack_name?: string | null;
  labor_cost?: number | null;
  material_cost?: number | null;
}

// รายการจ่ายงวดก่อสร้าง — อ่านจาก jv_entries (แหล่งบัญชีเดียว ไม่ใช้ accounting_entries ซ้อนอีก)
export interface ConstructionJv {
  id: string;
  jv_number: string;
  jv_date: string;
  description: string;
  ref_number: string | null;
  total_debit: number;
  lines?: { account_code: string; account_name: string; debit: number; credit: number }[];
}

// ─── Finance ──────────────────────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
}

export interface Approval {
  id: string;
  description: string;
  amount: number;
  status: string;
  requested_by: string;
  created_at: string;
}

export const FINANCE_CATEGORIES = ["ค่าก่อสร้าง", "ค่าวัสดุ", "ค่าการตลาด", "เงินเดือน", "ค่าดำเนินการ", "ค่าใช้จ่ายสำนักงาน", "ซ่อมบำรุงสำนักงาน", "สวัสดิการ/ต้อนรับลูกค้า", "รายรับจากการขาย", "อื่นๆ"];

export const emptyFinanceForm = {
  transaction_type: "expense",
  amount: "",
  description: "",
  category: "ค่าก่อสร้าง",
  cost_center: "",
  vat_included: false,   // ยอดที่กรอกรวม VAT 7% แล้วหรือไม่ (มีใบกำกับภาษี)
  wht_rate: "0",         // อัตราภาษีหัก ณ ที่จ่าย (%)
};

// เก็บร่างฟอร์มลง localStorage อัตโนมัติ — เน็ตหลุด/เผลอปิดหน้า ข้อความที่พิมพ์ไม่หาย
// (มาตรฐานทีม docs/QA-STANDARD.md ส่วน D) · เคลียร์ร่างเมื่อบันทึกสำเร็จด้วย clearFormDraft
export function useFormDraft<T extends object>(key: string, form: T, setForm: (f: T) => void, active: boolean) {
  const restored = useRef(false);
  useEffect(() => {
    if (!active) { restored.current = false; return; }
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setForm({ ...form, ...JSON.parse(raw) });
    } catch { /* ร่างเสีย → เริ่มใหม่ */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);
  useEffect(() => {
    if (!active || !restored.current) return;
    try { localStorage.setItem(key, JSON.stringify(form)); } catch { /* storage เต็ม/ถูกปิดกั้น → ข้าม */ }
  }, [form, active, key]);
}
export function clearFormDraft(key: string) {
  try { localStorage.removeItem(key); } catch { /* ข้าม */ }
}


// ─── Accounting ───────────────────────────────────────────────────────────────

export interface ReceiptRow {
  id: string;
  receipt_number: string;
  receipt_date: string;
  vendor_name: string;
  description: string;
  amount: number;
  category: string;
  receipt_type: string;
  created_at: string;
}

export const ACCOUNTING_CATEGORIES = ["วัสดุก่อสร้าง", "ค่าแรง", "ค่าสาธารณูปโภค", "ค่าอุปกรณ์สำนักงาน", "ค่าการตลาด", "ค่าขนส่ง", "อื่นๆ"];

export const emptyReceiptForm = {
  receipt_date: today,
  vendor_name: "",
  description: "",
  amount: "",
  category: "วัสดุก่อสร้าง",
  receipt_type: "expense",
  receipt_number: "",
};

// โหมด A — ใบสำคัญลงบัญชี (JV voucher) จากรายการบัญชีก่อสร้าง
export function jvTemplates(e: ConstructionJv): DocTemplate[] {
  return [{
    key: "jv", label: "ใบสำคัญลงบัญชี (JV)", docType: "jv_voucher",
    fixedNumber: e.jv_number ?? undefined,
    render: (docNumber) => {
      const amt = e.total_debit ?? 0;
      // ใช้บรรทัดบัญชีจริงจาก jv_lines ถ้ามี (ครบทุกบรรทัด) มิฉะนั้น fallback แบบเดิม
      const lineRows = (e.lines && e.lines.length > 0)
        ? e.lines.map(l => [l.account_code, l.account_name, l.debit, l.credit] as (string | number)[])
        : [
          ["2100", "เจ้าหนี้ผู้รับเหมา", amt, 0],
          ["1120", "เงินฝากธนาคาร", 0, amt],
        ];
      const body = `
        <table><tbody>
          <tr><th style="width:28%">วันที่</th><td>${esc(e.jv_date)}</td></tr>
          <tr><th>รายการ</th><td>${esc(e.description)}</td></tr>
          ${e.ref_number ? `<tr><th>อ้างอิง</th><td>${esc(e.ref_number)}</td></tr>` : ""}
        </tbody></table>
        ${renderItemsTable(["รหัสบัญชี", "ชื่อบัญชี", "เดบิต", "เครดิต"], lineRows)}
        <table class="totals"><tbody>
          <tr><td style="text-align:right">รวมเดบิต</td><td style="text-align:right;font-weight:700">${amt.toLocaleString()} บาท</td></tr>
        </tbody></table>`;
      return renderDocShell({ title: "ใบสำคัญลงบัญชี", docNumber, bodyHtml: body, signLabels: ["ผู้จัดทำ", "ผู้ตรวจสอบ", "ผู้อนุมัติ"] });
    },
  }];
}

// โหมด A — ใบเสร็จรับเงิน / ใบสำคัญจ่าย จากบิล/ใบเสร็จ
export function receiptTemplates(r: ReceiptRow): DocTemplate[] {
  const isExpense = r.receipt_type === "expense";
  const title = isExpense ? "ใบสำคัญจ่าย" : "ใบเสร็จรับเงิน";
  return [{
    key: "receipt", label: title, docType: isExpense ? "payment_voucher" : "receipt",
    fixedNumber: r.receipt_number ?? undefined,
    render: (docNumber) => {
      const body = `
        <table><tbody>
          <tr><th style="width:28%">${isExpense ? "ผู้รับเงิน / ผู้ขาย" : "ได้รับเงินจาก"}</th><td>${esc(r.vendor_name)}</td></tr>
          <tr><th>หมวด</th><td>${esc(r.category)}</td></tr>
          ${r.description ? `<tr><th>รายละเอียด</th><td>${esc(r.description)}</td></tr>` : ""}
          <tr><th>วันที่</th><td>${esc(r.receipt_date)}</td></tr>
        </tbody></table>
        <table class="totals"><tbody>
          <tr><td style="text-align:right">จำนวนเงิน</td><td style="text-align:right;font-weight:700">${(r.amount ?? 0).toLocaleString()} บาท</td></tr>
        </tbody></table>`;
      return renderDocShell({ title, docNumber, bodyHtml: body, signLabels: isExpense ? ["ผู้จ่ายเงิน", "ผู้รับเงิน"] : ["ผู้รับเงิน"] });
    },
  }];
}

// โหมด A — ใบขออนุมัติจ่ายเงิน จากคำขออนุมัติ (การเงิน)
export function approvalTemplates(ap: Approval): DocTemplate[] {
  return [{
    key: "approval", label: "ใบขออนุมัติจ่าย", docType: "payment_approval", prefix: "FIN",
    render: (docNumber) => {
      const body = `
        <table><tbody>
          <tr><th style="width:28%">ผู้ขออนุมัติ</th><td>${esc(ap.requested_by)}</td></tr>
          <tr><th>รายละเอียด</th><td>${esc(ap.description)}</td></tr>
          <tr><th>จำนวนเงินที่ขอ</th><td>${(ap.amount ?? 0).toLocaleString()} บาท</td></tr>
        </tbody></table>`;
      return renderDocShell({ title: "ใบขออนุมัติจ่ายเงิน", docNumber, bodyHtml: body, signLabels: ["ผู้ขออนุมัติ", "ผู้จัดการ", "ผู้บริหาร"] });
    },
  }];
}

// โหมด A — ใบลา จากคำขอลา (บุคคล)
export function leaveTemplates(l: { employee_name: string; leave_type: string; date_from: string; date_to: string; reason: string }): DocTemplate[] {
  return [{
    key: "leave", label: "ใบลา", docType: "leave_form", prefix: "LEAVE",
    render: (docNumber) => {
      const body = `
        <table><tbody>
          <tr><th style="width:28%">ชื่อผู้ลา</th><td>${esc(l.employee_name)}</td></tr>
          <tr><th>ประเภทการลา</th><td>${esc(l.leave_type)}</td></tr>
          <tr><th>ตั้งแต่วันที่</th><td>${esc(l.date_from)} ถึง ${esc(l.date_to)}</td></tr>
          <tr><th>เหตุผล</th><td>${esc(l.reason || "-")}</td></tr>
        </tbody></table>`;
      return renderDocShell({ title: "ใบลา", docNumber, bodyHtml: body, signLabels: ["ผู้ลา", "ผู้บังคับบัญชา", "ฝ่ายบุคคล"] });
    },
  }];
}


// ─── Marketing ────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  platform: string;
  budget: number;
  spent: number;
  leads_generated: number;
  impressions: number;
  clicks: number;
  conversions: number;
  status: string;
  executive_name?: string;
  campaign_link?: string;
}

export interface MarketingBudget {
  id: string;
  year: number;
  month: number;
  budget_amount: number;
  executive_name: string;
  notes: string;
}

export const platformStyle: Record<string, { color: string; bg: string }> = {
  Facebook: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  TikTok:   { color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  Google:   { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
};

export const statusStyle: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  ended:  "bg-gray-500/20 text-gray-400",
};

export const statusLabel: Record<string, string> = {
  active: "กำลังทำงาน",
  paused: "หยุดชั่วคราว",
  ended:  "สิ้นสุดแล้ว",
};

export function roi(campaign: Campaign, avgPrice = 9_500_000) {
  const revenue = campaign.conversions * avgPrice;
  return campaign.spent > 0 ? Math.round((revenue / campaign.spent) * 100) : 0;
}

export function cpl(campaign: Campaign) {
  return campaign.leads_generated > 0
    ? Math.round(campaign.spent / campaign.leads_generated).toLocaleString()
    : "—";
}

export const emptyCampaignForm = { name: "", platform: "Facebook", budget: "", start_date: "", end_date: "", executive_name: "", campaign_link: "" };

export const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];


// ─── HR ───────────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  employee_code?: string;
  full_name: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  position: string;
  base_salary: number;
  commission_rate: number;
  start_date: string;
  status: string;
  weekly_off_day: number | null;
}

export const WEEKLY_OFF_OPTIONS = [['อา', 0], ['จ', 1], ['อ', 2], ['พ', 3], ['พฤ', 4], ['ศ', 5], ['ส', 6]] as const;

export const DEPARTMENTS = ["ฝ่ายขาย", "ฝ่ายก่อสร้าง", "ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายบุคคล", "ฝ่ายบริหาร"];

export const deptColor: Record<string, string> = {
  "ฝ่ายขาย":     "bg-blue-500/20 text-blue-400",
  "ฝ่ายก่อสร้าง": "bg-orange-500/20 text-orange-400",
  "ฝ่ายการเงิน":  "bg-green-500/20 text-green-400",
  "ฝ่ายบัญชี":   "bg-purple-500/20 text-purple-400",
  "ฝ่ายบุคคล":   "bg-pink-500/20 text-pink-400",
  "ฝ่ายบริหาร":  "bg-aviva-gold/20 text-aviva-gold",
};

export const emptyEmployeeForm = {
  full_name: "",
  nickname: "",
  phone: "",
  email: "",
  department: "ฝ่ายขาย",
  position: "",
  base_salary: "",
  commission_rate: "",
  start_date: today,
  weekly_off_day: "",
};


// ─── After Sales ──────────────────────────────────────────────────────────────

export interface Claim {
  id: string;
  customer_name: string;
  house_number?: string;
  issue_type: string;
  description: string;
  status: "pending" | "in_progress" | "resolved";
  assigned_to: string;
  scheduled_date: string;
  satisfaction_score: number | null;
  created_at: string;
}

export type FilterStatus = "all" | "pending" | "in_progress" | "resolved";

export const statusConfig = {
  pending:     { label: "รอดำเนินการ", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  in_progress: { label: "กำลังดำเนินการ", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  resolved:    { label: "เสร็จสิ้น", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
};

export const issueColor: Record<string, string> = {
  Plumbing:   "bg-blue-500/20 text-blue-400",
  Electrical: "bg-yellow-500/20 text-yellow-400",
  Structure:  "bg-red-500/20 text-red-400",
  Paint:      "bg-purple-500/20 text-purple-400",
  Other:      "bg-gray-500/20 text-gray-400",
};

export const issueTh: Record<string, string> = {
  Plumbing:   "ท่อน้ำ",
  Electrical: "ไฟฟ้า",
  Structure:  "โครงสร้าง",
  Paint:      "สีและทาสี",
  Other:      "อื่นๆ",
};

export const ISSUE_TYPES = ["Plumbing", "Electrical", "Structure", "Paint", "Other"];
export const ASSIGNED_TO_OPTIONS = ["พี่ท (วิศวกร)", "ผู้รับเหมา A", "ผู้รับเหมา B", "ทีมช่างทั่วไป"];

export const emptyClaimForm = {
  customer_name: "",
  house_number: "",
  issue_type: "Other",
  description: "",
  assigned_to: "พี่ท (วิศวกร)",
  scheduled_date: "",
  status: "pending" as Claim["status"],
};


// ─── Approvals ────────────────────────────────────────────────────────────────

export interface ApprovalLog {
  approval_id: string;
  source_doc_index: string;
  source_record_id: string | null;
  workflow_type: string;
  current_approver_role: string;
  action_taken: string;
  action_timestamp: string | null;
  approver_email: string | null;
  rejection_comment: string | null;
  amount: number | null;
  created_at: string;
  submitted_by_user_id: string | null;
}

export type ApprovalsFilterTab = "pending" | "approved" | "rejected";

export function fmtAmt(n: number) {
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

export function getSlaBadge(log: ApprovalLog): { label: string; cls: string } | null {
  if (log.action_taken !== "Pending") return null;
  const sla = SLA_DAYS[log.workflow_type] ?? 3;
  const daysPending = Math.floor((Date.now() - new Date(log.created_at).getTime()) / 86_400_000);
  if (daysPending > sla) return { label: `เกิน SLA ${daysPending - sla} วัน`, cls: "bg-red-500/20 text-red-400 border border-red-500/30" };
  if (daysPending >= sla) return { label: `ครบ SLA วันนี้`, cls: "bg-orange-500/20 text-orange-400 border border-orange-500/30" };
  return null;
}


// ─── Materials / Stock ────────────────────────────────────────────────────────

export interface Material {
  id: string; name: string; unit: string; unit_price: number;
  quantity: number; min_stock: number; current_stock: number;
  status: string; supplier: string; delivery_date: string;
}
export interface PurchaseOrder {
  id: string; po_number: string; supplier_name: string;
  items: { name: string; qty: number; unit: string; unit_price: number }[];
  total_amount: number; status: string; requested_by: string; created_at: string;
  house_id?: string | null; category?: string | null;
}

// โหมด A — ใบสั่งซื้อวัสดุ (PO) ฝั่งจัดซื้อสำนักงาน
export function poTemplates(po: PurchaseOrder): DocTemplate[] {
  return [{
    key: "po", label: "ใบสั่งซื้อวัสดุ", docType: "po",
    fixedNumber: po.po_number ?? undefined,
    render: (docNumber) => {
      const items = po.items ?? [];
      const rows = items.map((it, i) => [i + 1, it.name, it.qty, it.unit, it.unit_price, it.qty * it.unit_price]);
      const total = po.total_amount ?? items.reduce((s, it) => s + it.qty * it.unit_price, 0);
      const body = `
        <table><tbody>
          <tr><th style="width:28%">ผู้จำหน่าย</th><td>${esc(po.supplier_name)}</td></tr>
          <tr><th>ผู้ขอซื้อ</th><td>${esc(po.requested_by ?? "-")}</td></tr>
        </tbody></table>
        ${renderItemsTable(["ลำดับ", "รายการ", "จำนวน", "หน่วย", "ราคา/หน่วย", "รวม"], rows)}
        <table class="totals"><tbody>
          <tr><td style="text-align:right">รวมเป็นเงินทั้งสิ้น</td><td style="text-align:right;font-weight:700">${total.toLocaleString()} บาท</td></tr>
        </tbody></table>`;
      return renderDocShell({ title: "ใบสั่งซื้อวัสดุ", docNumber, bodyHtml: body, signLabels: ["ผู้ขอซื้อ", "ผู้อนุมัติ", "ผู้จำหน่าย"] });
    },
  }];
}


// ─── Payroll ──────────────────────────────────────────────────────────────────

export interface PayrollEmployee extends Employee {
  commission_amount?: number;
  sso?: number;
  tax?: number;
  net?: number;
}


// ─── Community (ค่าส่วนกลาง) ─────────────────────────────────────────────────

export interface CommunityMember {
  member_id: string;
  house_id: string | null;
  owner_name: string;
  owner_phone: string;
  area_sqw: number;
  annual_fee: number;
  fee_status: string;
  transferred_at: string | null;
}

export interface CommunityHouse { id: string; house_number: string; land_size: number | null; }


// ─── Documents (เอกสาร) ───────────────────────────────────────────────────────

export interface OfficeDocument {
  id: string;
  doc_number?: string;
  name: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  uploaded_by: string;
  approved_by: string | null;
  created_at: string;
  description?: string | null;
  file_url?: string | null;
}

export type DocFilterCat = "all" | "Contract" | "Loan" | "Permit" | "Utility";

export const docStatusConfig = {
  approved: { label: "อนุมัติแล้ว", icon: CheckCircle, color: "text-green-400", bg: "border-green-400/20" },
  pending:  { label: "รออนุมัติ",   icon: Clock,        color: "text-yellow-400", bg: "border-yellow-400/20" },
  rejected: { label: "ปฏิเสธ",      icon: XCircle,      color: "text-red-400",    bg: "border-red-400/20" },
};

export const docCategoryStyle: Record<string, string> = {
  Contract: "bg-purple-500/20 text-purple-400",
  Loan:     "bg-blue-500/20 text-blue-400",
  Permit:   "bg-orange-500/20 text-orange-400",
  Utility:  "bg-teal-500/20 text-teal-400",
  Other:    "bg-gray-500/20 text-gray-400",
};

export const docCategoryTh: Record<string, string> = {
  Contract: "สัญญา",
  Loan:     "สินเชื่อ",
  Permit:   "ใบอนุญาต",
  Utility:  "สาธารณูปโภค",
  Other:    "อื่นๆ",
};


// ─── Tab Config ───────────────────────────────────────────────────────────────
// ทุกเมนูมีไอคอน + สีประจำ (โทนเดียวกับปฏิทินหน้าหลัก) — ใช้ทั้ง grid เมนูหลักและแถบสลับเมนู
// หมายเหตุ: คลาสสีต้องเป็น static เต็มตัว (Tailwind ไม่ compile คลาสประกอบสด)

export const TABS: {
  key: OfficeTab; label: string; icon: any; iconColor: string; iconBg: string;
  managerOnly?: boolean; constructionOnly?: boolean; adminOnly?: boolean; dept?: string;
}[] = [
  { key: "finance",     label: "การเงิน",    icon: DollarSign,  iconColor: "text-yellow-400",  iconBg: "bg-yellow-500/10 border-yellow-500/30",   dept: "ฝ่ายการเงิน", managerOnly: true },
  { key: "accounting",  label: "บัญชี",       icon: BookOpen,    iconColor: "text-blue-400",    iconBg: "bg-blue-500/10 border-blue-500/30",       dept: "ฝ่ายบัญชี", managerOnly: true },
  { key: "marketing",   label: "การตลาด",     icon: Megaphone,   iconColor: "text-pink-400",    iconBg: "bg-pink-500/10 border-pink-500/30",       dept: "ฝ่ายการตลาด" },
  { key: "hr",          label: "บุคคล",        icon: Users,       iconColor: "text-cyan-400",    iconBg: "bg-cyan-500/10 border-cyan-500/30",       dept: "ฝ่ายบุคคล" },
  { key: "after-sales", label: "หลังการขาย",  icon: Wrench,      iconColor: "text-orange-400",  iconBg: "bg-orange-500/10 border-orange-500/30",   dept: "ฝ่ายหลังการขาย" },
  { key: "approvals",   label: "อนุมัติ",      icon: CheckCircle, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10 border-emerald-500/30", managerOnly: true },
  { key: "materials",   label: "คลังวัสดุ",    icon: Package,     iconColor: "text-amber-400",   iconBg: "bg-amber-500/10 border-amber-500/30",     constructionOnly: true },
  { key: "documents",   label: "คลังเอกสาร",  icon: FolderOpen,  iconColor: "text-purple-400",  iconBg: "bg-purple-500/10 border-purple-500/30" },
  { key: "community",   label: "ค่าส่วนกลาง",  icon: Home,        iconColor: "text-green-400",   iconBg: "bg-green-500/10 border-green-500/30",     adminOnly: true },
  { key: "commands",    label: "คำสั่ง",       icon: Terminal,    iconColor: "text-aviva-gold",  iconBg: "bg-aviva-gold/10 border-aviva-gold/30",   managerOnly: true },
  { key: "audit",       label: "Audit Log",    icon: ShieldAlert, iconColor: "text-red-400",     iconBg: "bg-red-500/10 border-red-500/30",         adminOnly: true },
];

// จัดหมวดเมนูบนหน้า grid — เรียงตามลักษณะงาน อ่านง่ายกว่าปุ่มเรียงยาวแบบเดิม
export const MENU_SECTIONS: { title: string; keys: OfficeTab[] }[] = [
  { title: "แผนกงาน",          keys: ["finance", "accounting", "marketing", "hr", "after-sales"] },
  { title: "งานส่วนกลาง",       keys: ["approvals", "materials", "documents", "community"] },
  { title: "ผู้บริหารและระบบ",  keys: ["commands", "audit"] },
];

// ทางลัดสำหรับผู้บริหาร/ผจก.โครงการ — ลิงก์ไปหน้าเต็ม (แสดงในหมวด "ผู้บริหารและระบบ")
export const MANAGER_LINKS: { label: string; href: string; icon: any; iconColor: string; iconBg: string }[] = [
  { label: "รายงานทีม",    href: "/reports/review",     icon: ClipboardCheck, iconColor: "text-aviva-gold", iconBg: "bg-aviva-gold/10 border-aviva-gold/30" },
  { label: "ออกเอกสารขาย", href: "/documents/generate", icon: FileText,       iconColor: "text-aviva-gold", iconBg: "bg-aviva-gold/10 border-aviva-gold/30" },
];

// ─── Commands Viewer ──────────────────────────────────────────────────────────

export interface CommandTask {
  id: string;
  title: string;
  description?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected';
  command_type?: string | null;
  deployed_date?: string | null;
}


// ─── Audit Log Viewer ─────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  module: string;
  action: string;
  description: string | null;
  performed_by: string | null;
  performed_by_role: string | null;
  performed_by_dept: string | null;
  timestamp: string | null;
  created_at: string;
}


// ─── Main Page ────────────────────────────────────────────────────────────────


