"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, X, Clock, ClipboardCheck,
  Receipt, FileText, Users, Phone, Briefcase, AlertCircle, Megaphone,
  Sparkles, Wrench, CheckCircle, AlertTriangle, Star, Download,
  XCircle, ShieldAlert, Package, Printer, ChevronDown, ChevronUp,
  FolderOpen, Upload, Search, Home, BookOpen, Pencil, ShoppingCart, Paperclip,
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
import { postJv } from "@/lib/jv";
import { logAction } from "@/lib/audit";
import { attachDocumentToEntity } from "@/lib/doc-attach";
import { useCurrentUser } from "@/lib/user-context";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import { createNotification } from "@/lib/notify";
import Toast, { type ToastType } from "@/components/Toast";
import DeptAIChat from "@/components/DeptAIChat";
import DeptBriefingPanel from "@/components/DeptBriefingPanel";
import { generateDocNumber } from "@/lib/doc-numbers";
import { compressImage } from "@/lib/image-compress";
import { createLeaveRequest } from "@/lib/work-actions";
import { resolveApprovalQueue } from "@/lib/workflow-events";
import { finalizeSale } from "@/lib/sales-finalize";
import { broadcastCelebration } from "@/lib/celebrate";
import { SLA_DAYS, calcSlaDueAt, APPR_LABEL, APPR_DEPT, summarizeApproval } from "@/lib/approval-matrix";
import ApprovalRouteBar from "@/components/ApprovalRouteBar";
import ApprovalVerifyModal, { type VerifyLog } from "@/components/ApprovalVerifyModal";
import PettyCashPanel from "@/components/PettyCashPanel";
import PurchaseRequestPanel from "@/components/PurchaseRequestPanel";
import ProfitabilityPanel from "@/components/ProfitabilityPanel";
import { useFocusHighlight } from "@/lib/use-focus-highlight";
import RecurringExpensePanel from "@/components/RecurringExpensePanel";
import FinancialStatementsPanel from "@/components/FinancialStatementsPanel";
import { expenseAccountFor, revenueAccountFor, categoryFromDescription, calcTax, calcContractorPay, CASH, BANK, INPUT_VAT, WHT_PAYABLE, RETENTION_PAYABLE, WIP, DEFAULT_CONTRACTOR_WHT, DEFAULT_RETENTION } from "@/lib/gl-accounts";

type OfficeTab = "finance" | "accounting" | "marketing" | "hr" | "after-sales" | "approvals" | "materials" | "community" | "documents" | "audit";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// สิทธิวันลาต่อปี (ตาม พ.ร.บ.คุ้มครองแรงงาน) สำหรับติดตามโควต้า
const LEAVE_QUOTA: Record<string, number> = { "ลาป่วย": 30, "ลากิจ": 3, "ลาพักร้อน": 6 };
function leaveDays(from: string, to: string) {
  const d = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  return d > 0 ? d : 1;
}
const today = new Date().toISOString().split("T")[0];

// ─── Shared formatters ──────────────────────────────────────────────────────────────────────────────────

function formatM(n: number) {
  return `฿${Math.abs(n).toLocaleString("th-TH")}`;
}

function formatThb(n: number) {
  return n.toLocaleString("th-TH");
}

// ─── Construction Payment Interfaces ─────────────────────────────────────────────────────

interface ContractorInstallmentPay {
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
interface ConstructionJv {
  id: string;
  jv_number: string;
  jv_date: string;
  description: string;
  ref_number: string | null;
  total_debit: number;
  lines?: { account_code: string; account_name: string; debit: number; credit: number }[];
}

// ─── Finance ──────────────────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
}

interface Approval {
  id: string;
  description: string;
  amount: number;
  status: string;
  requested_by: string;
  created_at: string;
}

const FINANCE_CATEGORIES = ["ค่าก่อสร้าง", "ค่าวัสดุ", "ค่าการตลาด", "เงินเดือน", "ค่าดำเนินการ", "ค่าใช้จ่ายสำนักงาน", "ซ่อมบำรุงสำนักงาน", "สวัสดิการ/ต้อนรับลูกค้า", "รายรับจากการขาย", "อื่นๆ"];

const emptyFinanceForm = {
  transaction_type: "expense",
  amount: "",
  description: "",
  category: "ค่าก่อสร้าง",
  cost_center: "",
  vat_included: false,   // ยอดที่กรอกรวม VAT 7% แล้วหรือไม่ (มีใบกำกับภาษี)
  wht_rate: "0",         // อัตราภาษีหัก ณ ที่จ่าย (%)
};

function FinanceContent() {
  const user = useCurrentUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [materialPurchasePending, setMaterialPurchasePending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyFinanceForm);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"txn" | "approval" | "construction">("txn");
  const [period, setPeriod] = useState<Period>("month");
  const [dateStart, setDateStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [finLimit, setFinLimit] = useState(50);
  const [kpiModal, setKpiModal] = useState<"income" | "expense" | "cashflow" | "pending" | null>(null);
  const [approvedInsts, setApprovedInsts] = useState<ContractorInstallmentPay[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingInst, setPayingInst] = useState<ContractorInstallmentPay | null>(null);
  const [payForm, setPayForm] = useState({ payment_method: "โอนเงิน", reference_number: "", entry_date: new Date().toISOString().split("T")[0], notes: "", wht_rate: DEFAULT_CONTRACTOR_WHT, retention_rate: DEFAULT_RETENTION });

  const fetchData = (limit = finLimit) => {
    let txnQ = supabase.from("finance_transactions").select("*").eq("project_id", PROJECT_ID);
    if (dateStart) txnQ = txnQ.gte("created_at", dateStart);
    if (dateEnd) txnQ = txnQ.lte("created_at", dateEnd + "T23:59:59");
    Promise.all([
      txnQ.order("created_at", { ascending: false }).limit(limit),
      supabase.from("approvals").select("*").eq("module", "finance")
        .order("created_at", { ascending: false }),
      supabase.from("approval_logs").select("approval_id", { count: "exact", head: true })
        .eq("workflow_type", "Material_Purchase").eq("action_taken", "Pending").eq("project_id", PROJECT_ID),
    ]).then(([txnRes, apprRes, matRes]) => {
      setTransactions((txnRes.data as Transaction[]) ?? []);
      setApprovals((apprRes.data as Approval[]) ?? []);
      setMaterialPurchasePending(matRes.count ?? 0);
      setLoading(false);
    });
  };

  const fetchApprovedInsts = async () => {
    const { data } = await supabase.from("contractor_installments")
      .select("id,installment_no,name,amount,status,house_id,contractor_ack_name,labor_cost,material_cost,houses(house_number)")
      .eq("status", "approved")
      .order("installment_no");
    const rows = ((data ?? []) as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      installment_no: r.installment_no as number,
      name: r.name as string,
      amount: r.amount as number,
      status: r.status as string,
      house_id: r.house_id as string,
      house_number: ((r.houses as Record<string, unknown> | null)?.house_number as string) ?? undefined,
      contractor_ack_name: r.contractor_ack_name as string | null ?? undefined,
      labor_cost: r.labor_cost as number | null ?? undefined,
      material_cost: r.material_cost as number | null ?? undefined,
    }));
    setApprovedInsts(rows);
  };

  const handlePayInstallment = async () => {
    if (!payingInst) return;
    setSaving(true);
    // บันทึกเป็น JV เดียว (jv_entries/jv_lines) — แหล่งบัญชีเดียว ไม่เขียนซ้ำลง accounting_entries
    // ฝัง payment_method / notes ไว้ในคำอธิบายเพื่อคงข้อมูลเดิม โดยขึ้นต้นด้วย "จ่ายงวดก่อสร้าง:" สำหรับ filter
    const unit = payingInst.house_number ?? payingInst.house_id;
    // หัก WHT (ค่าจ้างทำของ) + เงินประกันผลงาน (retention) จากมูลค่างานงวด
    const pay = calcContractorPay(payingInst.amount, payForm.wht_rate, payForm.retention_rate);
    let jvDesc = `จ่ายงวดก่อสร้าง: ${payingInst.name} — ยูนิต ${unit} (${payForm.payment_method})`;
    jvDesc += ` — หัก ณ ที่จ่าย ${payForm.wht_rate}% ฿${pay.wht.toLocaleString()}, ประกันผลงาน ${payForm.retention_rate}% ฿${pay.retention.toLocaleString()}, จ่ายสุทธิ ฿${pay.net.toLocaleString()}`;
    if (payForm.notes) jvDesc += ` — ${payForm.notes}`;
    // เดบิตงานระหว่างก่อสร้าง (สินค้าคงเหลือ) — ต้นทุนสะสมจนตัดเป็นต้นทุนขายตอนโอน
    // หัก WHT/ประกันผลงาน ฝั่งเครดิต จ่ายสุทธิเข้าธนาคาร
    const payLines = [
      { account_code: WIP.code, account_name: WIP.name, debit: pay.gross, credit: 0 },
    ];
    if (pay.wht > 0) payLines.push({ account_code: WHT_PAYABLE.code, account_name: WHT_PAYABLE.name, debit: 0, credit: pay.wht });
    if (pay.retention > 0) payLines.push({ account_code: RETENTION_PAYABLE.code, account_name: RETENTION_PAYABLE.name, debit: 0, credit: pay.retention });
    payLines.push({ account_code: BANK.code, account_name: BANK.name, debit: 0, credit: pay.net });
    await postJv({
      project_id: PROJECT_ID,
      jv_date: payForm.entry_date,
      description: jvDesc,
      ref_number: payForm.reference_number || null,
      lines: payLines,
    });
    const paidByName = user?.full_name ?? user?.email ?? "ฝ่ายการเงิน";
    await supabase.from("contractor_installments").update({ status: "paid", paid_by: paidByName, paid_at: new Date().toISOString() }).eq("id", payingInst.id);
    await createNotification({
      type: "success",
      title: `${payingInst.name} — บันทึกจ่ายแล้ว`,
      message: `ยูนิต ${payingInst.house_number ?? payingInst.house_id} — งานงวด ฿${pay.gross.toLocaleString()} หัก WHT ฿${pay.wht.toLocaleString()} + ประกันผลงาน ฿${pay.retention.toLocaleString()} = จ่ายสุทธิ ฿${pay.net.toLocaleString()} โดย ${paidByName}`,
      from_dept: "ฝ่ายการเงิน",
    });
    setSaving(false);
    setShowPayModal(false);
    setPayingInst(null);
    setPayForm({ payment_method: "โอนเงิน", reference_number: "", entry_date: new Date().toISOString().split("T")[0], notes: "", wht_rate: DEFAULT_CONTRACTOR_WHT, retention_rate: DEFAULT_RETENTION });
    fetchApprovedInsts();
  };

  useEffect(() => { setFinLimit(50); fetchData(50); fetchApprovedInsts(); }, [dateStart, dateEnd]);

  const totalIncome = transactions
    .filter(t => t.transaction_type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions
    .filter(t => t.transaction_type === "expense")
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const netCashflow = totalIncome - totalExpenses;
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;

  const exportCSV = () => {
    const rows = [["วันที่", "ประเภท", "รายละเอียด", "จำนวนเงิน"]];
    transactions.forEach(tx => rows.push([
      new Date(tx.created_at).toLocaleDateString("th-TH"),
      tx.transaction_type === "income" ? "รายรับ" : "รายจ่าย",
      tx.description,
      String(tx.amount),
    ]));
    const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    const finUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.href = finUrl;
    a.download = `finance_${dateStart}_${dateEnd}.csv`;
    a.click();
    URL.revokeObjectURL(finUrl);
  };

  const handleSave = async () => {
    if (!form.amount || !form.description) return;
    setSaving(true);
    const amt = Number(form.amount);
    if (amt >= 50000) {
      const finDocNum = await generateDocNumber("FIN");
      const { data } = await supabase.from("approvals").insert({
        module: "finance",
        reference_type: "transaction",
        amount: amt,
        description: `[${form.category}] ${form.description}`,
        status: "pending",
        requested_by: user?.full_name ?? "Admin",
      }).select().single();
      const { data: logRow } = await supabase.from("approval_logs").insert({
        workflow_type: "Finance_Approval",
        source_doc_index: `${finDocNum} | [${form.category}] ${form.description}${form.cost_center ? ` (${form.cost_center})` : ""} | โดย ${user?.full_name ?? user?.email ?? "Unknown"}`,
        submitted_by_user_id: user?.id ?? null,
        source_record_id: data?.id ?? null,
        current_approver_role: amt >= 500000 ? "admin" : "manager",
        action_taken: "Pending",
        amount: amt,
        sla_due_at: calcSlaDueAt("Finance_Approval"),
        assigned_to_name: "ผู้จัดการ",
      }).select("approval_id").single();
      // แนบใบเสร็จ/สลิป เข้ากับคำขออนุมัติ (ให้ผู้อนุมัติเปิดดูในหน้าตรวจสอบ)
      if (receiptFile && logRow?.approval_id) {
        const ext = receiptFile.name.split(".").pop() ?? "jpg";
        const path = `entity-docs/approval_log/${logRow.approval_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("document-attachments").upload(path, await compressImage(receiptFile), { upsert: true });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("document-attachments").getPublicUrl(path);
          await attachDocumentToEntity("approval_log", logRow.approval_id, publicUrl, receiptFile.name, user?.full_name ?? user?.email ?? "ผู้ขอ");
        }
      }
      await logAction("finance", "request_approval", `ขออนุมัติ ฿${amt.toLocaleString()} — ${form.description}`, data?.id);
      await createNotification({ type: "approval", title: "ขออนุมัติรายจ่าย", message: `จาก ${user?.full_name ?? "ฝ่ายการเงิน"} · [${form.category}] ${form.description} ฿${amt.toLocaleString()} · ส่งให้${amt >= 500000 ? "ผู้บริหาร" : "ผู้จัดการ"}พิจารณา`, from_dept: "ฝ่ายการเงิน", to_dept: "ผู้บริหาร" });
    } else {
      const isIncome = form.transaction_type === "income";
      // คำนวณภาษี (เฉพาะรายจ่าย): VAT ซื้อ 7% + หัก ณ ที่จ่าย
      const wht = Number(form.wht_rate) || 0;
      const tax = !isIncome && (form.vat_included || wht > 0) ? calcTax(amt, form.vat_included, wht) : null;
      const expenseRecognized = tax ? tax.base : amt; // ค่าใช้จ่ายจริง (ไม่รวม VAT ที่ขอคืนได้)

      const { data } = await supabase.from("finance_transactions").insert({
        project_id: PROJECT_ID,
        transaction_type: form.transaction_type,
        amount: isIncome ? amt : -expenseRecognized,
        description: `[${form.category}] ${form.description}`,
      }).select().single();

      // Auto-create JV entry — map หมวด -> บัญชี GL ที่ถูกต้อง (ไม่ hardcode 5000/1100)
      const jvDate = new Date().toISOString().split("T")[0];
      if (isIncome) {
        const rev = revenueAccountFor(form.category);
        await postJv({
          project_id: PROJECT_ID, jv_date: jvDate,
          description: `[${form.category}] ${form.description}`,
          lines: [
            { account_code: CASH.code, account_name: CASH.name, debit: amt, credit: 0 },
            { account_code: rev.code, account_name: rev.name, debit: 0, credit: amt },
          ],
        });
      } else {
        const exp = expenseAccountFor(form.category);
        const lines = [{ account_code: exp.code, account_name: exp.name, debit: tax ? tax.base : amt, credit: 0 }];
        if (tax && tax.vat > 0) lines.push({ account_code: INPUT_VAT.code, account_name: INPUT_VAT.name, debit: tax.vat, credit: 0 });
        if (tax && tax.wht > 0) lines.push({ account_code: WHT_PAYABLE.code, account_name: WHT_PAYABLE.name, debit: 0, credit: tax.wht });
        lines.push({ account_code: CASH.code, account_name: CASH.name, debit: 0, credit: tax ? tax.net : amt });
        await postJv({ project_id: PROJECT_ID, jv_date: jvDate, description: `[${form.category}] ${form.description}`, lines });
        // บันทึกทะเบียนภาษีซื้ออัตโนมัติ (กัน VAT ตกหล่น — เดิมต้องกรอกซ้ำในแท็บภาษี)
        if (tax && tax.vat > 0) {
          await supabase.from("vat_register").insert({
            vat_type: "input",
            invoice_no: `AUTO-${Date.now().toString().slice(-8)}`,
            invoice_date: jvDate,
            party_name: (form.description || form.category).slice(0, 80),
            base_amount: tax.base,
            vat_amount: tax.vat,
            total_amount: tax.gross,
            period: `${jvDate.slice(2, 4)}${jvDate.slice(5, 7)}`,
            etax_status: "pending",
            project_id: PROJECT_ID,
          });
        }
      }

      const taxNote = tax && (tax.vat > 0 || tax.wht > 0)
        ? ` (ฐาน ฿${tax.base.toLocaleString()}${tax.vat > 0 ? `, VAT ฿${tax.vat.toLocaleString()}` : ""}${tax.wht > 0 ? `, หัก ณ ที่จ่าย ฿${tax.wht.toLocaleString()} จ่ายสุทธิ ฿${tax.net.toLocaleString()}` : ""})`
        : "";
      await logAction("finance", "add_transaction", `เพิ่มรายการ ${form.transaction_type} ฿${amt.toLocaleString()} — ${form.description}${taxNote}`, data?.id);
    }
    setSaving(false);
    setShowModal(false);
    setForm(emptyFinanceForm);
    setReceiptFile(null);
    fetchData();
  };

  const handleApprove = async (id: string, approved: boolean) => {
    const approval = approvals.find(a => a.id === id);
    if (!approval) return;
    // Maker-Checker: ผู้อนุมัติ/ปฏิเสธ ต้องไม่ใช่ผู้ขอ
    const requester = (approval as { requested_by?: string | null }).requested_by;
    if (requester && user?.full_name && requester === user.full_name) {
      alert("ไม่สามารถดำเนินการกับรายการที่ท่านเป็นผู้ขอได้ (Maker-Checker)");
      return;
    }
    await supabase.from("approvals").update({
      status: approved ? "approved" : "rejected",
      approved_by: user?.full_name ?? user?.email ?? "Admin",
      approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (approved) {
      await supabase.from("finance_transactions").insert({
        project_id: PROJECT_ID,
        transaction_type: "expense",
        amount: -approval.amount,
        description: approval.description,
      });
      // Auto-create JV for approved finance transaction — map หมวด -> บัญชี GL ที่ถูกต้อง
      const exp = expenseAccountFor(categoryFromDescription(approval.description));
      await postJv({
        project_id: PROJECT_ID,
        jv_date: new Date().toISOString().split("T")[0],
        description: `[อนุมัติแล้ว] ${approval.description}`,
        lines: [
          { account_code: exp.code, account_name: exp.name, debit: approval.amount, credit: 0 },
          { account_code: CASH.code, account_name: CASH.name, debit: 0, credit: approval.amount },
        ],
      });
    }
    await logAction("finance", approved ? "approve" : "reject",
      `${approved ? "อนุมัติ" : "ปฏิเสธ"} ฿${approval.amount.toLocaleString()} — ${approval.description}`, id);
    await createNotification({
      type: approved ? "success" : "info",
      title: approved ? "อนุมัติรายจ่ายแล้ว" : "ปฏิเสธรายจ่าย",
      message: `${approval.description} ฿${approval.amount.toLocaleString()}`,
      from_dept: "ฝ่ายการเงิน",
    });
    fetchData();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <DeptAIChat dept="finance" label="AI ฝ่ายการเงิน" />
      <DeptBriefingPanel dept="finance" label="ฝ่ายการเงิน" />
      {materialPurchasePending > 0 && (
        <GlassCard className="p-3 border border-orange-500/20 bg-orange-500/5">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-orange-400 flex-shrink-0" />
            <span className="text-xs text-orange-400 flex-1">
              รออนุมัติจัดซื้อวัสดุ <b>{materialPurchasePending}</b> รายการ
            </span>
          </div>
        </GlassCard>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setKpiModal("income")} className="active:scale-[0.97] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <TrendingUp size={16} className="text-green-400 mx-auto mb-1" />
            <p className="text-base font-bold text-green-400">{formatM(totalIncome || 0)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายรับรวม</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModal("expense")} className="active:scale-[0.97] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <TrendingDown size={16} className="text-red-400 mx-auto mb-1" />
            <p className="text-base font-bold text-red-400">{formatM(totalExpenses || 0)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายจ่ายรวม</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModal("cashflow")} className="active:scale-[0.97] transition-transform w-full text-left">
          <GlassCard gold className="p-3 text-center">
            <DollarSign size={16} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-base font-bold text-aviva-gold">{formatM(netCashflow || 0)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">Net Cashflow</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModal("pending")} className="active:scale-[0.97] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <ClipboardCheck size={16} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-base font-bold text-yellow-400">{pendingApprovals}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รออนุมัติ</p>
          </GlassCard>
        </button>
      </div>

      <AIInsightPanel
        type="info"
        priority="medium"
        title="AI: วิเคราะห์การเงิน"
        message="รายจ่ายเดือนนี้ควรตรวจสอบหมวดก่อสร้าง แนะนำทบทวนงบประมาณผู้รับเหมาก่อนสิ้นไตรมาส"
      />

      <PettyCashPanel />

      <PurchaseRequestPanel />

      {user?.isManager && <ProfitabilityPanel />}

      {user?.isManager && <RecurringExpensePanel />}

      {user?.isManager && <FinancialStatementsPanel />}

      <PeriodFilter period={period} onChange={(p, s, e) => { setPeriod(p); setDateStart(s); setDateEnd(e); }} />

      {/* Add + Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
        >
          <Plus size={16} /> เพิ่มรายการเงิน
        </button>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 border border-aviva-gold/30 text-aviva-gold px-4 py-3 rounded-2xl text-sm font-medium"
        >
          <Download size={15} /> CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { k: "txn", l: "รายการทั้งหมด" },
          { k: "approval", l: `รออนุมัติ${pendingApprovals > 0 ? ` (${pendingApprovals})` : ""}` },
          { k: "construction", l: `เบิกจ่ายก่อสร้าง${approvedInsts.length > 0 ? ` (${approvedInsts.length})` : ""}` },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => setActiveTab(k as "txn" | "approval" | "construction")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              activeTab === k
                ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      {activeTab === "txn" && (
        <div className="space-y-2">
          <SectionHeader title="รายการล่าสุด" />
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-aviva-card/50 animate-pulse" />)
            : transactions.length === 0
            ? <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p></GlassCard>
            : transactions.map(tx => (
              <GlassCard key={tx.id} className="p-3 flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  tx.transaction_type === "income" ? "bg-green-500/10" : "bg-red-500/10")}>
                  {tx.transaction_type === "income"
                    ? <TrendingUp size={14} className="text-green-400" />
                    : <TrendingDown size={14} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-aviva-text font-medium truncate">{tx.description}</p>
                  <p className="text-[10px] text-aviva-secondary">{new Date(tx.created_at).toLocaleDateString("th-TH")}</p>
                </div>
                <span className={clsx("text-sm font-bold flex-shrink-0", Number(tx.amount) > 0 ? "text-green-400" : "text-red-400")}>
                  {Number(tx.amount) > 0 ? "+" : ""}{formatM(tx.amount)}
                </span>
              </GlassCard>
            ))
          }
          {!loading && transactions.length >= finLimit && (
            <button onClick={() => { const next = finLimit + 50; setFinLimit(next); fetchData(next); }}
              className="w-full py-2.5 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-bg hover:border-aviva-gold/30 transition-all mt-1">
              โหลดเพิ่มเติม (แสดง {finLimit} รายการแล้ว)
            </button>
          )}
        </div>
      )}

      {activeTab === "approval" && (
        <div className="space-y-3">
          <SectionHeader title="รายการรออนุมัติ" subtitle="≥ ฿100,000 ต้องอนุมัติก่อน" />
          {approvals.length === 0
            ? <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ไม่มีรายการรออนุมัติ</p></GlassCard>
            : approvals.map(ap => (
              <GlassCard key={ap.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-aviva-text">{ap.description}</p>
                    <p className="text-xs text-aviva-secondary mt-0.5">โดย: {ap.requested_by}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-aviva-gold">฿{ap.amount.toLocaleString("th-TH")}</p>
                    <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                      ap.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                      ap.status === "approved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {ap.status === "pending" ? "รออนุมัติ" : ap.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
                    </span>
                  </div>
                </div>
                {ap.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(ap.id, true)}
                      className="flex-1 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium">
                      อนุมัติ
                    </button>
                    <button onClick={() => handleApprove(ap.id, false)}
                      className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium">
                      ปฏิเสธ
                    </button>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-aviva-gold/10">
                  <AttachDocButton entityType="approval_log" entityId={ap.id} attachedBy={user?.full_name ?? ""} templates={approvalTemplates(ap)} />
                </div>
              </GlassCard>
            ))
          }
        </div>
      )}

      {activeTab === "construction" && (
        <div className="space-y-3">
          <SectionHeader title="เบิกจ่ายก่อสร้าง" subtitle="งวดงานที่อนุมัติแล้ว — รอบันทึกจ่าย" />
          {approvedInsts.length === 0 ? (
            <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ไม่มีงวดงานที่รอจ่าย</p></GlassCard>
          ) : approvedInsts.map(inst => (
            <GlassCard key={inst.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-aviva-text">{inst.name}</p>
                  {inst.house_number && <p className="text-xs text-aviva-secondary mt-0.5">ยูนิต: {inst.house_number}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-aviva-gold">฿{inst.amount.toLocaleString("th-TH")}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">อนุมัติแล้ว</span>
                </div>
              </div>
              <button onClick={() => { setPayingInst(inst); setShowPayModal(true); }}
                className="w-full py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium">
                บันทึกจ่าย
              </button>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Pay Installment Modal */}
      {showPayModal && payingInst && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">บันทึกจ่าย — {payingInst.name}</h2>
              <button onClick={() => { setShowPayModal(false); setPayingInst(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="bg-aviva-gold/5 border border-aviva-gold/20 rounded-xl px-3 py-2.5 space-y-1">
              <p className="text-sm text-aviva-secondary">จำนวนเงิน: <span className="text-aviva-gold font-bold text-base">฿{payingInst.amount.toLocaleString()}</span></p>
              {payingInst.house_number && <p className="text-xs text-aviva-secondary">ยูนิต: <span className="text-aviva-text">{payingInst.house_number}</span></p>}
              {payingInst.contractor_ack_name && (
                <p className="text-xs text-green-400">✍ ผู้รับเหมารับทราบ: <span className="font-semibold">{payingInst.contractor_ack_name}</span></p>
              )}
              {!payingInst.contractor_ack_name && (
                <p className="text-xs text-orange-400">⚠ ผู้รับเหมายังไม่ได้ลงชื่อรับทราบผลการตรวจ</p>
              )}
              {((payingInst.labor_cost ?? 0) > 0 || (payingInst.material_cost ?? 0) > 0) && (
                <p className="text-[10px] text-aviva-secondary/70">ค่าแรง ฿{(payingInst.labor_cost ?? 0).toLocaleString()} · ค่าวัสดุ ฿{(payingInst.material_cost ?? 0).toLocaleString()}</p>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วิธีการชำระเงิน</label>
                <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["โอนเงิน", "เช็ค", "เงินสด"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เลขที่อ้างอิง (ถ้ามี)</label>
                <input type="text" value={payForm.reference_number} onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })}
                  placeholder="เลขที่โอน / เลขที่เช็ค"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่จ่าย</label>
                <input type="date" value={payForm.entry_date} onChange={e => setPayForm({ ...payForm, entry_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">หัก ณ ที่จ่าย (%)</label>
                  <input type="number" inputMode="decimal" value={payForm.wht_rate}
                    onChange={e => setPayForm({ ...payForm, wht_rate: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เงินประกันผลงาน (%)</label>
                  <input type="number" inputMode="decimal" value={payForm.retention_rate}
                    onChange={e => setPayForm({ ...payForm, retention_rate: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              {payingInst && (() => {
                const pay = calcContractorPay(payingInst.amount, payForm.wht_rate, payForm.retention_rate);
                return (
                  <div className="bg-aviva-bg/50 border border-aviva-gold/10 rounded-xl px-4 py-2.5 text-xs space-y-1">
                    <div className="flex justify-between text-aviva-secondary"><span>มูลค่างานงวด</span><span>฿{pay.gross.toLocaleString()}</span></div>
                    <div className="flex justify-between text-red-400/90"><span>หัก ณ ที่จ่าย {payForm.wht_rate}%</span><span>−฿{pay.wht.toLocaleString()}</span></div>
                    <div className="flex justify-between text-orange-400/90"><span>หักประกันผลงาน {payForm.retention_rate}%</span><span>−฿{pay.retention.toLocaleString()}</span></div>
                    <div className="flex justify-between text-aviva-gold font-bold border-t border-aviva-gold/10 pt-1"><span>จ่ายสุทธิ</span><span>฿{pay.net.toLocaleString()}</span></div>
                  </div>
                );
              })()}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <input type="text" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder="หมายเหตุเพิ่มเติม"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handlePayInstallment} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "ยืนยันบันทึกจ่าย"}
            </button>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เพิ่มรายการเงิน</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>

            <div className="flex gap-2">
              {[
                { val: "expense", label: "รายจ่าย", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                { val: "income", label: "รายรับ", color: "bg-green-500/20 text-green-400 border-green-500/30" },
              ].map(({ val, label, color }) => (
                <button key={val} onClick={() => setForm({ ...form, transaction_type: val })}
                  className={clsx("flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                    form.transaction_type === val ? color : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                  )}>{label}</button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท) *</label>
                <input type="number" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                {Number(form.amount) >= 50000 && (
                  <p className="text-[11px] text-yellow-400 mt-1 flex items-center gap-1">
                    <Clock size={10} /> ≥ ฿50,000 จะเข้าระบบอนุมัติก่อน
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                <input type="text" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="อธิบายรายการ..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {FINANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">Cost Center (ระบุถ้ามี)</label>
                <input type="text" value={form.cost_center}
                  onChange={e => setForm({ ...form, cost_center: e.target.value })}
                  placeholder="เช่น CC-001 ฝ่ายก่อสร้าง"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>

              {/* ภาษี (เฉพาะรายจ่าย) — VAT ซื้อ 7% + หัก ณ ที่จ่าย */}
              {form.transaction_type === "expense" && (
                <div className="rounded-xl border border-aviva-gold/15 bg-aviva-bg/40 p-3 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.vat_included}
                      onChange={e => setForm({ ...form, vat_included: e.target.checked })}
                      className="accent-aviva-gold w-4 h-4" />
                    <span className="text-xs text-aviva-text">ราคารวม VAT 7% แล้ว (มีใบกำกับภาษี — ขอคืนภาษีซื้อได้)</span>
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-aviva-secondary">หัก ณ ที่จ่าย</span>
                    <select value={form.wht_rate} onChange={e => setForm({ ...form, wht_rate: e.target.value })}
                      className="bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                      <option value="0">ไม่หัก</option>
                      <option value="1">1% (ค่าขนส่ง)</option>
                      <option value="2">2% (โฆษณา)</option>
                      <option value="3">3% (บริการ/จ้างทำของ)</option>
                      <option value="5">5% (ค่าเช่า)</option>
                    </select>
                  </div>
                  {Number(form.amount) > 0 && (form.vat_included || Number(form.wht_rate) > 0) && (() => {
                    const t = calcTax(Number(form.amount), form.vat_included, Number(form.wht_rate));
                    return (
                      <div className="text-[11px] text-aviva-secondary space-y-0.5 border-t border-aviva-gold/10 pt-2">
                        <div className="flex justify-between"><span>ฐานก่อน VAT (ค่าใช้จ่าย)</span><span className="text-aviva-text">฿{t.base.toLocaleString()}</span></div>
                        {t.vat > 0 && <div className="flex justify-between"><span>ภาษีซื้อ 7%</span><span className="text-aviva-text">฿{t.vat.toLocaleString()}</span></div>}
                        {t.wht > 0 && <div className="flex justify-between"><span>หัก ณ ที่จ่าย {form.wht_rate}%</span><span className="text-red-400">−฿{t.wht.toLocaleString()}</span></div>}
                        <div className="flex justify-between font-semibold"><span>จ่ายสุทธิ</span><span className="text-aviva-gold">฿{t.net.toLocaleString()}</span></div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {Number(form.amount) >= 50000 && (
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">แนบใบเสร็จ / สลิป (ให้ผู้อนุมัติตรวจสอบ)</label>
                <label className="flex items-center gap-2 cursor-pointer bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-secondary hover:border-aviva-gold/50">
                  <Paperclip size={14} className="text-aviva-gold" />
                  <span className="truncate">{receiptFile ? receiptFile.name : "แตะเพื่อแนบรูป/ไฟล์ PDF"}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}

            <button onClick={handleSave} disabled={saving || !form.amount || !form.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : Number(form.amount) >= 50000 ? "ส่งขออนุมัติ" : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModal === "income" ? "รายรับทั้งหมด" :
                 kpiModal === "expense" ? "รายจ่ายทั้งหมด" :
                 kpiModal === "cashflow" ? "รายการทั้งหมด" : "รออนุมัติ"}
              </h2>
              <button onClick={() => setKpiModal(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {kpiModal === "pending" ? (
                approvals.filter(a => a.status === "pending").map(a => (
                  <div key={a.id} className="p-3 rounded-xl bg-aviva-bg border border-yellow-500/20">
                    <p className="text-xs font-semibold text-aviva-text">{a.description}</p>
                    <p className="text-[10px] text-yellow-400 mt-0.5">{formatM(Number(a.amount))}</p>
                  </div>
                ))
              ) : (
                transactions
                  .filter(t => kpiModal === "cashflow" || t.transaction_type === (kpiModal === "income" ? "income" : "expense"))
                  .map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-aviva-text truncate">{t.description}</p>
                        <p className="text-[10px] text-aviva-secondary">{new Date(t.created_at).toLocaleDateString("th-TH")}</p>
                      </div>
                      <p className={clsx("text-xs font-bold flex-shrink-0",
                        t.transaction_type === "income" ? "text-green-400" : "text-red-400"
                      )}>{formatM(Math.abs(Number(t.amount)))}</p>
                    </div>
                  ))
              )}
              {(kpiModal === "pending"
                ? approvals.filter(a => a.status === "pending")
                : transactions.filter(t => kpiModal === "cashflow" || t.transaction_type === (kpiModal === "income" ? "income" : "expense"))
              ).length === 0 && (
                <p className="text-center text-aviva-secondary text-sm py-8">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Accounting ───────────────────────────────────────────────────────────────

interface ReceiptRow {
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

const ACCOUNTING_CATEGORIES = ["วัสดุก่อสร้าง", "ค่าแรง", "ค่าสาธารณูปโภค", "ค่าอุปกรณ์สำนักงาน", "ค่าการตลาด", "ค่าขนส่ง", "อื่นๆ"];

const emptyReceiptForm = {
  receipt_date: today,
  vendor_name: "",
  description: "",
  amount: "",
  category: "วัสดุก่อสร้าง",
  receipt_type: "expense",
  receipt_number: "",
};

// โหมด A — ใบสำคัญลงบัญชี (JV voucher) จากรายการบัญชีก่อสร้าง
function jvTemplates(e: ConstructionJv): DocTemplate[] {
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
function receiptTemplates(r: ReceiptRow): DocTemplate[] {
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
function approvalTemplates(ap: Approval): DocTemplate[] {
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
function leaveTemplates(l: { employee_name: string; leave_type: string; date_from: string; date_to: string; reason: string }): DocTemplate[] {
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

function AccountingContent() {
  const user = useCurrentUser();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyReceiptForm);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [acctPeriod, setAcctPeriod] = useState<Period>("month");
  const [acctStart, setAcctStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [acctEnd, setAcctEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [acctLimit, setAcctLimit] = useState(50);
  const [kpiModalAcct, setKpiModalAcct] = useState<"all" | "income" | "expense" | null>(null);
  const [acctEntries, setAcctEntries] = useState<ConstructionJv[]>([]);
  const [acctView, setAcctView] = useState<"receipts" | "construction">("receipts");

  const fetchReceipts = (limit = acctLimit) => {
    let q = supabase.from("receipts").select("*").eq("project_id", PROJECT_ID);
    if (acctStart) q = q.gte("receipt_date", acctStart);
    if (acctEnd) q = q.lte("receipt_date", acctEnd);
    q.order("receipt_date", { ascending: false }).limit(limit)
      .then(({ data }) => {
        setReceipts((data as ReceiptRow[]) ?? []);
        setLoading(false);
      });
  };

  const fetchConstructionJvs = async () => {
    const { data } = await supabase.from("jv_entries")
      .select("id,jv_number,jv_date,description,ref_number,total_debit")
      .eq("project_id", PROJECT_ID)
      .like("description", "จ่ายงวดก่อสร้าง%")
      .order("jv_date", { ascending: false })
      .limit(50);
    const entries = (data as ConstructionJv[]) ?? [];
    // ดึงบรรทัดบัญชีจริง (jv_lines) มาแนบ เพื่อให้ใบสำคัญลงบัญชีแสดงครบทุกบรรทัด (WHT/ประกันผลงาน/ธนาคาร)
    if (entries.length > 0) {
      const { data: lineData } = await supabase.from("jv_lines")
        .select("jv_id,account_code,account_name,debit,credit")
        .in("jv_id", entries.map(e => e.id));
      if (lineData) {
        const byJv = new Map<string, ConstructionJv["lines"]>();
        for (const l of lineData as { jv_id: string; account_code: string; account_name: string; debit: number; credit: number }[]) {
          if (!byJv.has(l.jv_id)) byJv.set(l.jv_id, []);
          byJv.get(l.jv_id)!.push({ account_code: l.account_code, account_name: l.account_name, debit: Number(l.debit), credit: Number(l.credit) });
        }
        entries.forEach(e => { e.lines = byJv.get(e.id); });
      }
    }
    setAcctEntries(entries);
  };

  useEffect(() => { setAcctLimit(50); fetchReceipts(50); fetchConstructionJvs(); }, [acctStart, acctEnd]);

  const totalExpense = receipts.filter(r => r.receipt_type === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome = receipts.filter(r => r.receipt_type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const filtered = filterType === "all" ? receipts : receipts.filter(r => r.receipt_type === filterType);

  const exportCSV = () => {
    const rows = [["วันที่", "เลขที่", "ประเภท", "ผู้ขาย", "รายละเอียด", "หมวด", "จำนวนเงิน"]];
    filtered.forEach(r => rows.push([
      r.receipt_date,
      r.receipt_number,
      r.receipt_type === "income" ? "รายรับ" : "รายจ่าย",
      r.vendor_name,
      r.description ?? "",
      r.category,
      String(r.amount),
    ]));
    const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    const rcptUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.href = rcptUrl;
    a.download = `receipts_${acctStart}_${acctEnd}.csv`;
    a.click();
    URL.revokeObjectURL(rcptUrl);
  };

  const handleSave = async () => {
    if (!form.vendor_name || !form.amount) return;
    setSaving(true);
    const rcptNum = form.receipt_number || `RC-${Date.now().toString().slice(-6)}`;
    await supabase.from("receipts").insert({
      project_id: PROJECT_ID,
      receipt_date: form.receipt_date,
      vendor_name: form.vendor_name,
      description: form.description,
      amount: Number(form.amount),
      category: form.category,
      receipt_type: form.receipt_type,
      receipt_number: rcptNum,
    });
    // When recording income receipt, also create AR invoice for accounting integration
    if (form.receipt_type === "income") {
      const invNum = `INV-${Date.now().toString().slice(-6)}`;
      await supabase.from("ar_invoices").insert({
        invoice_number: invNum,
        customer_name: form.vendor_name,
        invoice_date: form.receipt_date,
        due_date: form.receipt_date,
        base_amount: Number(form.amount),
        vat_amount: 0,
        total_amount: Number(form.amount),
        paid_amount: Number(form.amount),
        status: "paid",
        description: form.description || form.category,
        project_id: PROJECT_ID,
        ref_number: rcptNum,
      });
    }
    setSaving(false);
    setShowModal(false);
    setForm(emptyReceiptForm);
    fetchReceipts();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <DeptAIChat dept="accounting" label="AI ฝ่ายบัญชี" />
      <DeptBriefingPanel dept="accounting" label="ฝ่ายบัญชี" />
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setKpiModalAcct("all")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <Receipt size={14} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-lg font-bold text-aviva-text">{receipts.length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">ใบเสร็จทั้งหมด</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModalAcct("income")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <TrendingUp size={14} className="text-green-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-400">{formatM(totalIncome)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายรับทั้งหมด</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModalAcct("expense")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <TrendingDown size={14} className="text-red-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-red-400">{formatM(totalExpense)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายจ่ายทั้งหมด</p>
          </GlassCard>
        </button>
      </div>

      <AIInsightPanel
        type="success"
        priority="low"
        title="AI: รายรับสูงขึ้น"
        message="ยอดรับเงินเดือนนี้เพิ่มขึ้นจากเดือนก่อน แนะนำตรวจสอบการจับคู่ใบเสร็จกับสัญญาให้ครบถ้วน"
      />

      {/* Full accounting system link */}
      <Link
        href="/office/accounting"
        className="flex items-center justify-between w-full bg-aviva-gold/10 border border-aviva-gold/30 text-aviva-gold px-4 py-3 rounded-2xl text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <BookOpen size={16} />
          ระบบบัญชีเต็มรูปแบบ (JV · AR · AP · ภาษี · TFRS15)
        </span>
        <span className="text-aviva-gold/60">→</span>
      </Link>

      <PeriodFilter period={acctPeriod} onChange={(p, s, e) => { setAcctPeriod(p); setAcctStart(s); setAcctEnd(e); }} />

      {/* Add + Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
        >
          <Plus size={16} /> บันทึกบิล
        </button>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 border border-aviva-gold/30 text-aviva-gold px-4 py-3 rounded-2xl text-sm font-medium"
        >
          <Download size={15} /> CSV
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "ทั้งหมด" },
          { key: "expense", label: "รายจ่าย" },
          { key: "income", label: "รายรับ" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilterType(key as typeof filterType)}
            className={clsx("px-4 py-1.5 rounded-full text-xs font-medium border transition-all",
              filterType === key
                ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{label}</button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {[
          { k: "receipts", l: "บิล / ใบเสร็จ" },
          { k: "construction", l: `บัญชีก่อสร้าง${acctEntries.length > 0 ? ` (${acctEntries.length})` : ""}` },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => setAcctView(k as "receipts" | "construction")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              acctView === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      {acctView === "construction" && (
        <div className="space-y-2">
          <SectionHeader title="บัญชีก่อสร้าง" subtitle="รายการจ่ายงวดผู้รับเหมา" />
          {acctEntries.length === 0 ? (
            <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p></GlassCard>
          ) : acctEntries.map(e => (
            <GlassCard key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aviva-text truncate">{e.description}</p>
                  <p className="text-xs text-aviva-secondary mt-0.5">{e.jv_date} · {e.jv_number}</p>
                  {e.ref_number && <p className="text-[10px] text-aviva-secondary/60">Ref: {e.ref_number}</p>}
                  <div className="text-[10px] text-aviva-secondary/60 mt-0.5">
                    {e.lines && e.lines.length > 0
                      ? e.lines.map(l => `${l.debit > 0 ? "Dr" : "Cr"} ${l.account_code} ${l.account_name}`).join(" / ")
                      : "Dr: 2100 เจ้าหนี้ผู้รับเหมา / Cr: 1120 เงินฝากธนาคาร"}
                  </div>
                  <div className="mt-1.5">
                    <AttachDocButton entityType="jv_entry" entityId={e.id} attachedBy={user?.full_name ?? ""} templates={jvTemplates(e)} />
                  </div>
                </div>
                <p className="text-sm font-bold text-red-400 flex-shrink-0">-฿{e.total_debit.toLocaleString()}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {acctView === "receipts" && (
      <div>
        <SectionHeader title="รายการบิล / ใบเสร็จ" subtitle={loading ? "กำลังโหลด..." : `${receipts.length} รายการ`} />
        <div className="space-y-2">
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            : filtered.length === 0
            ? (
              <GlassCard className="p-8 text-center">
                <Receipt size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p>
              </GlassCard>
            )
            : filtered.map(r => (
              <GlassCard key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className={r.receipt_type === "expense" ? "text-red-400" : "text-green-400"} />
                      <p className="text-sm font-medium text-aviva-text truncate">{r.vendor_name}</p>
                      <span className="text-[10px] bg-aviva-gold/10 text-aviva-gold px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {r.category}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-aviva-secondary mt-0.5 truncate">{r.description}</p>
                    )}
                    <p className="text-[10px] text-aviva-secondary/60 mt-0.5">{r.receipt_date} · {r.receipt_number}</p>
                    <div className="mt-1.5">
                      <AttachDocButton entityType="receipt" entityId={r.id} attachedBy={user?.full_name ?? ""} templates={receiptTemplates(r)} />
                    </div>
                  </div>
                  <p className={clsx("text-sm font-bold flex-shrink-0",
                    r.receipt_type === "expense" ? "text-red-400" : "text-green-400")}>
                    {r.receipt_type === "expense" ? "-" : "+"}฿{formatThb(Number(r.amount))}
                  </p>
                </div>
              </GlassCard>
            ))
          }
          {!loading && receipts.length >= acctLimit && (
            <button onClick={() => { const next = acctLimit + 50; setAcctLimit(next); fetchReceipts(next); }}
              className="w-full py-2.5 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-bg hover:border-aviva-gold/30 transition-all mt-1">
              โหลดเพิ่มเติม (แสดง {acctLimit} รายการแล้ว)
            </button>
          )}
        </div>
      </div>
      )}

      {/* Add Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">บันทึกบิล / ใบเสร็จ</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {[
                  { val: "expense", label: "รายจ่าย", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                  { val: "income", label: "รายรับ", color: "bg-green-500/20 text-green-400 border-green-500/30" },
                ].map(({ val, label, color }) => (
                  <button key={val} onClick={() => setForm({ ...form, receipt_type: val })}
                    className={clsx("flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                      form.receipt_type === val ? color : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                    )}>{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">วันที่</label>
                  <input type="date" value={form.receipt_date}
                    onChange={e => setForm({ ...form, receipt_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เลขที่บิล (ถ้ามี)</label>
                  <input type="text" value={form.receipt_number}
                    onChange={e => setForm({ ...form, receipt_number: e.target.value })}
                    placeholder="RC-001"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อผู้ขาย / แหล่งที่มา *</label>
                <input type="text" value={form.vendor_name}
                  onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder="ร้าน / บริษัท / ชื่อ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด</label>
                <input type="text" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="รายละเอียดสินค้า/บริการ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท) *</label>
                  <input type="number" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ACCOUNTING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.vendor_name || !form.amount}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModalAcct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModalAcct === "all" ? "ใบเสร็จทั้งหมด" :
                 kpiModalAcct === "income" ? "รายรับ" : "รายจ่าย"}
                <span className="ml-1.5 text-xs font-normal text-aviva-secondary">
                  ({(kpiModalAcct === "all" ? receipts : receipts.filter(r => r.receipt_type === kpiModalAcct)).length} รายการ)
                </span>
              </h2>
              <button onClick={() => setKpiModalAcct(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {(kpiModalAcct === "all" ? receipts : receipts.filter(r => r.receipt_type === kpiModalAcct)).map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-aviva-text truncate">{r.vendor_name}</p>
                    <p className="text-[10px] text-aviva-secondary">{r.receipt_date} · {r.category}</p>
                  </div>
                  <p className={clsx("text-xs font-bold flex-shrink-0",
                    r.receipt_type === "income" ? "text-green-400" : "text-red-400"
                  )}>{formatM(Number(r.amount))}</p>
                </div>
              ))}
              {(kpiModalAcct === "all" ? receipts : receipts.filter(r => r.receipt_type === kpiModalAcct)).length === 0 && (
                <p className="text-center text-aviva-secondary text-sm py-8">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Marketing ────────────────────────────────────────────────────────────────

interface Campaign {
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

interface MarketingBudget {
  id: string;
  year: number;
  month: number;
  budget_amount: number;
  executive_name: string;
  notes: string;
}

const platformStyle: Record<string, { color: string; bg: string }> = {
  Facebook: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  TikTok:   { color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  Google:   { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
};

const statusStyle: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  ended:  "bg-gray-500/20 text-gray-400",
};

const statusLabel: Record<string, string> = {
  active: "กำลังทำงาน",
  paused: "หยุดชั่วคราว",
  ended:  "สิ้นสุดแล้ว",
};

function roi(campaign: Campaign, avgPrice = 9_500_000) {
  const revenue = campaign.conversions * avgPrice;
  return campaign.spent > 0 ? Math.round((revenue / campaign.spent) * 100) : 0;
}

function cpl(campaign: Campaign) {
  return campaign.leads_generated > 0
    ? Math.round(campaign.spent / campaign.leads_generated).toLocaleString()
    : "—";
}

const emptyCampaignForm = { name: "", platform: "Facebook", budget: "", start_date: "", end_date: "", executive_name: "", campaign_link: "" };

const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function MarketingContent() {
  const user = useCurrentUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [budgets, setBudgets] = useState<MarketingBudget[]>([]);
  const [loading, setLoading] = useState(true);
  // B4: ราคาขายเฉลี่ยจริง (จากลูกค้าที่ปิดการขาย) ใช้คำนวณ ROI แทน hardcode
  const [avgUnitPrice, setAvgUnitPrice] = useState(9_500_000);
  useEffect(() => {
    supabase.from("leads").select("contract_price,budget").eq("project_id", PROJECT_ID).eq("status", "Closed Deal")
      .then(({ data }) => {
        const vals = ((data ?? []) as { contract_price: number | null; budget: number | null }[])
          .map(r => Number(r.contract_price ?? r.budget) || 0).filter(v => v > 0);
        if (vals.length) setAvgUnitPrice(Math.round(vals.reduce((s, v) => s + v, 0) / vals.length));
      });
  }, []);
  const [activeView, setActiveView] = useState<"campaigns" | "budget">("campaigns");
  const [filter, setFilter] = useState<"all" | "Facebook" | "TikTok" | "Google">("all");
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [form, setForm] = useState(emptyCampaignForm);
  const [budgetForm, setBudgetForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, budget_amount: "", executive_name: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [editCampForm, setEditCampForm] = useState({ spent: "", leads_generated: "", impressions: "", clicks: "", conversions: "", status: "active" });
  const [mktPeriod, setMktPeriod] = useState<Period>("month");
  const [mktStart, setMktStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [mktEnd, setMktEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [showMktPRModal, setShowMktPRModal] = useState(false);
  const [mktPRForm, setMktPRForm] = useState({ supplier_name: "", description: "", amount: "", notes: "" });
  const [mktPRSaving, setMktPRSaving] = useState(false);

  const fetchCampaigns = () => {
    let q = supabase.from("campaigns").select("*").eq("project_id", PROJECT_ID);
    if (mktStart) q = q.gte("created_at", mktStart);
    if (mktEnd) q = q.lte("created_at", mktEnd + "T23:59:59");
    q.order("created_at", { ascending: false })
      .then(({ data }) => { setCampaigns((data as Campaign[]) ?? []); setLoading(false); });
  };

  const fetchBudgets = () => {
    supabase.from("marketing_budgets").select("*").eq("project_id", PROJECT_ID)
      .order("year", { ascending: false }).order("month", { ascending: false })
      .then(({ data }) => setBudgets((data as MarketingBudget[]) ?? []));
  };

  useEffect(() => { fetchCampaigns(); fetchBudgets(); }, [mktStart, mktEnd]);

  const openEditCampaign = (c: Campaign) => {
    setEditCampaign(c);
    setEditCampForm({ spent: String(c.spent), leads_generated: String(c.leads_generated), impressions: String(c.impressions ?? 0), clicks: String(c.clicks ?? 0), conversions: String(c.conversions), status: c.status });
  };

  const handleUpdateCampaign = async () => {
    if (!editCampaign) return;
    setSaving(true);
    await supabase.from("campaigns").update({
      spent: Number(editCampForm.spent) || 0,
      leads_generated: Number(editCampForm.leads_generated) || 0,
      impressions: Number(editCampForm.impressions) || 0,
      clicks: Number(editCampForm.clicks) || 0,
      conversions: Number(editCampForm.conversions) || 0,
      status: editCampForm.status,
    }).eq("id", editCampaign.id);
    setSaving(false);
    setEditCampaign(null);
    fetchCampaigns();
  };

  const filtered = filter === "all" ? campaigns : campaigns.filter(c => c.platform === filter);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_generated, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgROI = campaigns.length
    ? Math.round(campaigns.reduce((s, c) => s + roi(c, avgUnitPrice), 0) / campaigns.length)
    : 0;
  const totalBudgetAllocated = budgets.reduce((s, b) => s + Number(b.budget_amount), 0);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await supabase.from("campaigns").insert({
      project_id: PROJECT_ID,
      name: form.name,
      platform: form.platform,
      budget: Number(form.budget) || 0,
      spent: 0,
      leads_generated: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      status: "active",
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      executive_name: form.executive_name || null,
      campaign_link: form.campaign_link || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyCampaignForm);
    fetchCampaigns();
  };

  const handleSaveBudget = async () => {
    if (!budgetForm.budget_amount) return;
    setSaving(true);
    const amt = Number(budgetForm.budget_amount);
    const { data: bud } = await supabase.from("marketing_budgets").upsert({
      project_id: PROJECT_ID,
      year: budgetForm.year,
      month: budgetForm.month,
      budget_amount: amt,
      executive_name: budgetForm.executive_name,
      notes: budgetForm.notes,
    }, { onConflict: "project_id,year,month" }).select("id").single();

    // เข้าสายอนุมัติงบการตลาด (MKTG) — ออกเลขเอกสาร + ส่งผู้บริหารพิจารณา (โผล่ใน /approvals + กล่องงาน)
    const mktgDocNum = await generateDocNumber("MKTG");
    await supabase.from("approval_logs").insert({
      workflow_type: "Marketing_Budget",
      source_doc_index: `${mktgDocNum} | งบการตลาด ${budgetForm.month}/${budgetForm.year} ฿${amt.toLocaleString()} | โดย ${user?.full_name ?? user?.email ?? "ฝ่ายการตลาด"}`,
      submitted_by_user_id: user?.id ?? null,
      source_record_id: bud?.id ?? null,
      current_approver_role: "manager",
      action_taken: "Pending",
      amount: amt,
      sla_due_at: calcSlaDueAt("Marketing_Budget"),
      assigned_to_name: "ผู้จัดการ",
    });
    await createNotification({ type: "approval", title: "ขออนุมัติงบการตลาด", message: `${mktgDocNum} · งบเดือน ${budgetForm.month}/${budgetForm.year} ฿${amt.toLocaleString()}`, from_dept: "ฝ่ายการตลาด", to_dept: "ผู้บริหาร" });
    await logAction("marketing", "request_approval", `ขออนุมัติงบการตลาด ฿${amt.toLocaleString()}`, bud?.id ?? undefined);

    setSaving(false);
    setShowBudgetModal(false);
    setBudgetForm({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, budget_amount: "", executive_name: "", notes: "" });
    fetchBudgets();
  };

  const exportCampaignsCSV = () => {
    const rows = [["ชื่อแคมเปญ", "Platform", "งบ", "ใช้ไป", "Leads", "Conversion", "ROI%", "สถานะ"]];
    campaigns.forEach(c => rows.push([c.name, c.platform, String(c.budget), String(c.spent), String(c.leads_generated), String(c.conversions), String(roi(c, avgUnitPrice)), c.status]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,﻿" + encodeURIComponent(csv); a.download = "campaigns.csv"; a.click();
  };

  const handleCreateMktPR = async () => {
    if (!mktPRForm.supplier_name || !mktPRForm.description) return;
    setMktPRSaving(true);
    const poDocNum = await generateDocNumber("PO");
    const total = Number(mktPRForm.amount) || 0;
    const { data: poData, error: poErr } = await supabase.from("purchase_orders").insert({
      project_id: PROJECT_ID,
      po_number: poDocNum,
      supplier_name: mktPRForm.supplier_name,
      items: [{ name: mktPRForm.description, qty: 1, unit: "รายการ", unit_price: total }],
      total_amount: total,
      status: "draft",
      requested_by: user?.full_name ?? user?.email ?? "Unknown",
      notes: mktPRForm.notes,
    }).select().single();
    if (poErr) { setMktPRSaving(false); return; }
    if (poData) {
      await supabase.from("approval_logs").insert({
        workflow_type: "Material_Purchase",
        source_doc_index: `${poDocNum} | ฝ่ายการตลาด — ${mktPRForm.supplier_name} — ${mktPRForm.description} | โดย ${user?.full_name ?? "Unknown"}`,
        submitted_by_user_id: user?.id ?? null,
        source_record_id: poData.id,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: total,
        sla_due_at: calcSlaDueAt("Material_Purchase"),
        assigned_to_name: "ผู้จัดการ",
      });
      await createNotification({
        type: "approval",
        title: "ขอสั่งซื้อ/จ้างบริการ (ฝ่ายการตลาด)",
        message: `จาก ${user?.full_name ?? "ฝ่ายการตลาด"} · ${mktPRForm.supplier_name}${total > 0 ? ` ฿${total.toLocaleString("th-TH")}` : ""} · ส่งให้ผู้จัดการพิจารณา`,
        from_dept: "ฝ่ายการตลาด",
      });
    }
    setMktPRSaving(false);
    setShowMktPRModal(false);
    setMktPRForm({ supplier_name: "", description: "", amount: "", notes: "" });
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <DeptAIChat dept="marketing" label="AI ฝ่ายการตลาด" />
      <DeptBriefingPanel dept="marketing" label="ฝ่ายการตลาด" />
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-aviva-gold" />
            <span className="text-xs text-aviva-secondary">Leads ทั้งหมด</span>
          </div>
          <p className="text-2xl font-bold text-aviva-text">{loading ? "—" : totalLeads}</p>
        </GlassCard>
        <GlassCard className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-aviva-gold" />
            <span className="text-xs text-aviva-secondary">งบที่ใช้</span>
          </div>
          <p className="text-2xl font-bold text-aviva-text">
            ฿{loading ? "—" : (totalSpent / 1000).toFixed(0)}K
          </p>
        </GlassCard>
        <GlassCard gold className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-aviva-gold" />
            <span className="text-xs text-aviva-secondary">Avg. ROI</span>
          </div>
          <p className="text-2xl font-bold text-aviva-gold">{loading ? "—" : `${avgROI}%`}</p>
        </GlassCard>
        <GlassCard className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={14} className="text-aviva-gold" />
            <span className="text-xs text-aviva-secondary">Conversions</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{loading ? "—" : totalConversions}</p>
        </GlassCard>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setActiveView("campaigns")}
          className={clsx("flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
            activeView === "campaigns" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
          )}>แคมเปญ</button>
        <button onClick={() => setActiveView("budget")}
          className={clsx("flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
            activeView === "budget" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
          )}>งบประมาณ</button>
      </div>

      {activeView === "campaigns" && (
        <>
          <AIInsightPanel type="success" priority="medium"
            title="AI: Facebook ROI สูงสุด"
            message="แคมเปญ Facebook มี ROI เฉลี่ยสูงสุด แนะนำเพิ่มงบอีก 20% และทดสอบ Creative ใหม่ในกลุ่มเป้าหมาย 35-50 ปีครับ" />
          <PeriodFilter period={mktPeriod} onChange={(p, s, e) => { setMktPeriod(p); setMktStart(s); setMktEnd(e); }} />
          <div className="flex gap-2">
            <button onClick={() => setShowModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm">
              <Plus size={16} /> สร้างแคมเปญ
            </button>
            <button onClick={exportCampaignsCSV}
              className="flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary px-3 py-3 rounded-2xl text-xs">
              <Download size={14} /> CSV
            </button>
          </div>
          <button onClick={() => setShowMktPRModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold py-2.5 rounded-2xl text-sm">
            <ShoppingCart size={15} /> ขอสั่งซื้อ/จ้างบริการ
          </button>
          {campaigns.length > 0 && (() => {
            const maxLeads = Math.max(...campaigns.map(c => c.leads_generated || 0), 1);
            return (
              <GlassCard className="p-4">
                <p className="text-xs font-semibold text-aviva-gold mb-3">📊 ประสิทธิภาพแคมเปญ (Leads · งบที่ใช้/งบ)</p>
                <div className="space-y-2.5">
                  {campaigns.slice(0, 8).map(c => {
                    const spentPct = c.budget > 0 ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0;
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-aviva-text truncate max-w-[60%]">{c.name}</span>
                          <span className="text-aviva-secondary">{c.leads_generated || 0} leads · ฿{Number(c.spent).toLocaleString()}/{Number(c.budget).toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-aviva-bg rounded-full overflow-hidden">
                          <div className="h-full bg-aviva-gold rounded-full" style={{ width: `${Math.round(((c.leads_generated || 0) / maxLeads) * 100)}%` }} />
                        </div>
                        <div className="h-1 bg-aviva-bg rounded-full overflow-hidden mt-0.5">
                          <div className={clsx("h-full rounded-full", spentPct > 90 ? "bg-red-400" : "bg-blue-400")} style={{ width: `${spentPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-3 text-[9px] text-aviva-secondary">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-aviva-gold inline-block" /> Leads</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> งบที่ใช้ (% ของงบ)</span>
                </div>
              </GlassCard>
            );
          })()}
          <div>
            <SectionHeader title="แคมเปญ" subtitle="กรองตาม Platform" />
            <div className="flex gap-2 mb-4">
              {(["all", "Facebook", "TikTok", "Google"] as const).map(p => (
                <button key={p} onClick={() => setFilter(p)}
                  className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    filter === p ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                  )}>{p === "all" ? "ทั้งหมด" : p}</button>
              ))}
            </div>
            <div className="space-y-3">
              {loading
                ? [1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl bg-aviva-card/50 animate-pulse" />)
                : filtered.map(c => {
                    const pStyle = platformStyle[c.platform] ?? { color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" };
                    const spentPct = Math.round((c.spent / (c.budget || 1)) * 100);
                    return (
                      <GlassCard key={c.id} className={clsx("p-4 border", pStyle.bg)}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-aviva-text">{c.name}</h3>
                              <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusStyle[c.status] ?? "bg-gray-500/20 text-gray-400")}>
                                {statusLabel[c.status] ?? c.status}
                              </span>
                            </div>
                            <span className={clsx("text-xs font-medium", pStyle.color)}>{c.platform}</span>
                            {c.executive_name && (
                              <p className="text-[10px] text-aviva-secondary mt-0.5">ผู้รับผิดชอบ: {c.executive_name}</p>
                            )}
                            {c.campaign_link && (
                              <a href={c.campaign_link} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-400 underline mt-0.5 inline-block">ดูข้อมูลแคมเปญ</a>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 space-y-1">
                            <p className="text-lg font-bold text-aviva-gold">{roi(c, avgUnitPrice)}%</p>
                            <p className="text-[10px] text-aviva-secondary">ROI</p>
                            <button onClick={() => openEditCampaign(c)}
                              className="text-[10px] bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 px-2 py-0.5 rounded-lg">
                              แก้ไข
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center">
                            <p className="text-sm font-bold text-aviva-text">{c.leads_generated}</p>
                            <p className="text-[10px] text-aviva-secondary">Leads</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-aviva-text">฿{cpl(c)}</p>
                            <p className="text-[10px] text-aviva-secondary">CPL</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-green-400">{c.conversions}</p>
                            <p className="text-[10px] text-aviva-secondary">Conversion</p>
                          </div>
                        </div>
                        <ProgressBar
                          label={`ใช้ไป ฿${(c.spent / 1000).toFixed(0)}K / ฿${(c.budget / 1000).toFixed(0)}K`}
                          value={spentPct} color={spentPct > 90 ? "red" : "gold"} />
                      </GlassCard>
                    );
                  })
              }
            </div>
          </div>
        </>
      )}

      {activeView === "budget" && (
        <>
          <GlassCard gold className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-aviva-secondary">งบประมาณทั้งหมดที่จัดสรร</p>
                <p className="text-2xl font-bold text-aviva-gold">฿{(totalBudgetAllocated / 1000).toFixed(0)}K</p>
              </div>
              <DollarSign size={28} className="text-aviva-gold/40" />
            </div>
          </GlassCard>
          <button onClick={() => setShowBudgetModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm">
            <Plus size={16} /> กำหนดงบประมาณ
          </button>
          <div className="space-y-3">
            <SectionHeader title="งบประมาณรายเดือน" subtitle="กำหนดโดยผู้บริหาร" />
            {budgets.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <p className="text-aviva-secondary text-sm">ยังไม่มีการกำหนดงบ</p>
              </GlassCard>
            ) : budgets.map(b => (
              <GlassCard key={b.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-aviva-text">{MONTH_TH[b.month - 1]} {b.year}</p>
                    {b.executive_name && <p className="text-xs text-aviva-secondary mt-0.5">อนุมัติโดย: {b.executive_name}</p>}
                    {b.notes && <p className="text-[11px] text-aviva-secondary/70 mt-0.5">{b.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-aviva-gold">฿{Number(b.budget_amount).toLocaleString("th-TH")}</p>
                    <p className="text-[10px] text-aviva-secondary">งบที่จัดสรร</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">สร้างแคมเปญใหม่</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อแคมเปญ *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น AVIVA — Facebook Q3 2026"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">Platform</label>
                  <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {["Facebook", "TikTok", "Google", "LINE", "อื่นๆ"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท)</label>
                  <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                    placeholder="50000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้รับผิดชอบ / ผู้อนุมัติ</label>
                <input type="text" value={form.executive_name} onChange={e => setForm({ ...form, executive_name: e.target.value })}
                  placeholder="ชื่อผู้บริหารที่รับผิดชอบ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ลิงก์ข้อมูลแคมเปญ</label>
                <input type="url" value={form.campaign_link} onChange={e => setForm({ ...form, campaign_link: e.target.value })}
                  placeholder="https://docs.google.com/..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">วันเริ่ม</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">วันสิ้นสุด</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.name}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "สร้างแคมเปญ"}
            </button>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">กำหนดงบประมาณ</h2>
              <button onClick={() => setShowBudgetModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ปี</label>
                  <select value={budgetForm.year} onChange={e => setBudgetForm({ ...budgetForm, year: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เดือน</label>
                  <select value={budgetForm.month} onChange={e => setBudgetForm({ ...budgetForm, month: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {MONTH_TH.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท) *</label>
                <input type="number" value={budgetForm.budget_amount} onChange={e => setBudgetForm({ ...budgetForm, budget_amount: e.target.value })}
                  placeholder="100000"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้อนุมัติงบ</label>
                <input type="text" value={budgetForm.executive_name} onChange={e => setBudgetForm({ ...budgetForm, executive_name: e.target.value })}
                  placeholder="ชื่อผู้บริหาร"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={budgetForm.notes} onChange={e => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                  placeholder="รายละเอียดแผนการใช้งบ..."
                  rows={2} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleSaveBudget} disabled={saving || !budgetForm.budget_amount}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกงบประมาณ"}
            </button>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {editCampaign && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">อัปเดตแคมเปญ</h2>
                <p className="text-xs text-aviva-secondary">{editCampaign.name}</p>
              </div>
              <button onClick={() => setEditCampaign(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                <select value={editCampForm.status} onChange={e => setEditCampForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="active">กำลังทำงาน</option>
                  <option value="paused">หยุดชั่วคราว</option>
                  <option value="ended">สิ้นสุดแล้ว</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ยอดใช้จ่าย (฿)</label>
                  <input type="number" value={editCampForm.spent} onChange={e => setEditCampForm(p => ({ ...p, spent: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">Leads ที่ได้</label>
                  <input type="number" value={editCampForm.leads_generated} onChange={e => setEditCampForm(p => ({ ...p, leads_generated: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">Impressions</label>
                  <input type="number" value={editCampForm.impressions} onChange={e => setEditCampForm(p => ({ ...p, impressions: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">Clicks</label>
                  <input type="number" value={editCampForm.clicks} onChange={e => setEditCampForm(p => ({ ...p, clicks: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">Conversions</label>
                  <input type="number" value={editCampForm.conversions} onChange={e => setEditCampForm(p => ({ ...p, conversions: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
            </div>
            <button onClick={handleUpdateCampaign} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกข้อมูลแคมเปญ"}
            </button>
          </div>
        </div>
      )}

      {/* Purchase Request Modal — Marketing */}
      {showMktPRModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ขอสั่งซื้อ/จ้างบริการ</h2>
              <button onClick={() => setShowMktPRModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้จำหน่าย / บริษัทรับจ้าง *</label>
                <input type="text" value={mktPRForm.supplier_name} onChange={e => setMktPRForm(p => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="ชื่อร้าน / บริษัท"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายการที่ต้องการ *</label>
                <input type="text" value={mktPRForm.description} onChange={e => setMktPRForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="เช่น ค่าจ้างทำกราฟิก, ค่าโฆษณา Facebook"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท)</label>
                <input type="number" value={mktPRForm.amount} onChange={e => setMktPRForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={mktPRForm.notes} onChange={e => setMktPRForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม"
                  rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleCreateMktPR} disabled={mktPRSaving || !mktPRForm.supplier_name || !mktPRForm.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {mktPRSaving ? "กำลังส่งคำขอ..." : "ส่งคำขออนุมัติ"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HR ───────────────────────────────────────────────────────────────────────

interface Employee {
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
}

const DEPARTMENTS = ["ฝ่ายขาย", "ฝ่ายก่อสร้าง", "ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายบุคคล", "ฝ่ายบริหาร"];

const deptColor: Record<string, string> = {
  "ฝ่ายขาย":     "bg-blue-500/20 text-blue-400",
  "ฝ่ายก่อสร้าง": "bg-orange-500/20 text-orange-400",
  "ฝ่ายการเงิน":  "bg-green-500/20 text-green-400",
  "ฝ่ายบัญชี":   "bg-purple-500/20 text-purple-400",
  "ฝ่ายบุคคล":   "bg-pink-500/20 text-pink-400",
  "ฝ่ายบริหาร":  "bg-aviva-gold/20 text-aviva-gold",
};

const emptyEmployeeForm = {
  full_name: "",
  nickname: "",
  phone: "",
  email: "",
  department: "ฝ่ายขาย",
  position: "",
  base_salary: "",
  commission_rate: "",
  start_date: today,
};

function HRContent() {
  const user = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyEmployeeForm);
  const [saving, setSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [filterDept, setFilterDept] = useState("ทั้งหมด");
  const [kpiModalHR, setKpiModalHR] = useState<"employees" | "probation" | "salary" | null>(null);
  const [hrTab, setHrTab] = useState<"บุคคล" | "เงินเดือน" | "การลา">("บุคคล");
  const [leaveForm, setLeaveForm] = useState({ employee_name: "", leave_type: "ลาพักร้อน", date_from: "", date_to: "", reason: "" });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveList, setLeaveList] = useState<{id:string;employee_name:string;leave_type:string;date_from:string;date_to:string;reason:string;status:string;created_at:string}[]>([]);
  const [hrToast, setHrToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showPRModal, setShowPRModal] = useState(false);
  const [prForm, setPrForm] = useState({ supplier_name: "", description: "", amount: "", notes: "" });
  const [prSaving, setPrSaving] = useState(false);

  const fetchEmployees = () => {
    supabase.from("employees").select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEmployees((data as Employee[]) ?? []);
        setLoading(false);
      });
  };

  const fetchLeave = () => {
    setLeaveLoading(true);
    // C4: sync สถานะล่าสุดจาก approval_logs ให้ตรงกับหน้า /approvals
    Promise.all([
      supabase.from("leave_requests").select("id,employee_name,leave_type,date_from,date_to,reason,status,created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("approval_logs").select("source_record_id,action_taken").eq("workflow_type", "Leave_Request"),
    ]).then(([lvRes, apRes]) => {
      const apMap: Record<string, string> = {};
      ((apRes.data ?? []) as { source_record_id: string | null; action_taken: string }[]).forEach(a => { if (a.source_record_id) apMap[a.source_record_id] = a.action_taken; });
      const merged = ((lvRes.data ?? []) as typeof leaveList).map(l => {
        const act = apMap[l.id];
        const synced = act === "Approved" ? "approved" : act === "Rejected" ? "rejected" : act === "Pending" ? "pending" : l.status;
        return { ...l, status: synced };
      });
      setLeaveList(merged);
      setLeaveLoading(false);
    });
  };

  useEffect(() => { fetchEmployees(); }, []);

  useEffect(() => { if (hrTab === "การลา") fetchLeave(); }, [hrTab]);

  const handleLeaveSubmit = async () => {
    if (!leaveForm.employee_name || !leaveForm.date_from || !leaveForm.date_to) return;
    setLeaveSaving(true);
    // Check for overlapping leave requests
    const { data: overlap } = await supabase.from("leave_requests")
      .select("id,date_from,date_to")
      .eq("employee_name", leaveForm.employee_name)
      .lte("date_from", leaveForm.date_to)
      .gte("date_to", leaveForm.date_from)
      .eq("status", "pending");
    if (overlap && overlap.length > 0) {
      setHrToast({ msg: `${leaveForm.employee_name} มีคำขอลาในช่วง ${overlap[0].date_from} – ${overlap[0].date_to} อยู่แล้ว`, type: "error" });
      setLeaveSaving(false);
      return;
    }
    const days = Math.max(1, Math.ceil((new Date(leaveForm.date_to).getTime() - new Date(leaveForm.date_from).getTime()) / 86400000) + 1);
    // C3: เตือน/บล็อกเมื่อยื่นลาเกินสิทธิต่อปี (สะสมจากใบลาที่อนุมัติแล้ว + ที่ขอใหม่)
    const quota = LEAVE_QUOTA[leaveForm.leave_type];
    if (quota != null) {
      const usedSoFar = leaveList
        .filter(l => l.employee_name === leaveForm.employee_name && l.leave_type === leaveForm.leave_type && l.status === "approved")
        .reduce((s, l) => s + leaveDays(l.date_from, l.date_to), 0);
      if (usedSoFar + days > quota) {
        setHrToast({ msg: `เกินสิทธิ ${leaveForm.leave_type} (${quota} วัน/ปี) — ใช้ไปแล้ว ${usedSoFar} + ขอใหม่ ${days} = ${usedSoFar + days} วัน`, type: "error" });
        setLeaveSaving(false);
        return;
      }
    }
    try {
      await createLeaveRequest({
        employeeName: leaveForm.employee_name,
        leaveType: leaveForm.leave_type,
        dateFrom: leaveForm.date_from,
        dateTo: leaveForm.date_to,
        reason: leaveForm.reason,
        userId: user?.id ?? null,
      });
    } catch (e) {
      setHrToast({ msg: e instanceof Error ? e.message : "ยื่นใบลาไม่สำเร็จ", type: "error" });
      setLeaveSaving(false);
      return;
    }
    setLeaveSaving(false);
    setLeaveForm({ employee_name: "", leave_type: "ลาพักร้อน", date_from: "", date_to: "", reason: "" });
    fetchLeave();
  };

  const active = employees.filter(e => e.status === "active");
  const filtered = filterDept === "ทั้งหมด" ? employees : employees.filter(e => e.department === filterDept);

  const probationAlerts = active.flatMap(e => {
    if (!e.start_date) return [];
    const days = Math.floor((Date.now() - new Date(e.start_date).getTime()) / 86400000);
    return days >= 80 && days <= 180 ? [{ ...e, probationDays: days }] : [];
  });

  const handleSave = async () => {
    if (!form.full_name) return;
    setSaving(true);
    if (editingEmployee) {
      await supabase.from("employees").update({
        full_name: form.full_name,
        nickname: form.nickname,
        phone: form.phone,
        email: form.email,
        department: form.department,
        position: form.position,
        base_salary: Number(form.base_salary) || 0,
        commission_rate: Number(form.commission_rate) || 0,
      }).eq("id", editingEmployee.id);
      await logAction("hr", "edit_employee", `แก้ไขข้อมูลพนักงาน ${form.full_name}`);
    } else {
      const empCode = `EMP-${new Date().getFullYear() % 100}${String(Date.now()).slice(-4)}`;
      await supabase.from("employees").insert({
        full_name: form.full_name,
        nickname: form.nickname,
        phone: form.phone,
        email: form.email,
        department: form.department,
        position: form.position,
        base_salary: Number(form.base_salary) || 0,
        commission_rate: Number(form.commission_rate) || 0,
        start_date: form.start_date,
        employee_code: empCode,
        status: "active",
      });
      await logAction("hr", "add_employee", `รับพนักงานใหม่ ${form.full_name} (${empCode}) ${form.department}`);
      await createNotification({ type: "info", title: `พนักงานใหม่เข้าทำงาน — ${form.full_name}`, message: `${empCode} · ${form.department}${form.position ? ` · ${form.position}` : ""} · เริ่ม ${form.start_date}`, from_dept: "ฝ่ายบุคคล", to_dept: "ผู้บริหาร" });
    }
    setSaving(false);
    setShowModal(false);
    setEditingEmployee(null);
    setForm(emptyEmployeeForm);
    fetchEmployees();
  };

  // คนออก — บันทึกการพ้นสภาพ (ลาออก/เลิกจ้าง) พร้อมวันที่+เหตุผล
  const offboardEmployee = async (emp: Employee) => {
    const reason = window.prompt(`บันทึกการพ้นสภาพของ ${emp.full_name}\nระบุเหตุผล (ลาออก / เลิกจ้าง / เกษียณ / อื่นๆ):`, "ลาออก");
    if (reason === null) return;
    const today = new Date().toISOString().split("T")[0];
    setSaving(true);
    const { error } = await supabase.from("employees").update({
      status: "resigned", end_date: today, exit_reason: reason || null,
      updated_at: new Date().toISOString(), updated_by: user?.full_name ?? user?.email ?? null,
    }).eq("id", emp.id);
    setSaving(false);
    if (error) { setHrToast({ msg: "บันทึกไม่สำเร็จ: " + error.message, type: "error" }); return; }
    await logAction("hr", "offboard_employee", `พ้นสภาพ ${emp.full_name} — ${reason || "-"} (${today})`);
    await createNotification({ type: "info", title: `พนักงานพ้นสภาพ — ${emp.full_name}`, message: `${emp.department}${emp.position ? ` · ${emp.position}` : ""} · ${reason || ""} · วันสุดท้าย ${today}`, from_dept: "ฝ่ายบุคคล", to_dept: "ผู้บริหาร" });
    setShowModal(false); setEditingEmployee(null); setForm(emptyEmployeeForm);
    fetchEmployees();
  };

  // คืนสภาพพนักงาน (กรณีกลับเข้าทำงาน/แก้ไขผิดพลาด)
  const reactivateEmployee = async (emp: Employee) => {
    setSaving(true);
    const { error } = await supabase.from("employees").update({
      status: "active", end_date: null, exit_reason: null,
      updated_at: new Date().toISOString(), updated_by: user?.full_name ?? user?.email ?? null,
    }).eq("id", emp.id);
    setSaving(false);
    if (error) { setHrToast({ msg: "ไม่สำเร็จ: " + error.message, type: "error" }); return; }
    await logAction("hr", "reactivate_employee", `คืนสภาพพนักงาน ${emp.full_name}`);
    setShowModal(false); setEditingEmployee(null); setForm(emptyEmployeeForm);
    fetchEmployees();
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      full_name: emp.full_name,
      nickname: emp.nickname ?? "",
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      department: emp.department,
      position: emp.position ?? "",
      base_salary: String(emp.base_salary ?? ""),
      commission_rate: String(emp.commission_rate ?? ""),
      start_date: emp.start_date ?? today,
    });
    setShowModal(true);
  };

  const handleCreateHRPR = async () => {
    if (!prForm.supplier_name || !prForm.description) return;
    setPrSaving(true);
    const poDocNum = await generateDocNumber("PO");
    const total = Number(prForm.amount) || 0;
    const { data: poData, error: poErr } = await supabase.from("purchase_orders").insert({
      project_id: PROJECT_ID,
      po_number: poDocNum,
      supplier_name: prForm.supplier_name,
      items: [{ name: prForm.description, qty: 1, unit: "รายการ", unit_price: total }],
      total_amount: total,
      status: "draft",
      requested_by: user?.full_name ?? user?.email ?? "Unknown",
      notes: prForm.notes,
    }).select().single();
    if (poErr) { setPrSaving(false); return; }
    if (poData) {
      await supabase.from("approval_logs").insert({
        workflow_type: "Material_Purchase",
        source_doc_index: `${poDocNum} | ฝ่ายบุคคล — ${prForm.supplier_name} — ${prForm.description} | โดย ${user?.full_name ?? "Unknown"}`,
        submitted_by_user_id: user?.id ?? null,
        source_record_id: poData.id,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: total,
        sla_due_at: calcSlaDueAt("Material_Purchase"),
        assigned_to_name: "ผู้จัดการ",
      });
      await createNotification({
        type: "approval",
        title: "ขอสั่งซื้ออุปกรณ์สำนักงาน (ฝ่ายบุคคล)",
        message: `จาก ${user?.full_name ?? "ฝ่ายบุคคล"} · ${prForm.supplier_name}${total > 0 ? ` ฿${total.toLocaleString("th-TH")}` : ""} · ส่งให้ผู้จัดการพิจารณา`,
        from_dept: "ฝ่ายบุคคล",
      });
    }
    setPrSaving(false);
    setShowPRModal(false);
    setPrForm({ supplier_name: "", description: "", amount: "", notes: "" });
    setHrToast({ msg: "ส่งคำขออนุมัติแล้ว", type: "success" });
  };

  return (
    <>
      {hrToast && <Toast message={hrToast.msg} type={hrToast.type} onClose={() => setHrToast(null)} />}
      <div className="px-4 pt-4 pb-0 max-w-lg mx-auto">
        <DeptAIChat dept="hr" label="AI ฝ่ายบุคคล" />
        <DeptBriefingPanel dept="hr" label="ฝ่ายบุคคล" />
        <div className="mt-3 flex gap-2">
          {(["บุคคล", "เงินเดือน", "การลา"] as const).map(t => (
            <button key={t} onClick={() => setHrTab(t)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                hrTab === t ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{t}</button>
          ))}
        </div>
      </div>

      {hrTab === "เงินเดือน" && <PayrollContent />}

      {hrTab === "การลา" && (
        <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
          <GlassCard className="p-4 space-y-3">
            <p className="text-sm font-semibold text-aviva-text">ยื่นคำขอลา</p>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ชื่อพนักงาน *</label>
              <select value={leaveForm.employee_name} onChange={e => setLeaveForm({...leaveForm, employee_name: e.target.value})}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                <option value="">— เลือกพนักงาน —</option>
                {employees.filter(e => e.status === "active").map(e => (
                  <option key={e.id} value={e.full_name}>{e.full_name} ({e.department})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ประเภทการลา</label>
              <select value={leaveForm.leave_type} onChange={e => setLeaveForm({...leaveForm, leave_type: e.target.value})}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                {["ลาพักร้อน","ลาป่วย","ลากิจ","ลาครอบครัว","ลาอื่นๆ"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่เริ่มลา</label>
                <input type="date" value={leaveForm.date_from} onChange={e => setLeaveForm({...leaveForm, date_from: e.target.value})}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่กลับ</label>
                <input type="date" value={leaveForm.date_to} onChange={e => setLeaveForm({...leaveForm, date_to: e.target.value})}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">เหตุผล</label>
              <input type="text" value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                placeholder="ระบุเหตุผล (ถ้ามี)"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <button onClick={handleLeaveSubmit} disabled={leaveSaving || !leaveForm.employee_name || !leaveForm.date_from || !leaveForm.date_to}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
              {leaveSaving ? "กำลังส่ง..." : "ส่งคำขอลา"}
            </button>
          </GlassCard>
          <div className="flex items-center justify-between">
            <SectionHeader title="ประวัติคำขอลา" />
            {leaveList.length > 0 && (
              <button onClick={() => downloadCsv(`leave-requests-${new Date().toISOString().slice(0, 10)}`,
                ["พนักงาน", "ประเภทลา", "ตั้งแต่", "ถึง", "เหตุผล", "สถานะ", "วันที่ยื่น"],
                leaveList.map(l => [l.employee_name, l.leave_type, l.date_from, l.date_to, l.reason, l.status, l.created_at ? new Date(l.created_at).toLocaleDateString("th-TH") : ""]))}
                className="bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-[11px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0">
                CSV
              </button>
            )}
          </div>
          {leaveLoading ? <div className="h-12 rounded-xl bg-aviva-card/50 animate-pulse" /> : leaveList.length === 0 ? (
            <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีคำขอลา</p></GlassCard>
          ) : (() => {
            const used: Record<string, number> = {};
            leaveList.filter(x => x.status === "approved").forEach(x => {
              const k = `${x.employee_name}|${x.leave_type}`;
              used[k] = (used[k] ?? 0) + leaveDays(x.date_from, x.date_to);
            });
            return leaveList.map(l => {
              const quota = LEAVE_QUOTA[l.leave_type];
              const u = used[`${l.employee_name}|${l.leave_type}`] ?? 0;
              const over = quota != null && u > quota;
              return (
                <GlassCard key={l.id} dataFocus={l.id} className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-aviva-text truncate">{l.employee_name}</p>
                      <p className="text-[10px] text-aviva-secondary">{l.leave_type} · {l.date_from} – {l.date_to}</p>
                      {quota != null && (
                        <p className={clsx("text-[10px] mt-0.5", over ? "text-red-400 font-semibold" : "text-aviva-secondary/70")}>
                          {l.leave_type}สะสม {u}/{quota} วัน{over ? " ⚠ เกินสิทธิ์" : ""}
                        </p>
                      )}
                    </div>
                    <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0",
                      l.status === "approved" ? "bg-green-500/20 text-green-400" :
                      l.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                    )}>{l.status === "approved" ? "อนุมัติ" : l.status === "rejected" ? "ปฏิเสธ" : "รออนุมัติ"}</span>
                  </div>
                  <div className="mt-1.5">
                    <AttachDocButton entityType="leave_request" entityId={l.id} attachedBy={user?.full_name ?? ""} templates={leaveTemplates(l)} />
                  </div>
                </GlassCard>
              );
            });
          })()}
        </div>
      )}

      {hrTab === "บุคคล" && (
      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setKpiModalHR("employees")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <Users size={14} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-xl font-bold text-aviva-text">{active.length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">พนักงานทั้งหมด</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModalHR("probation")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <Clock size={14} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-yellow-400">{probationAlerts.length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">ทดลองงาน</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModalHR("salary")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard gold className="p-3 text-center">
            <DollarSign size={14} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-xl font-bold text-aviva-gold">
              {formatM(active.reduce((s, e) => s + Number(e.base_salary), 0))}
            </p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">เงินเดือนรวม</p>
          </GlassCard>
        </button>
      </div>

      <AIInsightPanel
        type="warning"
        priority="medium"
        title="AI: Probation Alert"
        message="ตรวจสอบพนักงานทดลองงานที่ใกล้ครบกำหนด ดำเนินการประเมินและออกเอกสารก่อน 120 วัน"
      />

      {probationAlerts.length > 0 && (
        <GlassCard className="p-3 border border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-yellow-400">แจ้งเตือน Probation ครบ 80 วัน</p>
              <div className="mt-1 space-y-0.5">
                {probationAlerts.map(e => (
                  <p key={e.id} className="text-[11px] text-yellow-400/80">
                    {e.full_name} · {e.department} · {e.probationDays} วัน
                  </p>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Add button + Export */}
      <div className="flex gap-2">
        <button onClick={() => setShowModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm">
          <Plus size={16} /> เพิ่มพนักงาน
        </button>
        <button onClick={() => {
          const rows = [["ชื่อ","ฝ่าย","ตำแหน่ง","เงินเดือน","สถานะ","วันเริ่มงาน"]];
          employees.forEach(e => rows.push([e.full_name, e.department, e.position, String(e.base_salary), e.status, e.start_date]));
          const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
          const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,﻿" + encodeURIComponent(csv); a.download = "employees.csv"; a.click();
        }} className="flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary px-3 py-3 rounded-2xl text-xs">
          <Download size={14} /> CSV
        </button>
      </div>
      <button onClick={() => setShowPRModal(true)}
        className="w-full flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold py-2.5 rounded-2xl text-sm">
        <ShoppingCart size={15} /> ขอสั่งซื้ออุปกรณ์สำนักงาน
      </button>

      {/* Dept Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {["ทั้งหมด", ...DEPARTMENTS].map(dept => (
          <button key={dept} onClick={() => setFilterDept(dept)}
            className={clsx("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              filterDept === dept
                ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{dept}</button>
        ))}
      </div>

      {/* Employee List */}
      <div>
        <SectionHeader title="รายชื่อพนักงาน" subtitle={loading ? "กำลังโหลด..." : `${filtered.length} คน`} />
        <div className="space-y-3">
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            : filtered.length === 0
            ? (
              <GlassCard className="p-8 text-center">
                <Users size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีพนักงาน</p>
              </GlassCard>
            )
            : filtered.map(emp => (
              <GlassCard key={emp.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-aviva-gold font-bold text-sm">
                      {emp.nickname || emp.full_name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {emp.employee_code && (
                        <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-md border border-aviva-gold/20 flex-shrink-0">{emp.employee_code}</span>
                      )}
                      <p className="text-sm font-semibold text-aviva-text">{emp.full_name}</p>
                      {emp.nickname && <span className="text-xs text-aviva-secondary">({emp.nickname})</span>}
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full",
                        deptColor[emp.department] ?? "bg-gray-500/20 text-gray-400")}>
                        {emp.department}
                      </span>
                    </div>
                    {emp.position && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Briefcase size={10} className="text-aviva-secondary" />
                        <p className="text-xs text-aviva-secondary">{emp.position}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {emp.phone && (
                        <span className="flex items-center gap-1 text-xs text-aviva-secondary">
                          <Phone size={10} />{emp.phone}
                        </span>
                      )}
                      {emp.base_salary > 0 && (
                        <span className="text-xs text-aviva-gold font-medium">
                          ฿{formatThb(emp.base_salary)}/เดือน
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={clsx("text-[10px] px-2 py-1 rounded-full",
                      emp.status === "active"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-400"
                    )}>
                      {emp.status === "active" ? "ทำงานอยู่" : "ลาออก"}
                    </span>
                    {(user?.isAdmin || user?.isManager) && (
                      <button onClick={() => openEditEmployee(emp)}
                        className="text-[10px] px-2 py-1 rounded-lg bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 flex items-center gap-1">
                        <Pencil size={9} /> แก้ไข
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))
          }
        </div>
      </div>
      </div>
      )}

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">{editingEmployee ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงาน"}</h2>
              <button onClick={() => { setShowModal(false); setEditingEmployee(null); setForm(emptyEmployeeForm); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ชื่อ-นามสกุล *</label>
                  <input type="text" value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="ชื่อจริง นามสกุล"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเล่น</label>
                  <input type="text" value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    placeholder="ชื่อเล่น"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร</label>
                <input type="tel" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">Email</label>
                <input type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ฝ่าย</label>
                  <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ตำแหน่ง</label>
                  <input type="text" value={form.position}
                    onChange={e => setForm({ ...form, position: e.target.value })}
                    placeholder="เช่น พนักงานขาย"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เงินเดือน (บาท)</label>
                  <input type="number" value={form.base_salary}
                    onChange={e => setForm({ ...form, base_salary: e.target.value })}
                    placeholder="15000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ค่าคอม (%)</label>
                  <input type="number" value={form.commission_rate}
                    onChange={e => setForm({ ...form, commission_rate: e.target.value })}
                    placeholder="1.5" step="0.1"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันเริ่มงาน</label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.full_name}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : editingEmployee ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}
            </button>
            {editingEmployee && (
              editingEmployee.status === "active" ? (
                <button onClick={() => offboardEmployee(editingEmployee)} disabled={saving}
                  className="w-full bg-red-500/15 text-red-400 border border-red-500/30 font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
                  บันทึกการพ้นสภาพ (ลาออก/เลิกจ้าง)
                </button>
              ) : (
                <button onClick={() => reactivateEmployee(editingEmployee)} disabled={saving}
                  className="w-full bg-green-500/15 text-green-400 border border-green-500/30 font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
                  คืนสภาพ (กลับเข้าทำงาน)
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModalHR && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModalHR === "employees" ? "พนักงานทั้งหมด" :
                 kpiModalHR === "probation" ? "ทดลองงาน" : "เงินเดือนรวมแยกฝ่าย"}
                {kpiModalHR !== "salary" && (
                  <span className="ml-1.5 text-xs font-normal text-aviva-secondary">
                    ({kpiModalHR === "probation" ? probationAlerts.length : active.length} คน)
                  </span>
                )}
              </h2>
              <button onClick={() => setKpiModalHR(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {kpiModalHR === "salary" ? (
                Object.entries(
                  active.reduce((acc, e) => {
                    const dept = e.department || "ไม่ระบุ";
                    acc[dept] = (acc[dept] || 0) + Number(e.base_salary);
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).map(([dept, total]) => (
                  <div key={dept} className="flex items-center justify-between p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                    <p className="text-xs font-semibold text-aviva-text">{dept}</p>
                    <p className="text-xs font-bold text-aviva-gold">{formatM(total)}</p>
                  </div>
                ))
              ) : (
                (kpiModalHR === "probation"
                  ? probationAlerts.map(e => ({ ...e }))
                  : active
                ).map(e => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                    {e.employee_code && (
                      <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded border border-aviva-gold/20 flex-shrink-0">
                        {e.employee_code}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-aviva-text truncate">{e.full_name}</p>
                      <p className="text-[10px] text-aviva-secondary">{e.department} · {e.position}</p>
                    </div>
                    <p className="text-xs font-bold text-aviva-gold flex-shrink-0">{formatM(Number(e.base_salary))}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purchase Request Modal — HR */}
      {showPRModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ขอสั่งซื้ออุปกรณ์สำนักงาน</h2>
              <button onClick={() => setShowPRModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้จำหน่าย / ร้านค้า *</label>
                <input type="text" value={prForm.supplier_name} onChange={e => setPrForm(p => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="ชื่อร้าน / บริษัท"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายการที่ต้องการ *</label>
                <input type="text" value={prForm.description} onChange={e => setPrForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="เช่น กระดาษ A4 x 10 รีม, ปากกา x 20 ด้าม"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท)</label>
                <input type="number" value={prForm.amount} onChange={e => setPrForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={prForm.notes} onChange={e => setPrForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม"
                  rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleCreateHRPR} disabled={prSaving || !prForm.supplier_name || !prForm.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {prSaving ? "กำลังส่งคำขอ..." : "ส่งคำขออนุมัติ"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── After Sales ──────────────────────────────────────────────────────────────

interface Claim {
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

type FilterStatus = "all" | "pending" | "in_progress" | "resolved";

const statusConfig = {
  pending:     { label: "รอดำเนินการ", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  in_progress: { label: "กำลังดำเนินการ", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  resolved:    { label: "เสร็จสิ้น", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
};

const issueColor: Record<string, string> = {
  Plumbing:   "bg-blue-500/20 text-blue-400",
  Electrical: "bg-yellow-500/20 text-yellow-400",
  Structure:  "bg-red-500/20 text-red-400",
  Paint:      "bg-purple-500/20 text-purple-400",
  Other:      "bg-gray-500/20 text-gray-400",
};

const issueTh: Record<string, string> = {
  Plumbing:   "ท่อน้ำ",
  Electrical: "ไฟฟ้า",
  Structure:  "โครงสร้าง",
  Paint:      "สีและทาสี",
  Other:      "อื่นๆ",
};

const ISSUE_TYPES = ["Plumbing", "Electrical", "Structure", "Paint", "Other"];
const ASSIGNED_TO_OPTIONS = ["พี่ท (วิศวกร)", "ผู้รับเหมา A", "ผู้รับเหมา B", "ทีมช่างทั่วไป"];

const emptyClaimForm = {
  customer_name: "",
  house_number: "",
  issue_type: "Other",
  description: "",
  assigned_to: "พี่ท (วิศวกร)",
  scheduled_date: "",
  status: "pending" as Claim["status"],
};

function AfterSalesContent() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState(emptyClaimForm);
  const [saving, setSaving] = useState(false);
  const [kpiModalAS, setKpiModalAS] = useState<"all" | "pending" | "in_progress" | "resolved" | null>(null);
  const [resolveScore, setResolveScore] = useState<number | null>(null);

  const fetchClaims = () => {
    supabase.from("warranty_claims").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setClaims((data as Claim[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchClaims(); }, []);

  // UX-10: ดึงผู้รับผิดชอบจากพนักงานฝ่ายก่อสร้าง (fallback เป็นรายการเริ่มต้นถ้าไม่มีข้อมูล)
  const [assignees, setAssignees] = useState<string[]>(ASSIGNED_TO_OPTIONS);
  useEffect(() => {
    supabase.from("employees").select("full_name").eq("status", "active").eq("department", "ฝ่ายก่อสร้าง")
      .then(({ data }) => {
        const names = ((data ?? []) as { full_name: string }[]).map(e => e.full_name).filter(Boolean);
        if (names.length) setAssignees(names);
      });
  }, []);

  // ผูกกับแปลงจริง (เลิก free-text) เพื่อวิเคราะห์ defect/เคลมต่อแปลงได้
  const [houseOpts, setHouseOpts] = useState<{ plot_number: number | null; house_number: string }[]>([]);
  useEffect(() => {
    supabase.from("houses").select("plot_number,house_number").eq("project_id", PROJECT_ID).order("plot_number")
      .then(({ data }) => setHouseOpts((data ?? []) as { plot_number: number | null; house_number: string }[]));
  }, []);

  const counts = {
    pending:     claims.filter(c => c.status === "pending").length,
    in_progress: claims.filter(c => c.status === "in_progress").length,
    resolved:    claims.filter(c => c.status === "resolved").length,
  };

  const avgSatisfaction = (() => {
    const scored = claims.filter(c => c.satisfaction_score !== null);
    if (!scored.length) return null;
    return (scored.reduce((s, c) => s + (c.satisfaction_score ?? 0), 0) / scored.length).toFixed(1);
  })();

  const filtered = filter === "all" ? claims : claims.filter(c => c.status === filter);

  const handleSave = async () => {
    if (!form.customer_name || !form.description) return;
    setSaving(true);
    const docNum = await generateDocNumber("WR");
    await supabase.from("warranty_claims").insert({
      project_id: PROJECT_ID,
      doc_number: docNum,
      customer_name: form.customer_name,
      house_number: form.house_number || null,
      issue_type: form.issue_type,
      description: form.description,
      assigned_to: form.assigned_to,
      scheduled_date: form.scheduled_date || null,
      status: form.status,
    });
    await createNotification({
      type: "claim",
      title: `แจ้งซ่อมใหม่ — ${docNum}`,
      message: `${form.customer_name} — ${issueTh[form.issue_type] ?? form.issue_type}: ${form.description} · ผู้รับผิดชอบ: ${form.assigned_to}`,
      from_dept: "ฝ่ายหลังการขาย",
      to_dept: "ฝ่ายก่อสร้าง",
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyClaimForm);
    fetchClaims();
  };

  const handleUpdateStatus = async (id: string, newStatus: Claim["status"]) => {
    const claim = claims.find(c => c.id === id);
    // C5: บังคับให้คะแนนความพึงพอใจก่อนปิดงาน (กันค่า null ทำให้ค่าเฉลี่ยไม่ครบ)
    if (newStatus === "resolved" && !resolveScore) {
      if (typeof window !== "undefined") window.alert("กรุณาให้คะแนนความพึงพอใจลูกค้า (1-5 ดาว) ก่อนปิดงาน");
      return;
    }
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "resolved" && resolveScore) updateData.satisfaction_score = resolveScore;
    await supabase.from("warranty_claims").update(updateData).eq("id", id);
    const statusTh: Record<string, string> = { pending: "รอดำเนินการ", in_progress: "กำลังดำเนินการ", resolved: "แก้ไขแล้ว" };
    if (claim) {
      await createNotification({
        type: newStatus === "resolved" ? "success" : "info",
        title: `${statusTh[newStatus] ?? newStatus} — แจ้งซ่อม`,
        message: `${claim.issue_type}: ${claim.description ?? ""} — ${claim.customer_name}`,
        from_dept: "ฝ่ายหลังการขาย",
        to_dept: "ฝ่ายหลังการขาย",
      });
    }
    setSelectedClaim(null);
    setResolveScore(null);
    fetchClaims();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <DeptAIChat dept="after-sales" label="AI ฝ่ายหลังการขาย" />
      <DeptBriefingPanel dept="after-sales" label="ฝ่ายหลังการขาย" />
      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { label: "ทั้งหมด", value: claims.length, color: "text-aviva-text", filter: "all" as const },
          { label: "รอดำเนินการ", value: counts.pending, color: "text-yellow-400", filter: "pending" as const },
          { label: "กำลังทำ", value: counts.in_progress, color: "text-blue-400", filter: "in_progress" as const },
        ]).map(({ label, value, color, filter }) => (
          <button key={label} onClick={() => setKpiModalAS(filter)} className="active:scale-[0.96] transition-transform w-full text-left">
            <GlassCard className="p-3 text-center">
              <p className={clsx("text-xl font-bold", color)}>{loading ? "—" : value}</p>
              <p className="text-[10px] text-aviva-secondary mt-0.5">{label}</p>
            </GlassCard>
          </button>
        ))}
        <button onClick={() => setKpiModalAS("resolved")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard gold className="p-3 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <Star size={12} className="text-aviva-gold" />
              <p className="text-xl font-bold text-aviva-gold">{avgSatisfaction ?? "—"}</p>
            </div>
            <p className="text-[10px] text-aviva-secondary">Satisfaction</p>
          </GlassCard>
        </button>
      </div>

      <AIInsightPanel
        type="alert"
        priority="high"
        title="AI: Claims รออนุมัติ"
        message="Claims ที่ค้างเกิน 7 วันควรได้รับการดำเนินการทันที ตรวจสอบสาเหตุและมอบหมายผู้รับผิดชอบให้ชัดเจน"
      />

      {/* Add + Export */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
        >
          <Plus size={16} /> แจ้งซ่อม
        </button>
        <button
          onClick={() => downloadCsv(`warranty-claims-${new Date().toISOString().slice(0, 10)}`,
            ["ลูกค้า", "บ้านเลขที่", "ประเภท", "รายละเอียด", "สถานะ", "ผู้รับผิดชอบ", "นัดวันที่", "คะแนนพอใจ", "วันที่แจ้ง"],
            claims.map(c => [c.customer_name, c.house_number, c.issue_type, c.description, c.status, c.assigned_to, c.scheduled_date, c.satisfaction_score, c.created_at ? new Date(c.created_at).toLocaleDateString("th-TH") : ""]))}
          className="px-4 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary font-bold rounded-2xl text-xs"
        >
          CSV
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "in_progress", "resolved"] as FilterStatus[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              filter === f ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>
            {f === "all" ? "ทั้งหมด" : statusConfig[f].label.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Claims List */}
      <div>
        <SectionHeader title={`เคส (${filtered.length})`} subtitle="แตะเพื่ออัปเดตสถานะ" />
        <div className="space-y-3">
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            : filtered.length === 0
            ? <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ไม่มีเคสในสถานะนี้</p></GlassCard>
            : filtered.map(claim => {
                const sConf = statusConfig[claim.status];
                const Icon = sConf.icon;
                return (
                  <GlassCard key={claim.id}
                    className={clsx("p-4 border cursor-pointer active:scale-[0.98] transition-transform", sConf.bg)}
                    onClick={() => setSelectedClaim(claim)}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5"><Icon size={16} className={sConf.color} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-sm font-semibold text-aviva-text">{claim.customer_name}</h3>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", issueColor[claim.issue_type])}>
                              {issueTh[claim.issue_type] ?? claim.issue_type}
                            </span>
                            {claim.house_number && <span className="text-[10px] text-aviva-secondary bg-aviva-bg px-1.5 py-0.5 rounded-full border border-aviva-gold/20">{claim.house_number}</span>}
                          </div>
                        </div>
                        <p className="text-xs text-aviva-secondary mb-2">{claim.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Wrench size={10} className="text-aviva-secondary" />
                            <span className="text-[10px] text-aviva-secondary">{claim.assigned_to}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {claim.satisfaction_score && (
                              <div className="flex items-center gap-0.5">
                                <Star size={10} className="text-aviva-gold" />
                                <span className="text-[10px] text-aviva-gold font-bold">{claim.satisfaction_score}/5</span>
                              </div>
                            )}
                            {claim.scheduled_date && (
                              <span className="text-[10px] text-aviva-secondary">{claim.scheduled_date}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })
          }
        </div>
      </div>

      {/* Add Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">แจ้งซ่อม / Warranty</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input type="text" value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="ชื่อเจ้าของบ้าน"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">บ้าน/แปลงที่</label>
                <select value={form.house_number}
                  onChange={e => setForm({ ...form, house_number: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="">— เลือกแปลง —</option>
                  {houseOpts.map(h => <option key={h.house_number} value={h.house_number}>{h.house_number}</option>)}
                  <option value="ส่วนกลาง">ส่วนกลาง / อื่นๆ</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ประเภทปัญหา</label>
                  <select value={form.issue_type} onChange={e => setForm({ ...form, issue_type: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{issueTh[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">มอบหมายให้</label>
                  <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียดปัญหา *</label>
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="อธิบายปัญหาที่พบ..." rows={3}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่นัดซ่อม</label>
                <input type="date" value={form.scheduled_date}
                  onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.customer_name || !form.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกเคส"}
            </button>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">{selectedClaim.customer_name}</h2>
                <p className="text-xs text-aviva-secondary">{issueTh[selectedClaim.issue_type]} · {selectedClaim.assigned_to}</p>
              </div>
              <button onClick={() => setSelectedClaim(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <p className="text-sm text-aviva-text">{selectedClaim.description}</p>
            <p className="text-xs text-aviva-secondary">อัปเดตสถานะ:</p>
            <div className="grid grid-cols-3 gap-2">
              {(["pending", "in_progress", "resolved"] as Claim["status"][]).map(s => (
                <button key={s} onClick={() => handleUpdateStatus(selectedClaim.id, s)}
                  className={clsx("py-2.5 rounded-xl text-xs font-medium border transition-all",
                    selectedClaim.status === s
                      ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                      : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                  )}>
                  {statusConfig[s].label}
                </button>
              ))}
            </div>
            <div>
              <p className="text-xs text-aviva-secondary mb-2">คะแนนความพึงพอใจลูกค้า (ถ้ามี):</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setResolveScore(resolveScore === n ? null : n)}
                    className={clsx("flex-1 py-1.5 rounded-lg text-sm font-bold border transition-all",
                      resolveScore === n ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                    )}>
                    {n}⭐
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModalAS && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModalAS === "all" ? "แจ้งซ่อมทั้งหมด" :
                 kpiModalAS === "pending" ? "รอดำเนินการ" :
                 kpiModalAS === "in_progress" ? "กำลังดำเนินการ" : `แก้ไขแล้ว · ⭐ ${avgSatisfaction ?? "—"}`}
                {kpiModalAS !== "resolved" && (
                  <span className="ml-1.5 text-xs font-normal text-aviva-secondary">
                    ({(kpiModalAS === "all" ? claims : claims.filter(c => c.status === kpiModalAS)).length} รายการ)
                  </span>
                )}
              </h2>
              <button onClick={() => setKpiModalAS(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {(kpiModalAS === "all" ? claims : claims.filter(c => c.status === kpiModalAS)).map(c => {
                const sc = statusConfig[c.status];
                return (
                  <div key={c.id} className="p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-aviva-text truncate">{c.customer_name}</p>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0", sc?.bg, sc?.color)}>
                        {sc?.label ?? c.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-aviva-secondary">{c.description}</p>
                    {c.satisfaction_score && (
                      <p className="text-[10px] text-aviva-gold mt-0.5">⭐ {c.satisfaction_score}/5</p>
                    )}
                  </div>
                );
              })}
              {(kpiModalAS === "all" ? claims : claims.filter(c => c.status === kpiModalAS)).length === 0 && (
                <p className="text-center text-aviva-secondary text-sm py-8">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Approvals ────────────────────────────────────────────────────────────────

interface ApprovalLog {
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

type ApprovalsFilterTab = "pending" | "approved" | "rejected";

function fmtAmt(n: number) {
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

function getSlaBadge(log: ApprovalLog): { label: string; cls: string } | null {
  if (log.action_taken !== "Pending") return null;
  const sla = SLA_DAYS[log.workflow_type] ?? 3;
  const daysPending = Math.floor((Date.now() - new Date(log.created_at).getTime()) / 86_400_000);
  if (daysPending > sla) return { label: `เกิน SLA ${daysPending - sla} วัน`, cls: "bg-red-500/20 text-red-400 border border-red-500/30" };
  if (daysPending >= sla) return { label: `ครบ SLA วันนี้`, cls: "bg-orange-500/20 text-orange-400 border border-orange-500/30" };
  return null;
}

function ApprovalsContent() {
  const user = useCurrentUser();
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<ApprovalsFilterTab>("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifyLog, setVerifyLog] = useState<ApprovalLog | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const fetchLogs = () => {
    supabase.from("approval_logs").select("*")
      .eq("project_id", PROJECT_ID)
      .order("action_timestamp", { ascending: false, nullsFirst: true })
      .limit(100)
      .then(({ data }) => { setLogs((data as ApprovalLog[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter((l) => {
    if (filterTab === "pending") return l.action_taken === "Pending";
    if (filterTab === "approved") return l.action_taken === "Approved";
    return l.action_taken === "Rejected";
  });

  const pendingCount = logs.filter((l) => l.action_taken === "Pending").length;
  const overdueCount = logs.filter((l) => {
    if (l.action_taken !== "Pending") return false;
    const sla = SLA_DAYS[l.workflow_type] ?? 3;
    return Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86_400_000) > sla;
  }).length;

  const handleApprove = async (id: string) => {
    setSaving(true);
    const log = logs.find(l => l.approval_id === id);

    // Maker-checker: block approving your own submission
    if (log && user?.full_name && log.source_doc_index.includes(`โดย ${user.full_name}`)) {
      setSaving(false);
      setToast({ msg: "ไม่สามารถอนุมัติรายการที่ท่านเป็นผู้ส่งได้ (Maker-Checker)", type: "error" });
      return;
    }

    // 2-level enforcement: manager (non-admin) with amount > 50,000 must escalate
    if (log && !user?.isAdmin && (log.amount ?? 0) > 50000 && !log.source_doc_index.startsWith("[2nd Approval]")) {
      const { error: e1 } = await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("approval_id", id);
      if (e1) { setSaving(false); setToast({ msg: "เกิดข้อผิดพลาด: " + e1.message, type: "error" }); return; }
      await supabase.from("approval_logs").insert({
        workflow_type: log.workflow_type,
        source_doc_index: `[2nd Approval] ${log.source_doc_index}`,
        source_record_id: log.source_record_id,
        submitted_by_user_id: log.submitted_by_user_id ?? null,
        current_approver_role: "admin",
        action_taken: "Pending",
        amount: log.amount,
        sla_due_at: calcSlaDueAt(log.workflow_type),
        assigned_to_name: "ผู้จัดการ",
      });
      const dept = APPR_DEPT[log.workflow_type] ?? "ระบบ";
      await createNotification({ type: "info", title: `ส่งอนุมัติชั้น 2 — ${log.source_doc_index}`, message: `${APPR_LABEL[log.workflow_type] ?? log.workflow_type} ผ่านชั้น 1 แล้ว รอผู้บริหารอนุมัติชั้น 2`, from_dept: dept, to_dept: dept });
      setToast({ msg: `ผ่านชั้น 1 แล้ว — ส่งขออนุมัติชั้น 2 (ผู้บริหาร)`, type: "info" });
      setSaving(false); fetchLogs(); return;
    }

    const { error } = await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("approval_id", id);
    if (error) { setSaving(false); setToast({ msg: "เกิดข้อผิดพลาด: " + error.message, type: "error" }); return; }
    if (log?.source_record_id) {
      if (log.workflow_type === "Installment_Review") await supabase.from("contractor_installments").update({ status: "approved", approved_by: user?.full_name ?? user?.email, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Material_Purchase") await supabase.from("purchase_orders").update({ status: "approved", approved_by: user?.full_name, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Document_Approval") await supabase.from("documents").update({ status: "approved", approved_by: user?.full_name ?? user?.email }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Finance_Approval") await supabase.from("approvals").update({ status: "approved", approved_by: user?.full_name ?? user?.email, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Leave_Request") await supabase.from("leave_requests").update({ status: "approved", approved_by: user?.full_name ?? user?.email, approved_by_role: user?.role, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Contract_Approval") {
        // Group C: อนุมัติแล้วจึงปิดการขายจริง (รับรู้รายได้ + บ้าน sold + lead=Closed Deal)
        const fin = await finalizeSale(log.source_record_id, user?.full_name ?? user?.email ?? "ผู้จัดการ", user?.id);
        broadcastCelebration({ event: "transfer", customerName: fin.customerName, plotNumber: fin.plot, amount: fin.amount, salesPerson: user?.full_name ?? user?.email, byUserId: user?.id });
      }
    }
    if (log) {
      const dept = APPR_DEPT[log.workflow_type] ?? "ระบบ";
      setToast({ msg: `อนุมัติแล้ว — ${log.source_doc_index}`, type: "success" });
      await createNotification({ type: "success", title: `อนุมัติแล้ว — ${log.source_doc_index}`, message: `${APPR_LABEL[log.workflow_type] ?? log.workflow_type}${log.amount ? ` ฿${Number(log.amount).toLocaleString()}` : ""} ได้รับการอนุมัติแล้ว`, from_dept: dept, to_dept: dept });
    }
    if (log?.source_record_id) {
      await resolveApprovalQueue({ workflowType: log.workflow_type, sourceRecordId: log.source_record_id, docIndex: log.source_doc_index, approved: true, actorName: user?.full_name ?? user?.email, actorRole: user?.isAdmin ? "admin" : "manager" });
    }
    setSaving(false);
    fetchLogs();
  };

  const handleReject = async (id: string, commentArg?: string) => {
    setSaving(true);
    const log = logs.find(l => l.approval_id === id);

    // Maker-checker: block rejecting your own submission
    if (log && user?.full_name && log.source_doc_index.includes(`โดย ${user.full_name}`)) {
      setSaving(false);
      setToast({ msg: "ไม่สามารถปฏิเสธรายการที่ท่านเป็นผู้ส่งได้ (Maker-Checker)", type: "error" });
      return;
    }

    const { error } = await supabase.from("approval_logs").update({ action_taken: "Rejected", action_timestamp: new Date().toISOString(), approver_email: user?.email, rejection_comment: commentArg ?? rejectComment }).eq("approval_id", id);
    if (error) { setSaving(false); setToast({ msg: "เกิดข้อผิดพลาด: " + error.message, type: "error" }); return; }
    if (log?.source_record_id) {
      if (log.workflow_type === "Installment_Review") await supabase.from("contractor_installments").update({ status: "pending" }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Material_Purchase") await supabase.from("purchase_orders").update({ status: "draft" }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Document_Approval") await supabase.from("documents").update({ status: "rejected" }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Finance_Approval") await supabase.from("approvals").update({ status: "rejected", approved_by: user?.full_name ?? user?.email, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Leave_Request") await supabase.from("leave_requests").update({ status: "rejected", approved_by: user?.full_name ?? user?.email, approved_by_role: user?.role, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
      else if (log.workflow_type === "Booking_Deposit") {
        // ปฏิเสธเงินจอง → คืนสถานะลูกค้าเป็น New Lead + ปล่อยแปลงกลับเป็นว่าง (ให้ตรงกับหน้า /approvals)
        const { data: lead } = await supabase.from("leads").select("plot_number").eq("id", log.source_record_id).maybeSingle();
        await supabase.from("leads").update({ status: "New Lead" }).eq("id", log.source_record_id);
        const plot = (lead as { plot_number?: number } | null)?.plot_number;
        if (plot) await supabase.from("houses").update({ status: "available" }).eq("project_id", PROJECT_ID).eq("plot_number", plot);
      }
      else if (log.workflow_type === "Contract_Approval") await supabase.from("leads").update({ status: "Loan Approved" }).eq("id", log.source_record_id);
    }
    if (log) {
      const dept = APPR_DEPT[log.workflow_type] ?? "ระบบ";
      setToast({ msg: `ปฏิเสธแล้ว — ${log.source_doc_index}`, type: "info" });
      await createNotification({ type: "info", title: `ปฏิเสธ — ${log.source_doc_index}`, message: `${APPR_LABEL[log.workflow_type] ?? log.workflow_type} ถูกปฏิเสธ${rejectComment ? `: ${rejectComment}` : ""}`, from_dept: dept, to_dept: dept });
    }
    if (log?.source_record_id) {
      await resolveApprovalQueue({ workflowType: log.workflow_type, sourceRecordId: log.source_record_id, docIndex: log.source_doc_index, approved: false, actorName: user?.full_name ?? user?.email, actorRole: user?.isAdmin ? "admin" : "manager", conditionNote: (commentArg ?? rejectComment) || undefined });
    }
    setSaving(false);
    setRejectingId(null);
    setRejectComment("");
    fetchLogs();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex gap-2">
        {[
          { k: "pending",  l: `รออนุมัติ${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          { k: "approved", l: "อนุมัติแล้ว" },
          { k: "rejected", l: "ปฏิเสธ" },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => setFilterTab(k as ApprovalsFilterTab)}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              filterTab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-xs text-red-400 font-medium">{overdueCount} รายการเกิน SLA — ต้องอนุมัติด่วน</span>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <ClipboardCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีรายการในหมวดนี้</p>
          </GlassCard>
        ) : (
          filtered.map((log) => {
            const docParts = log.source_doc_index.split(" | ");
            const docNum = docParts[0];
            const slaBadge = getSlaBadge(log);
            return (
            <GlassCard key={log.approval_id} className={clsx("p-4 space-y-3", slaBadge?.cls.includes("red") && "border border-red-500/30")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-aviva-gold">{docNum}</span>
                    {slaBadge && (
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full", slaBadge.cls)}>
                        {slaBadge.label}
                      </span>
                    )}
                    {log.amount != null && log.amount > 50000 && (
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <ShieldAlert size={9} /> ต้องอนุมัติ 2 ชั้น
                      </span>
                    )}
                  </div>
                  {log.action_timestamp && (
                    <p className="text-[10px] text-aviva-secondary/60 mt-0.5">
                      {new Date(log.action_timestamp).toLocaleDateString("th-TH")}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {log.amount != null && <p className="text-sm font-bold text-aviva-gold">{fmtAmt(log.amount)}</p>}
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                    log.action_taken === "Pending" ? "bg-yellow-500/20 text-yellow-400" :
                    log.action_taken === "Approved" ? "bg-green-500/20 text-green-400" :
                    "bg-red-500/20 text-red-400"
                  )}>
                    {log.action_taken === "Pending" ? "รออนุมัติ" : log.action_taken === "Approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
                  </span>
                </div>
              </div>

              <ApprovalRouteBar log={log} />

              {log.rejection_comment && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                  เหตุผล: {log.rejection_comment}
                </p>
              )}

              {log.action_taken === "Pending" && (
                <button onClick={() => setVerifyLog(log)} disabled={saving}
                  className="w-full py-2.5 bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                  <ClipboardCheck size={13} /> ตรวจสอบ &amp; อนุมัติ
                </button>
              )}
            </GlassCard>
          );})
        )}
      </div>

      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เหตุผลการปฏิเสธ</h2>
              <button onClick={() => setRejectingId(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)}
              placeholder="ระบุเหตุผล..." rows={3}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
            <button onClick={() => handleReject(rejectingId)} disabled={saving || !rejectComment.trim()}
              className="w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "ยืนยันการปฏิเสธ"}
            </button>
          </div>
        </div>
      )}
      {verifyLog && (
        <ApprovalVerifyModal
          log={verifyLog as VerifyLog}
          logId={verifyLog.approval_id}
          attachedBy={user?.full_name ?? user?.email ?? "ผู้ใช้"}
          busy={saving}
          onClose={() => setVerifyLog(null)}
          onApprove={async (items) => {
            const lg = verifyLog; setVerifyLog(null);
            await handleApprove(lg.approval_id);
            const s = summarizeApproval(lg);
            await logAction("approvals", "verify_approve",
              `ตรวจสอบ & อนุมัติ — ${s.subject} (จาก ${s.fromName})${lg.amount ? ` ฿${Number(lg.amount).toLocaleString("th-TH")}` : ""} · ยืนยัน: ${items.join(", ")}`,
              lg.source_record_id ?? undefined, { department: user?.department });
          }}
          onReject={async (c) => {
            const lg = verifyLog; setVerifyLog(null);
            await handleReject(lg.approval_id, c);
            const s = summarizeApproval(lg);
            await logAction("approvals", "verify_reject",
              `ตรวจสอบ & ปฏิเสธ — ${s.subject} (จาก ${s.fromName}) · เหตุผล: ${c}`,
              lg.source_record_id ?? undefined, { department: user?.department });
          }}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Materials / Stock ────────────────────────────────────────────────────────

interface Material {
  id: string; name: string; unit: string; unit_price: number;
  quantity: number; min_stock: number; current_stock: number;
  status: string; supplier: string; delivery_date: string;
}
interface PurchaseOrder {
  id: string; po_number: string; supplier_name: string;
  items: { name: string; qty: number; unit: string; unit_price: number }[];
  total_amount: number; status: string; requested_by: string; created_at: string;
}

// โหมด A — ใบสั่งซื้อวัสดุ (PO) ฝั่งจัดซื้อสำนักงาน
function poTemplates(po: PurchaseOrder): DocTemplate[] {
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

function MaterialsContent() {
  const user = useCurrentUser();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [activeView, setActiveView] = useState<"stock" | "po">("stock");
  const [loading, setLoading] = useState(true);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poForm, setPoForm] = useState({ supplier_name: "", notes: "", delivery_date: "" });
  const [poItemRows, setPoItemRows] = useState([{ name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }]);
  const [saving, setSaving] = useState(false);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const fetchMaterialsData = () => {
    Promise.all([
      supabase.from("materials").select("*").eq("project_id", PROJECT_ID).order("name"),
      supabase.from("purchase_orders").select("*").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }),
    ]).then(([mRes, pRes]) => {
      setMaterials((mRes.data as Material[]) ?? []);
      setPos((pRes.data as PurchaseOrder[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(() => { fetchMaterialsData(); }, []);

  const stockStatus = (m: Material) => {
    const cur = m.current_stock ?? 0;
    const min = m.min_stock ?? 0;
    if (cur === 0) return { label: "หมด", cls: "bg-red-500/20 text-red-400" };
    if (cur < min) return { label: "ต่ำ", cls: "bg-yellow-500/20 text-yellow-400" };
    return { label: "OK", cls: "bg-green-500/20 text-green-400" };
  };

  const poStatusLabel: Record<string, { label: string; cls: string }> = {
    draft:            { label: "ร่าง",         cls: "bg-gray-500/20 text-gray-400" },
    pending_approval: { label: "รออนุมัติ",     cls: "bg-yellow-500/20 text-yellow-400" },
    approved:         { label: "อนุมัติแล้ว",   cls: "bg-green-500/20 text-green-400" },
    received:         { label: "รับของแล้ว",    cls: "bg-blue-500/20 text-blue-400" },
    cancelled:        { label: "ยกเลิก",        cls: "bg-red-500/20 text-red-400" },
  };

  const handleCreatePO = async () => {
    if (!poForm.supplier_name || poItemRows.every(r => !r.name)) return;
    setSaving(true);
    const poDocNum = await generateDocNumber("PO");
    const parsedItems = poItemRows.filter(r => r.name).map(r => ({ name: r.name, qty: Number(r.qty) || 1, unit: r.unit || "ชิ้น", unit_price: Number(r.unit_price) || 0 }));
    const total = parsedItems.reduce((s, i) => s + (i.qty * i.unit_price), 0);
    const { data: poData, error: poErr } = await supabase.from("purchase_orders").insert({
      project_id: PROJECT_ID,
      po_number: poDocNum,
      supplier_name: poForm.supplier_name,
      items: parsedItems,
      total_amount: total,
      status: "draft",
      requested_by: user?.full_name ?? user?.email ?? "Unknown",
      notes: poForm.notes,
      ...(poForm.delivery_date ? { delivery_date: poForm.delivery_date } : {}),
    }).select().single();
    if (poErr) { setSaving(false); setToast({ msg: "สร้าง PO ไม่สำเร็จ: " + poErr.message, type: "error" }); return; }
    if (poData) {
      await supabase.from("approval_logs").insert({
        workflow_type: "Material_Purchase",
        source_doc_index: `${poDocNum} | PO — ${poForm.supplier_name}${poForm.delivery_date ? ` (กำหนดส่ง ${poForm.delivery_date})` : ""} | โดย ${user?.full_name ?? user?.email ?? "Unknown"}`,
        submitted_by_user_id: user?.id ?? null,
        source_record_id: poData.id,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: total,
        sla_due_at: calcSlaDueAt("Material_Purchase"),
        assigned_to_name: "ผู้จัดการ",
      });
    }
    await createNotification({
      type: "approval",
      title: "ใบสั่งซื้อ (PO) ใหม่",
      message: `จาก ${user?.full_name ?? "ฝ่ายจัดซื้อ"} · ${poForm.supplier_name} ฿${total.toLocaleString("th-TH")} · ส่งให้ผู้จัดการพิจารณา`,
      from_dept: "ฝ่ายก่อสร้าง",
    });
    setSaving(false);
    setShowPOModal(false);
    setPoForm({ supplier_name: "", notes: "", delivery_date: "" });
    setPoItemRows([{ name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }]);
    fetchMaterialsData();
  };

  const handlePOApprove = async (id: string) => {
    const po = pos.find(p => p.id === id);
    await supabase.from("purchase_orders").update({ status: "approved", approved_by: user?.full_name, approved_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("source_record_id", id).eq("workflow_type", "Material_Purchase").eq("action_taken", "Pending");
    if (po) {
      await createNotification({
        type: "success",
        title: "อนุมัติ PO แล้ว",
        message: `${po.supplier_name} — ฿${(po.total_amount ?? 0).toLocaleString("th-TH")} ได้รับการอนุมัติโดย ${user?.full_name ?? "Admin"}`,
        from_dept: "ฝ่ายก่อสร้าง",
      });
    }
    fetchMaterialsData();
  };

  // A4: รับของจาก PO ที่อนุมัติ → อัปเดตสต็อกวัสดุ + บันทึก goods_receipts + PO=received
  const handleReceivePO = async (po: PurchaseOrder) => {
    if (!Array.isArray(po.items) || po.items.length === 0) return;
    for (const item of po.items) {
      const mat = materials.find(m => m.name === item.name);
      if (mat) await supabase.from("materials").update({ current_stock: (mat.current_stock ?? 0) + Number(item.qty) }).eq("id", mat.id);
    }
    await supabase.from("goods_receipts").insert({
      grn_number: `GRN-${Date.now().toString().slice(-8)}`, po_id: po.id,
      received_by: user?.full_name ?? user?.email ?? null,
      received_date: new Date().toISOString().split("T")[0],
      items: po.items, status: "received", project_id: PROJECT_ID,
    });
    await supabase.from("purchase_orders").update({ status: "received" }).eq("id", po.id);
    await createNotification({ type: "success", title: "รับของเข้าสต็อกแล้ว", message: `${po.po_number ?? ""} — ${po.supplier_name} (อัปเดตสต็อก ${po.items.length} รายการ)`, from_dept: "ฝ่ายก่อสร้าง" });
    fetchMaterialsData();
  };

  const lowStockCount = materials.filter(m => (m.current_stock ?? 0) < (m.min_stock ?? 0)).length;

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <Package size={14} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-lg font-bold text-aviva-text">{materials.length}</p>
          <p className="text-[10px] text-aviva-secondary">รายการวัสดุ</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <AlertTriangle size={14} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-yellow-400">{lowStockCount}</p>
          <p className="text-[10px] text-aviva-secondary">สต๊อกต่ำ</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <FileText size={14} className="text-blue-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-400">{pos.filter(p => p.status === "pending_approval").length}</p>
          <p className="text-[10px] text-aviva-secondary">รออนุมัติ PO</p>
        </GlassCard>
      </div>

      {/* View tabs */}
      <div className="flex gap-2">
        {[{ k: "stock", l: "สต๊อกวัสดุ" }, { k: "po", l: "ใบสั่งซื้อ" }].map(({ k, l }) => (
          <button key={k} onClick={() => setActiveView(k as "stock" | "po")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              activeView === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
        {(user?.isManager || user?.isAdmin) && (
          <button onClick={() => setShowPOModal(true)}
            className="flex items-center gap-1 bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/30 px-3 py-2 rounded-xl text-xs font-medium">
            <Plus size={12} /> PO
          </button>
        )}
      </div>

      {/* Stock View */}
      {activeView === "stock" && (
        <div className="space-y-2">
          {loading ? [1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />) :
           materials.map(m => {
            const st = stockStatus(m);
            return (
              <GlassCard key={m.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-aviva-card flex items-center justify-center flex-shrink-0">
                    <Package size={16} className="text-aviva-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-aviva-text font-medium truncate">{m.name}</p>
                    <p className="text-[10px] text-aviva-secondary">
                      สต๊อก: {m.current_stock ?? 0} {m.unit} · ขั้นต่ำ: {m.min_stock ?? 0} {m.unit}
                    </p>
                  </div>
                  <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", st.cls)}>{st.label}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* PO View */}
      {activeView === "po" && (
        <div className="space-y-2">
          {loading ? [1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />) :
           pos.length === 0 ? (
            <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีใบสั่งซื้อ</p></GlassCard>
           ) : pos.map(po => {
            const stConf = poStatusLabel[po.status] ?? { label: po.status, cls: "bg-gray-500/20 text-gray-400" };
            const isExpanded = expandedPO === po.id;
            return (
              <GlassCard key={po.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-aviva-gold">{po.po_number ?? "—"}</span>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full", stConf.cls)}>{stConf.label}</span>
                    </div>
                    <p className="text-sm text-aviva-text mt-0.5">{po.supplier_name}</p>
                    <p className="text-[10px] text-aviva-secondary">โดย {po.requested_by} · ฿{(po.total_amount ?? 0).toLocaleString("th-TH")}</p>
                  </div>
                  <button onClick={() => setExpandedPO(isExpanded ? null : po.id)} className="text-aviva-secondary/50 mt-1">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {isExpanded && Array.isArray(po.items) && (
                  <div className="bg-aviva-bg rounded-xl p-2 space-y-1">
                    {po.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-aviva-secondary">{item.name} × {item.qty} {item.unit}</span>
                        <span className="text-aviva-text">฿{(item.qty * item.unit_price).toLocaleString("th-TH")}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-0.5">
                  <AttachDocButton entityType="purchase_order" entityId={po.id} attachedBy={user?.full_name ?? ""} templates={poTemplates(po)} />
                </div>
                {po.status === "pending_approval" && (user?.isManager || user?.isAdmin) && (
                  <button onClick={() => handlePOApprove(po.id)}
                    className="w-full py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    <CheckCircle size={12} /> อนุมัติ PO
                  </button>
                )}
                {po.status === "approved" && (
                  <button onClick={() => handleReceivePO(po)}
                    className="w-full py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    📦 รับของเข้าสต็อก
                  </button>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Create PO Modal */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">สร้างใบสั่งซื้อ (PO)</h2>
              <button onClick={() => setShowPOModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อผู้จำหน่าย *</label>
                <input value={poForm.supplier_name} onChange={e => setPoForm(p => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="บ. วัสดุก่อสร้าง จก." className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายการวัสดุ *</label>
                <div className="space-y-2">
                  <datalist id="po-mat-names">{materials.map(m => <option key={m.id} value={m.name} />)}</datalist>
                  {poItemRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                      <input value={row.name} list="po-mat-names" onChange={e => setPoItemRows(r => r.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                        placeholder="ชื่อวัสดุ" className="col-span-4 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
                      <input type="number" value={row.qty} onChange={e => setPoItemRows(r => r.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))}
                        placeholder="จำนวน" className="col-span-2 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
                      <input value={row.unit} onChange={e => setPoItemRows(r => r.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))}
                        placeholder="หน่วย" className="col-span-2 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
                      <input type="number" value={row.unit_price} onChange={e => setPoItemRows(r => r.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))}
                        placeholder="ราคา/หน่วย" className="col-span-3 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
                      <button onClick={() => setPoItemRows(r => r.filter((_, i) => i !== idx))} disabled={poItemRows.length === 1}
                        className="col-span-1 text-red-400/60 disabled:opacity-20 flex items-center justify-center"><X size={12} /></button>
                    </div>
                  ))}
                  <button onClick={() => setPoItemRows(r => [...r, { name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }])}
                    className="text-xs text-aviva-gold/70 flex items-center gap-1 mt-1"><Plus size={12} /> เพิ่มรายการ</button>
                  {poItemRows.some(r => r.name) && (
                    <p className="text-xs text-aviva-secondary text-right">รวม: ฿{poItemRows.filter(r => r.name).reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0).toLocaleString("th-TH")}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">กำหนดส่งของ</label>
                <input type="date" value={poForm.delivery_date} onChange={e => setPoForm(p => ({ ...p, delivery_date: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <input value={poForm.notes} onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="หมายเหตุเพิ่มเติม" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handleCreatePO} disabled={saving || !poForm.supplier_name || poItemRows.every(r => !r.name)}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "สร้าง PO"}
            </button>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

interface PayrollEmployee extends Employee {
  commission_amount?: number;
  sso?: number;
  tax?: number;
  net?: number;
}

function PayrollContent() {
  const user = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payslipEmp, setPayslipEmp] = useState<PayrollEmployee | null>(null);
  // UX-04: persist รายได้พิเศษไว้ใน sessionStorage กันหายเมื่อสลับแท็บ (PayrollContent unmount/remount)
  const [specialIncomes, setSpecialIncomes] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(sessionStorage.getItem("aviva_special_incomes") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { sessionStorage.setItem("aviva_special_incomes", JSON.stringify(specialIncomes)); } catch { /* ignore */ }
  }, [specialIncomes]);

  useEffect(() => {
    supabase.from("employees").select("*").eq("status", "active")
      .order("department")
      .then(({ data }) => { setEmployees((data as Employee[]) ?? []); setLoading(false); });
  }, []);

  const calcSSO = (base: number) => Math.min(base * 0.05, 750);
  const calcCommission = (emp: Employee) => Math.round((emp.base_salary * (emp.commission_rate ?? 0)) / 100);

  const calcIncomeTax = (annual: number): number => {
    if (annual <= 150000) return 0;
    let tax = 0;
    const brackets: [number, number, number][] = [
      [150001, 300000, 0.05],
      [300001, 500000, 0.10],
      [500001, 750000, 0.15],
      [750001, 1000000, 0.20],
      [1000001, 2000000, 0.25],
      [2000001, Infinity, 0.35],
    ];
    for (const [lo, hi, rate] of brackets) {
      if (annual < lo) break;
      tax += (Math.min(annual, hi) - lo) * rate;
    }
    return Math.round(tax / 12);
  };

  const calcPayroll = (emp: Employee): PayrollEmployee => {
    const special = parseFloat(specialIncomes[emp.id] ?? "0") || 0;
    const commission = calcCommission(emp);
    const sso = calcSSO(emp.base_salary);
    const gross = emp.base_salary + commission + special;
    const tax = calcIncomeTax(gross * 12);
    return { ...emp, commission_amount: commission, sso, tax, net: gross - sso - tax };
  };

  const totalNetPayroll = employees.reduce((sum, emp) => sum + (calcPayroll(emp).net ?? 0), 0);

  const printPayslip = (pr: PayrollEmployee) => {
    const special = parseFloat(specialIncomes[pr.id] ?? "0") || 0;
    const monthDisplay = new Date(month + "-01").toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
      <title>สลิปเงินเดือน — ${pr.full_name}</title>
      <style>
        body{font-family:'IBM Plex Sans Thai','Noto Sans Thai',Arial,sans-serif;margin:0;padding:40px;color:#222;font-size:14px;max-width:600px;margin:0 auto}
        .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #D4AF37;padding-bottom:16px}
        .logo{font-size:24px;font-weight:bold;letter-spacing:4px;color:#1E4A35}
        .sub{font-size:13px;color:#666;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        td{padding:8px 0;border-bottom:1px solid #eee;font-size:13px}
        td:last-child{text-align:right;font-weight:600}
        .section-title{background:#f9f7f0;font-weight:bold;color:#1E4A35;padding:8px 12px;margin:-1px -0px;font-size:12px;text-transform:uppercase;letter-spacing:1px}
        .total-row td{border-top:2px solid #D4AF37;border-bottom:none;color:#D4AF37;font-size:16px;font-weight:bold;padding-top:12px}
        .deduct{color:#e53e3e}
        .footer{text-align:center;margin-top:24px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px}
        .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px}
        .sign-box{text-align:center;border-top:1px solid #ccc;padding-top:8px;font-size:12px;color:#666}
        .btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}
        @media print{body{padding:10px}.btns{display:none!important}}
      </style></head><body>
      <div class="header">
        <div class="logo">AVIVA Private</div>
        <div class="sub">สลิปเงินเดือนประจำเดือน ${monthDisplay}</div>
      </div>
      <table>
        <tr><td>ชื่อ-นามสกุล</td><td>${pr.full_name}</td></tr>
        <tr><td>ตำแหน่ง</td><td>${pr.position ?? "-"}</td></tr>
        <tr><td>แผนก</td><td>${pr.department ?? "-"}</td></tr>
        <tr><td>สถานะ</td><td>Active</td></tr>
      </table>
      <p class="section-title">รายรับ</p>
      <table>
        <tr><td>เงินเดือนพื้นฐาน</td><td>฿${pr.base_salary.toLocaleString("th-TH")}</td></tr>
        ${(pr.commission_amount ?? 0) > 0 ? `<tr><td>ค่าคอมมิชชั่น</td><td style="color:#22543d">+฿${(pr.commission_amount ?? 0).toLocaleString("th-TH")}</td></tr>` : ""}
        ${special > 0 ? `<tr><td>รายได้พิเศษ</td><td style="color:#22543d">+฿${special.toLocaleString("th-TH")}</td></tr>` : ""}
        <tr><td>รายรับรวม</td><td>฿${(pr.base_salary + (pr.commission_amount ?? 0) + special).toLocaleString("th-TH")}</td></tr>
      </table>
      <p class="section-title">รายหัก</p>
      <table>
        <tr><td class="deduct">ประกันสังคม (5%, สูงสุด ฿750)</td><td class="deduct">-฿${(pr.sso ?? 0).toLocaleString("th-TH")}</td></tr>
        <tr><td class="deduct">ภาษีเงินได้หัก ณ ที่จ่าย</td><td class="deduct">-฿${(pr.tax ?? 0).toLocaleString("th-TH")}</td></tr>
        <tr class="total-row"><td>เงินได้สุทธิ</td><td>฿${(pr.net ?? 0).toLocaleString("th-TH")}</td></tr>
      </table>
      <div class="sign">
        <div class="sign-box">ลงชื่อผู้รับเงิน<br><br>(_________________________)<br>${pr.full_name}</div>
        <div class="sign-box">ลงชื่อผู้อนุมัติ<br><br>(_________________________)<br>ผู้บริหาร</div>
      </div>
      <div class="footer">บริษัท อลิสา พร็อพเพอร์ตี้ ดีเวลลอปเม้นท์ จำกัด · เลขทะเบียน 0305564005951 · โทร 064-456-2878 · ${new Date().toLocaleDateString("th-TH")}</div>
      <div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div>
      </body></html>`;
    const w = window.open("", "_blank", "width=700,height=600");
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-aviva-secondary mb-1 block">เดือนที่คำนวณ</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
        </div>
        <div className="text-right mt-4">
          <p className="text-[10px] text-aviva-secondary">เงินเดือนรวมสุทธิ</p>
          <p className="text-lg font-bold text-aviva-gold">฿{totalNetPayroll.toLocaleString("th-TH")}</p>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-aviva-card/50 animate-pulse" />) :
         employees.map(emp => {
          const pr = calcPayroll(emp);
          return (
            <GlassCard key={emp.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-aviva-text font-medium">{emp.full_name}</p>
                  <p className="text-[10px] text-aviva-secondary">{emp.department} · {emp.position}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-aviva-gold">฿{(pr.net ?? 0).toLocaleString("th-TH")}</p>
                  <p className="text-[10px] text-aviva-secondary">สุทธิ</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">เงินเดือน</p>
                  <p className="text-aviva-text font-medium">฿{emp.base_salary.toLocaleString("th-TH")}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">ประกันสังคม</p>
                  <p className="text-red-400 font-medium">-฿{(pr.sso ?? 0).toLocaleString("th-TH")}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">ภาษีหัก ณ ที่จ่าย</p>
                  <p className="text-red-400 font-medium">-฿{(pr.tax ?? 0).toLocaleString("th-TH")}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">รายได้พิเศษ</p>
                  <input type="number" value={specialIncomes[emp.id] ?? ""}
                    onChange={e => setSpecialIncomes(p => ({ ...p, [emp.id]: e.target.value }))}
                    placeholder="0"
                    className="w-full text-center text-aviva-text bg-transparent outline-none text-[10px]" />
                </div>
              </div>
              <button onClick={() => setPayslipEmp(pr)}
                className="w-full py-1.5 bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                <Printer size={11} /> ดูสลิปเงินเดือน
              </button>
            </GlassCard>
          );
        })}
      </div>

      {/* Payslip Modal */}
      {payslipEmp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 print-area">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">สลิปเงินเดือน</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => printPayslip(payslipEmp)} className="text-xs text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Printer size={11} /> พิมพ์สลิป
                </button>
                <button onClick={() => setPayslipEmp(null)}><X size={18} className="text-aviva-secondary" /></button>
              </div>
            </div>
            <div className="text-center border-b border-aviva-gold/20 pb-3">
              <p className="text-xs font-bold text-aviva-gold tracking-widest">AVIVA ONE</p>
              <p className="text-xs text-aviva-secondary mt-0.5">สลิปเงินเดือนประจำเดือน {month}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-aviva-secondary">ชื่อ-สกุล</span>
                <span className="text-aviva-text font-medium">{payslipEmp.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aviva-secondary">ตำแหน่ง</span>
                <span className="text-aviva-text">{payslipEmp.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aviva-secondary">แผนก</span>
                <span className="text-aviva-text">{payslipEmp.department}</span>
              </div>
            </div>
            <div className="border-t border-aviva-gold/10 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-aviva-secondary">เงินเดือนพื้นฐาน</span>
                <span className="text-aviva-text">฿{payslipEmp.base_salary.toLocaleString("th-TH")}</span>
              </div>
              {(payslipEmp.commission_amount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">ค่าคอมมิชชั่น</span>
                  <span className="text-green-400">+฿{(payslipEmp.commission_amount ?? 0).toLocaleString("th-TH")}</span>
                </div>
              )}
              {(specialIncomes[payslipEmp.id] && parseFloat(specialIncomes[payslipEmp.id]) > 0) && (
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">รายได้พิเศษ</span>
                  <span className="text-green-400">+฿{parseFloat(specialIncomes[payslipEmp.id]).toLocaleString("th-TH")}</span>
                </div>
              )}
              <div className="flex justify-between text-red-400">
                <span>หัก: ประกันสังคม (5%, สูงสุด ฿750)</span>
                <span>-฿{(payslipEmp.sso ?? 0).toLocaleString("th-TH")}</span>
              </div>
              <div className="flex justify-between font-bold text-aviva-gold border-t border-aviva-gold/20 pt-2 mt-1">
                <span>เงินได้สุทธิ</span>
                <span>฿{(payslipEmp.net ?? 0).toLocaleString("th-TH")}</span>
              </div>
            </div>
            <p className="text-[10px] text-aviva-secondary/40 text-center">เอกสารนี้ออกโดยระบบ AVIVA ONE · {new Date().toLocaleDateString("th-TH")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Community (ค่าส่วนกลาง) ─────────────────────────────────────────────────

interface CommunityMember {
  member_id: string;
  house_id: string | null;
  owner_name: string;
  owner_phone: string;
  area_sqw: number;
  annual_fee: number;
  fee_status: string;
  transferred_at: string | null;
}

interface CommunityHouse { id: string; house_number: string; land_size: number | null; }

function CommunityContent() {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [houses, setHouses] = useState<CommunityHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ house_id: "", owner_name: "", owner_phone: "", area_sqw: "" });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "Paid" | "Unpaid">("all");

  const fetchMembers = () => {
    supabase.from("community_members").select("*").order("owner_name")
      .then(({ data }) => { setMembers((data as CommunityMember[]) ?? []); setLoading(false); });
  };

  useEffect(() => {
    fetchMembers();
    supabase.from("houses").select("id,house_number,land_size").eq("project_id", PROJECT_ID).order("plot_number").limit(31)
      .then(({ data }) => setHouses((data as CommunityHouse[]) ?? []));
  }, []);

  const fmtFee = (n: number) => `฿${Number(n).toLocaleString("th-TH")}`;
  const totalFee = members.reduce((s, m) => s + Number(m.annual_fee), 0);
  const paidCount = members.filter((m) => m.fee_status === "Paid").length;
  const unpaidCount = members.filter((m) => m.fee_status === "Unpaid").length;
  const filtered = filterStatus === "all" ? members : members.filter((m) => m.fee_status === filterStatus);

  const handleAdd = async () => {
    if (!form.owner_name || !form.area_sqw) return;
    setSaving(true);
    await supabase.from("community_members").insert({
      house_id: form.house_id || null,
      owner_name: form.owner_name,
      owner_phone: form.owner_phone,
      area_sqw: Number(form.area_sqw),
      annual_fee: Number(form.area_sqw) * 30,
      fee_status: "Unpaid",
    });
    setSaving(false);
    setShowModal(false);
    setForm({ house_id: "", owner_name: "", owner_phone: "", area_sqw: "" });
    fetchMembers();
  };

  const handleMarkPaid = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Paid" ? "Unpaid" : "Paid";
    await supabase.from("community_members").update({
      fee_status: newStatus,
      transferred_at: newStatus === "Paid" ? new Date().toISOString() : null,
    }).eq("member_id", id);
    fetchMembers();
  };

  return (
    <>
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-aviva-secondary">
          {loading ? "กำลังโหลด..." : `${members.length} สมาชิก · รวม ${fmtFee(totalFee)}`}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCsv(`community-members-${new Date().toISOString().slice(0, 10)}`,
            ["เจ้าของ", "เบอร์โทร", "พื้นที่(ตร.ว.)", "ค่าส่วนกลาง", "สถานะ", "วันที่ชำระ"],
            members.map(m => [m.owner_name, m.owner_phone, m.area_sqw, m.annual_fee, m.fee_status === "Paid" ? "ชำระแล้ว" : "ค้างชำระ", m.transferred_at ? new Date(m.transferred_at).toLocaleDateString("th-TH") : ""]))}
            className="bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-xs font-bold px-3 py-2 rounded-xl">
            CSV
          </button>
          <button onClick={() => { setForm({ house_id: "", owner_name: "", owner_phone: "", area_sqw: "" }); setShowModal(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
            <Plus size={14} /> เพิ่มสมาชิก
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <GlassCard className="p-3 text-center">
          <Users size={16} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-text">{members.length}</p>
          <p className="text-[10px] text-aviva-secondary">สมาชิกทั้งหมด</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">{paidCount}</p>
          <p className="text-[10px] text-aviva-secondary">ชำระแล้ว</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <DollarSign size={16} className="text-red-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-red-400">{unpaidCount}</p>
          <p className="text-[10px] text-aviva-secondary">ค้างชำระ</p>
        </GlassCard>
      </div>

      <div className="flex gap-2">
        {[{ k: "all", l: "ทั้งหมด" }, { k: "Unpaid", l: "ค้างชำระ" }, { k: "Paid", l: "ชำระแล้ว" }].map(({ k, l }) => (
          <button key={k} onClick={() => setFilterStatus(k as "all" | "Paid" | "Unpaid")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              filterStatus === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      <div className="space-y-3">
        <SectionHeader title="ทะเบียนสมาชิก" subtitle="ค่าส่วนกลาง = พื้นที่ × ฿30/ตร.ว." />
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Home size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีสมาชิก</p>
          </GlassCard>
        ) : (
          filtered.map((m) => (
            <GlassCard key={m.member_id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-aviva-text">{m.owner_name}</p>
                  {m.owner_phone && <p className="text-xs text-aviva-secondary">{m.owner_phone}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-aviva-secondary">{m.area_sqw} ตร.ว.</span>
                    <span className="text-xs font-medium text-aviva-gold">{fmtFee(Number(m.annual_fee))}/ปี</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                    m.fee_status === "Paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {m.fee_status === "Paid" ? "ชำระแล้ว" : "ค้างชำระ"}
                  </span>
                  {m.fee_status === "Paid" ? (
                    <>
                      {m.transferred_at && (
                        <span className="text-[9px] text-aviva-secondary">ชำระเมื่อ {new Date(m.transferred_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                      <button onClick={() => handleMarkPaid(m.member_id, m.fee_status)}
                        className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg">
                        ยกเลิกการชำระ
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleMarkPaid(m.member_id, m.fee_status)}
                      className="text-[10px] bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg">
                      บันทึกรับชำระ
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>

    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-aviva-text">เพิ่มสมาชิกใหม่</h2>
            <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">แปลงบ้าน (ผูกกับทะเบียนบ้าน)</label>
              <select value={form.house_id}
                onChange={(e) => {
                  const h = houses.find(h => h.id === e.target.value);
                  setForm({ ...form, house_id: e.target.value, area_sqw: h?.land_size != null ? String(h.land_size) : form.area_sqw });
                }}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                <option value="">— ไม่ผูกแปลง (กรอกพื้นที่เอง) —</option>
                {houses.map(h => (
                  <option key={h.id} value={h.id}>{h.house_number}{h.land_size != null ? ` · ${h.land_size} ตร.ว.` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเจ้าของ *</label>
              <input type="text" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร</label>
              <input type="tel" value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                placeholder="0XX-XXX-XXXX"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">พื้นที่ (ตร.ว.) *</label>
              <input type="number" value={form.area_sqw} onChange={(e) => setForm({ ...form, area_sqw: e.target.value })}
                placeholder="50"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              {form.area_sqw && (
                <p className="text-xs text-aviva-gold mt-1">ค่าส่วนกลางต่อปี: ฿{(Number(form.area_sqw) * 30).toLocaleString("th-TH")}</p>
              )}
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving || !form.owner_name || !form.area_sqw}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "เพิ่มสมาชิก"}
          </button>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Documents (เอกสาร) ───────────────────────────────────────────────────────

interface OfficeDocument {
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

type DocFilterCat = "all" | "Contract" | "Loan" | "Permit" | "Utility";

const docStatusConfig = {
  approved: { label: "อนุมัติแล้ว", icon: CheckCircle, color: "text-green-400", bg: "border-green-400/20" },
  pending:  { label: "รออนุมัติ",   icon: Clock,        color: "text-yellow-400", bg: "border-yellow-400/20" },
  rejected: { label: "ปฏิเสธ",      icon: XCircle,      color: "text-red-400",    bg: "border-red-400/20" },
};

const docCategoryStyle: Record<string, string> = {
  Contract: "bg-purple-500/20 text-purple-400",
  Loan:     "bg-blue-500/20 text-blue-400",
  Permit:   "bg-orange-500/20 text-orange-400",
  Utility:  "bg-teal-500/20 text-teal-400",
  Other:    "bg-gray-500/20 text-gray-400",
};

const docCategoryTh: Record<string, string> = {
  Contract: "สัญญา",
  Loan:     "สินเชื่อ",
  Permit:   "ใบอนุญาต",
  Utility:  "สาธารณูปโภค",
  Other:    "อื่นๆ",
};

function DocumentsContent() {
  const user = useCurrentUser();
  const [docs, setDocs] = useState<OfficeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DocFilterCat>("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Contract", uploaded_by: "", file_url: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchDocs = () => {
    supabase.from("documents").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDocs((data as OfficeDocument[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchDocs(); }, []);

  const counts = {
    approved: docs.filter(d => d.status === "approved").length,
    pending:  docs.filter(d => d.status === "pending").length,
  };

  const filtered = docs.filter(
    d => (filter === "all" || d.category === filter) &&
      (search === "" || d.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const docNum = await generateDocNumber("DOC");
    const { data: docData } = await supabase.from("documents").insert({
      project_id: PROJECT_ID,
      name: form.name,
      category: form.category,
      doc_number: docNum,
      uploaded_by: form.uploaded_by || user?.full_name || user?.email || "ไม่ทราบ",
      file_url: form.file_url || null,
      description: form.description || null,
      status: "pending",
    }).select().single();
    if (docData) {
      await supabase.from("approval_logs").insert({
        workflow_type: "Document_Approval",
        source_doc_index: form.name,
        source_record_id: docData.id,
        submitted_by_user_id: user?.id ?? null,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: null,
        sla_due_at: calcSlaDueAt("Document_Approval"),
        assigned_to_name: "ผู้จัดการ",
      });
    }
    await createNotification({
      type: "document",
      title: "เอกสารใหม่รอการอนุมัติ",
      message: `[${docCategoryTh[form.category] ?? form.category}] ${form.name}${form.description ? ` — ${form.description}` : ""}`,
      from_dept: "ฝ่ายออฟฟิศ",
    });
    setSaving(false);
    setShowModal(false);
    setForm({ name: "", category: "Contract", uploaded_by: "", file_url: "", description: "" });
    fetchDocs();
  };

  const handleApprove = async (id: string, approve: boolean) => {
    const doc = docs.find(d => d.id === id);
    await supabase.from("documents").update({
      status: approve ? "approved" : "rejected",
      approved_by: user?.full_name ?? "Admin",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    await supabase.from("approval_logs").update({ action_taken: approve ? "Approved" : "Rejected", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("source_record_id", id).eq("workflow_type", "Document_Approval").eq("action_taken", "Pending");
    if (doc) {
      await createNotification({
        type: approve ? "success" : "info",
        title: approve ? "อนุมัติเอกสารแล้ว" : "ปฏิเสธเอกสาร",
        message: `${doc.name}${doc.description ? ` — ${doc.description}` : ""}`,
        from_dept: "ฝ่ายออฟฟิศ",
      });
    }
    fetchDocs();
  };

  return (
    <>
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <DeptBriefingPanel dept="document" label="ฝ่ายเอกสาร" />
      <div className="flex items-center justify-between">
        <p className="text-xs text-aviva-secondary">
          {loading ? "กำลังโหลด..." : `${docs.length} ไฟล์`}
        </p>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
          <Upload size={13} /> เพิ่มเอกสาร
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">{loading ? "—" : counts.approved}</p>
          <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <Clock size={16} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-yellow-400">{loading ? "—" : counts.pending}</p>
          <p className="text-[10px] text-aviva-secondary">รออนุมัติ</p>
        </GlassCard>
        <GlassCard gold className="p-3 text-center">
          <FolderOpen size={16} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-gold">{loading ? "—" : docs.length}</p>
          <p className="text-[10px] text-aviva-secondary">ทั้งหมด</p>
        </GlassCard>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
        <input
          type="text"
          placeholder="ค้นหาเอกสาร..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "Contract", "Loan", "Permit", "Utility"] as DocFilterCat[]).map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={clsx("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              filter === cat ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>
            {cat === "all" ? "ทั้งหมด" : docCategoryTh[cat]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <SectionHeader title={`เอกสาร (${filtered.length})`} />
        {loading
          ? [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />)
          : filtered.length === 0
          ? (
            <GlassCard className="p-8 text-center">
              <p className="text-aviva-secondary text-sm">ไม่พบเอกสาร</p>
            </GlassCard>
          )
          : filtered.map((doc) => {
              const sConf = docStatusConfig[doc.status] ?? docStatusConfig.pending;
              const Icon = sConf.icon;
              return (
                <GlassCard key={doc.id} className={clsx("p-3 border", sConf.bg)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-aviva-card flex items-center justify-center flex-shrink-0">
                      <FolderOpen size={16} className="text-aviva-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {doc.doc_number && (
                          <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-md border border-aviva-gold/20 flex-shrink-0">
                            {doc.doc_number}
                          </span>
                        )}
                        <p className="text-sm text-aviva-text font-medium truncate">{doc.name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", docCategoryStyle[doc.category])}>
                          {docCategoryTh[doc.category] ?? doc.category}
                        </span>
                        <span className="text-[10px] text-aviva-secondary">{doc.uploaded_by}</span>
                      </div>
                      {doc.description && (
                        <p className="text-[10px] text-aviva-secondary/70 mt-0.5 line-clamp-2">{doc.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {doc.file_url && (
                        doc.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                          ? <a href={doc.file_url} target="_blank" rel="noreferrer">
                              <img src={doc.file_url} alt="ไฟล์แนบ" className="w-12 h-12 rounded-lg object-cover border border-aviva-gold/20" />
                            </a>
                          : <a href={doc.file_url} target="_blank" rel="noreferrer"
                              className="text-[10px] text-aviva-gold underline">ดูไฟล์</a>
                      )}
                      <Icon size={14} className={sConf.color} />
                      <span className={clsx("text-[10px] font-medium", sConf.color)}>{sConf.label}</span>
                    </div>
                  </div>
                  {doc.status === "pending" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleApprove(doc.id, true)}
                        className="flex-1 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium">
                        อนุมัติ
                      </button>
                      <button onClick={() => handleApprove(doc.id, false)}
                        className="flex-1 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium">
                        ปฏิเสธ
                      </button>
                    </div>
                  )}
                </GlassCard>
              );
            })}
      </div>
    </div>

    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-aviva-text">เพิ่มเอกสาร</h2>
            <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเอกสาร *</label>
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น สัญญาจะซื้อจะขาย บ้านเลข A-01"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["Contract","Loan","Permit","Utility","Other"].map(c =>
                    <option key={c} value={c}>{docCategoryTh[c] ?? c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">อัปโหลดโดย</label>
                <input type="text" value={form.uploaded_by}
                  onChange={(e) => setForm({ ...form, uploaded_by: e.target.value })}
                  placeholder="ชื่อผู้อัปโหลด"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">คำอธิบายเอกสาร</label>
              <textarea value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="อธิบายวัตถุประสงค์และเนื้อหาของเอกสาร..." rows={2}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ลิงค์ไฟล์ (Google Drive / URL)</label>
              <input type="url" value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "เพิ่มเอกสาร"}
          </button>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS: { key: OfficeTab; label: string; managerOnly?: boolean; constructionOnly?: boolean; adminOnly?: boolean; dept?: string }[] = [
  { key: "finance",     label: "การเงิน",      dept: "ฝ่ายการเงิน" },
  { key: "accounting",  label: "บัญชี",         dept: "ฝ่ายบัญชี" },
  { key: "marketing",   label: "การตลาด",       dept: "ฝ่ายการตลาด" },
  { key: "hr",          label: "บุคคล",          dept: "ฝ่ายบุคคล" },
  { key: "after-sales", label: "หลังการขาย",    dept: "ฝ่ายหลังการขาย" },
  { key: "approvals",   label: "อนุมัติ",        managerOnly: true },
  { key: "materials",   label: "คลังวัสดุ",      constructionOnly: true },
  { key: "documents",   label: "คลังเอกสาร" },
  { key: "community",   label: "ค่าส่วนกลาง",    adminOnly: true },
  { key: "audit",       label: "Audit Log",       adminOnly: true },
];

// ทางลัดสำหรับผู้บริหาร/ผจก.โครงการ — ย้ายมาจากแถบเมนูล่างเพื่อลดความแออัด
// (ลิงก์ไปหน้าเต็ม ไม่ใช่ tab content)
const MANAGER_LINKS: { label: string; href: string }[] = [
  { label: "รายงาน", href: "/reports" },
  { label: "ออกเอกสารขาย", href: "/documents/generate" },
];

// ─── Audit Log Viewer ─────────────────────────────────────────────────────────

interface AuditEntry {
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

function AuditLogContent() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState("ทั้งหมด");
  const [limit, setLimit] = useState(30);

  const fetchLogs = (lim = limit) => {
    let q = supabase.from("audit_log").select("id,module,action,description,performed_by,performed_by_role,performed_by_dept,timestamp,created_at").order("created_at", { ascending: false }).limit(lim);
    if (filterModule !== "ทั้งหมด") q = q.eq("module", filterModule);
    q.then(({ data }) => { setLogs((data as AuditEntry[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchLogs(); }, [filterModule, limit]);

  const MODULES = ["ทั้งหมด", "finance", "hr", "construction", "crm", "approvals", "office", "documents", "materials"];

  const moduleColor: Record<string, string> = {
    finance: "text-green-400 bg-green-500/10",
    hr: "text-teal-400 bg-teal-500/10",
    construction: "text-orange-400 bg-orange-500/10",
    crm: "text-blue-400 bg-blue-500/10",
    approvals: "text-yellow-400 bg-yellow-500/10",
    office: "text-purple-400 bg-purple-500/10",
    documents: "text-pink-400 bg-pink-500/10",
    materials: "text-red-400 bg-red-500/10",
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Audit Log" subtitle="ประวัติการดำเนินงานในระบบ" />
        {logs.length > 0 && (
          <button onClick={() => downloadCsv(`audit-log-${new Date().toISOString().slice(0, 10)}`,
            ["โมดูล", "การกระทำ", "รายละเอียด", "ผู้ดำเนินการ", "บทบาท", "ฝ่าย", "เวลา"],
            logs.map(l => [l.module, l.action, l.description, l.performed_by, l.performed_by_role, l.performed_by_dept, l.created_at ? new Date(l.created_at).toLocaleString("th-TH") : ""]))}
            className="bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-[11px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0">
            CSV
          </button>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {MODULES.map(m => (
          <button key={m} onClick={() => setFilterModule(m)}
            className={clsx("py-1 px-2.5 rounded-lg text-[10px] font-medium border transition-all",
              filterModule === m ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{m}</button>
        ))}
      </div>
      {loading ? (
        [1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl bg-aviva-card/50 animate-pulse" />)
      ) : logs.length === 0 ? (
        <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ไม่มีข้อมูล Audit Log</p></GlassCard>
      ) : (
        <>
          {logs.map(log => (
            <GlassCard key={log.id} className="p-3">
              <div className="flex items-start gap-2.5">
                <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5", moduleColor[log.module] ?? "text-aviva-secondary bg-aviva-bg/50")}>{log.module}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-aviva-text truncate">{log.action}</p>
                  {log.description && <p className="text-[10px] text-aviva-secondary mt-0.5 line-clamp-2">{log.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {log.performed_by && <span className="text-[9px] text-aviva-secondary/70">{log.performed_by}</span>}
                    {log.performed_by_dept && <span className="text-[9px] text-aviva-secondary/50">· {log.performed_by_dept}</span>}
                  </div>
                </div>
                <span className="text-[9px] text-aviva-secondary/50 flex-shrink-0 text-right">
                  {new Date(log.timestamp ?? log.created_at).toLocaleDateString("th-TH", { month: "short", day: "numeric" })}<br/>
                  {new Date(log.timestamp ?? log.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </GlassCard>
          ))}
          {logs.length >= limit && (
            <button onClick={() => { const next = limit + 30; setLimit(next); fetchLogs(next); }}
              className="w-full py-2.5 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-bg">
              โหลดเพิ่มเติม
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfficePage() {
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState<OfficeTab>("finance");
  useFocusHighlight();

  const isConstruction = user?.department === "ฝ่ายก่อสร้าง";
  const visibleTabs = TABS.filter(t => {
    if (t.adminOnly && !user?.isAdmin) return false;
    if (t.managerOnly && !user?.isManager && !user?.isAdmin) return false;
    if (t.constructionOnly && !isConstruction && !user?.isManager && !user?.isAdmin) return false;
    // Regular staff only see their own department's tab (managers/admins see all)
    if (!user?.isManager && !user?.isAdmin && t.dept && t.dept !== user?.department) return false;
    return true;
  });

  useEffect(() => {
    // Deep-link: /office?tab=documents (ใช้ redirect จากหน้า /documents เดิม) — มาก่อน default ตามแผนก
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && TABS.some(t => t.key === tabParam)) { setActiveTab(tabParam as OfficeTab); return; }
    if (user?.department === "ฝ่ายบัญชี") setActiveTab("accounting");
    else if (user?.department === "ฝ่ายการเงิน") setActiveTab("finance");
    else if (user?.department === "ฝ่ายบุคคล") setActiveTab("hr");
    else if (user?.department === "ฝ่ายการตลาด") setActiveTab("marketing");
    else if (user?.department === "ฝ่ายหลังการขาย") setActiveTab("after-sales");
    else if (user?.department === "ฝ่ายก่อสร้าง") setActiveTab("materials");
  }, [user]);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Sticky tab header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-aviva-text mb-3">ออฟฟิศ</h1>
          <div className="flex flex-wrap gap-1.5">
            {visibleTabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={clsx(
                  "py-1.5 px-3 rounded-xl text-[11px] font-semibold border transition-all whitespace-nowrap",
                  activeTab === key
                    ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                    : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}
              >
                {label}
              </button>
            ))}
            {(user?.isManager || user?.isAdmin) && MANAGER_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="py-1.5 px-3 rounded-xl text-[11px] font-semibold border border-aviva-gold/30 bg-aviva-gold/10 text-aviva-gold transition-all whitespace-nowrap inline-flex items-center gap-1"
              >
                {label} <span className="text-[9px]">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Conditional content */}
      {activeTab === "finance"     && <FinanceContent />}
      {activeTab === "accounting"  && <AccountingContent />}
      {activeTab === "marketing"   && <MarketingContent />}
      {activeTab === "hr"          && <HRContent />}
      {activeTab === "after-sales" && <AfterSalesContent />}
      {activeTab === "approvals"   && <ApprovalsContent />}
      {activeTab === "materials"   && <MaterialsContent />}
      {activeTab === "community"   && <CommunityContent />}
      {activeTab === "documents"   && <DocumentsContent />}
      {activeTab === "audit"       && <AuditLogContent />}
    </div>
  );
}
