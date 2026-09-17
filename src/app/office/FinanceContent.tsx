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
import { Approval, ContractorInstallmentPay, FINANCE_CATEGORIES, FinancialStatementsPanel, PROJECT_ID, ProfitabilityPanel, Transaction, approvalTemplates, clearFormDraft, emptyFinanceForm, formatM, useFormDraft } from "./_shared";

export default function FinanceContent() {
  const user = useCurrentUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [materialPurchasePending, setMaterialPurchasePending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyFinanceForm);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"txn" | "approval" | "construction">("txn");
  const [period, setPeriod] = useState<Period>("month");
  const [dateStart, setDateStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [dateEnd, setDateEnd] = useState(() => thaiDateStr());
  const [finLimit, setFinLimit] = useState(50);
  const [kpiModal, setKpiModal] = useState<"income" | "expense" | "cashflow" | "pending" | null>(null);
  const [approvedInsts, setApprovedInsts] = useState<ContractorInstallmentPay[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingInst, setPayingInst] = useState<ContractorInstallmentPay | null>(null);
  const [payForm, setPayForm] = useState({ payment_method: "โอนเงิน", reference_number: "", entry_date: thaiDateStr(), notes: "", wht_rate: DEFAULT_CONTRACTOR_WHT, retention_rate: DEFAULT_RETENTION, vat_included: false });
  const [finToast, setFinToast] = useState<{ msg: string; type: ToastType } | null>(null);
  useFormDraft("office-draft-finance", form, setForm, showModal);

  const fetchData = (limit = finLimit) => {
    let txnQ = supabase.from("finance_transactions").select("*").eq("project_id", PROJECT_ID);
    if (dateStart) txnQ = txnQ.gte("created_at", dateStart);
    if (dateEnd) txnQ = txnQ.lte("created_at", dateEnd + "T23:59:59");
    Promise.all([
      txnQ.order("created_at", { ascending: false }).limit(limit),
      supabase.from("approvals").select("*").eq("module", "finance")
        .order("created_at", { ascending: false }).limit(300),
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
      .order("installment_no").limit(300);
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
    const paidByName = user?.full_name ?? user?.email ?? "ฝ่ายการเงิน";
    // Idempotency: พลิกสถานะ approved→paid แบบ atomic ก่อน (guard .eq status) — ลง JV ต่อเมื่อพลิกได้จริง
    // กันกดจ่ายซ้ำ/JV กำพร้า: ถ้างวดถูกจ่ายไปแล้ว update จะไม่โดนแถวไหน → หยุด ไม่ post JV ซ้ำ
    const { data: flipped } = await supabase.from("contractor_installments")
      .update({ status: "paid", paid_by: paidByName, paid_at: new Date().toISOString() })
      .eq("id", payingInst.id).eq("status", "approved").select("id");
    if (!flipped || flipped.length === 0) {
      setSaving(false);
      alert("งวดนี้ถูกจ่ายไปแล้วหรือยังไม่อนุมัติ — ไม่บันทึกซ้ำ");
      setShowPayModal(false); setPayingInst(null); fetchApprovedInsts();
      return;
    }
    // บันทึกเป็น JV เดียว (jv_entries/jv_lines) — แหล่งบัญชีเดียว ไม่เขียนซ้ำลง accounting_entries
    // ฝัง payment_method / notes ไว้ในคำอธิบายเพื่อคงข้อมูลเดิม โดยขึ้นต้นด้วย "จ่ายงวดก่อสร้าง:" สำหรับ filter
    const unit = payingInst.house_number ?? payingInst.house_id;
    // หัก WHT (ค่าจ้างทำของ) + เงินประกันผลงาน (retention) จากฐานก่อน VAT · บวก VAT 7% ถ้าผู้รับเหมาจด VAT
    const pay = calcContractorPay(payingInst.amount, payForm.wht_rate, payForm.retention_rate, payForm.vat_included);
    let jvDesc = `จ่ายงวดก่อสร้าง: ${payingInst.name} — ยูนิต ${unit} (${payForm.payment_method})`;
    if (pay.vat > 0) jvDesc += ` — VAT 7% ฿${pay.vat.toLocaleString()}`;
    jvDesc += ` — หัก ณ ที่จ่าย ${payForm.wht_rate}% ฿${pay.wht.toLocaleString()}, ประกันผลงาน ${payForm.retention_rate}% ฿${pay.retention.toLocaleString()}, จ่ายสุทธิ ฿${pay.net.toLocaleString()}`;
    if (payForm.notes) jvDesc += ` — ${payForm.notes}`;
    // เดบิตงานระหว่างก่อสร้าง (สินค้าคงเหลือ) = ฐานก่อน VAT · เดบิตภาษีซื้อ (ถ้ามี VAT)
    // หัก WHT/ประกันผลงาน ฝั่งเครดิต จ่ายสุทธิเข้าธนาคาร
    const payLines = [
      { account_code: WIP.code, account_name: WIP.name, debit: pay.base, credit: 0 },
    ];
    if (pay.vat > 0) payLines.push({ account_code: INPUT_VAT.code, account_name: INPUT_VAT.name, debit: pay.vat, credit: 0 });
    if (pay.wht > 0) payLines.push({ account_code: WHT_PAYABLE.code, account_name: WHT_PAYABLE.name, debit: 0, credit: pay.wht });
    if (pay.retention > 0) payLines.push({ account_code: RETENTION_PAYABLE.code, account_name: RETENTION_PAYABLE.name, debit: 0, credit: pay.retention });
    payLines.push({ account_code: BANK.code, account_name: BANK.name, debit: 0, credit: pay.net });
    const jvId = await postJv({
      project_id: PROJECT_ID,
      jv_date: payForm.entry_date,
      description: jvDesc,
      ref_number: payForm.reference_number || null,
      lines: payLines,
    });
    // ลงทะเบียนภาษีซื้อให้ตรงกับใบส่งงวด (เอกสาร = บัญชี) เมื่อมี VAT
    if (pay.vat > 0) {
      await supabase.from("vat_register").insert({
        vat_type: "input", invoice_no: payForm.reference_number || `INST-${payingInst.id.slice(0, 8)}`,
        invoice_date: payForm.entry_date, party_name: `งวดงาน ${payingInst.name} — ยูนิต ${unit}`,
        base_amount: pay.base, vat_amount: pay.vat, total_amount: pay.gross,
        period: yymm(new Date(payForm.entry_date)), etax_status: "pending", project_id: PROJECT_ID,
      });
    }
    // เก็บยอดจ่ายสุทธิลงงวด (P3) เพื่ออ้างอิงย้อนหลัง
    await supabase.from("contractor_installments").update({ net_payout: pay.net }).eq("id", payingInst.id);
    await createNotification({
      type: "success",
      title: `${payingInst.name} — บันทึกจ่ายแล้ว`,
      message: `ยูนิต ${payingInst.house_number ?? payingInst.house_id} — งานงวด ฿${pay.gross.toLocaleString()} หัก WHT ฿${pay.wht.toLocaleString()} + ประกันผลงาน ฿${pay.retention.toLocaleString()} = จ่ายสุทธิ ฿${pay.net.toLocaleString()} โดย ${paidByName}`,
      from_dept: "ฝ่ายการเงิน",
    });
    setSaving(false);
    setShowPayModal(false);
    setPayingInst(null);
    setPayForm({ payment_method: "โอนเงิน", reference_number: "", entry_date: thaiDateStr(), notes: "", wht_rate: DEFAULT_CONTRACTOR_WHT, retention_rate: DEFAULT_RETENTION, vat_included: false });
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
    if (!form.description) { setFinToast({ msg: "กรอกรายละเอียดก่อนบันทึก", type: "error" }); return; }
    // มาตรฐานทีม: ยอดเงินผ่าน parseAmount (กัน NaN/ติดลบ/ลูกน้ำ เช่น "1,000")
    const amt = parseAmount(form.amount);
    if (amt === null) { setFinToast({ msg: AMOUNT_ERROR, type: "error" }); return; }
    const whtRate = parseAmountOrZero(form.wht_rate);
    if (whtRate === null || whtRate > 100) { setFinToast({ msg: "อัตราหัก ณ ที่จ่ายไม่ถูกต้อง (0-100%)", type: "error" }); return; }
    setSaving(true);
    if (amt >= 50000) {
      const finDocNum = await generateDocNumber("FIN");
      const { data, error: apprErr } = await supabase.from("approvals").insert({
        module: "finance",
        reference_type: "transaction",
        amount: amt,
        description: `[${form.category}] ${form.description}`,
        status: "pending",
        requested_by: user?.full_name ?? "Admin",
      }).select().single();
      if (apprErr) { setSaving(false); setFinToast({ msg: thaiDbError(apprErr, "ส่งขออนุมัติ"), type: "error" }); return; }
      const { data: logRow, error: logErr } = await supabase.from("approval_logs").insert({
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
      if (logErr) { setSaving(false); setFinToast({ msg: thaiDbError(logErr, "ส่งขออนุมัติ"), type: "error" }); return; }
      // แนบใบเสร็จ/สลิป เข้ากับคำขออนุมัติ (ให้ผู้อนุมัติเปิดดูในหน้าตรวจสอบ)
      if (receiptFiles.length && logRow?.approval_id) {
        const urls = await uploadPhotos("document-attachments", `entity-docs/approval_log/${logRow.approval_id}/${Date.now()}`, receiptFiles,
          { onFail: f => setFinToast({ msg: uploadFailText(f), type: "error" }) });
        for (let i = 0; i < urls.length; i++) {
          await attachDocumentToEntity("approval_log", logRow.approval_id, urls[i], receiptFiles[i]?.name ?? `แนบ-${i + 1}`, user?.full_name ?? user?.email ?? "ผู้ขอ");
        }
      }
      await logAction("finance", "request_approval", `ขออนุมัติ ฿${amt.toLocaleString()} — ${form.description}`, data?.id);
      await createNotification({ type: "approval", title: "ขออนุมัติรายจ่าย", message: `จาก ${user?.full_name ?? "ฝ่ายการเงิน"} · [${form.category}] ${form.description} ฿${amt.toLocaleString()} · ส่งให้${amt >= 500000 ? "ผู้บริหาร" : "ผู้จัดการ"}พิจารณา`, from_dept: "ฝ่ายการเงิน", to_dept: "ผู้บริหาร" });
      setFinToast({ msg: "ส่งขออนุมัติแล้ว — รอผู้จัดการ/ผู้บริหารพิจารณา", type: "success" });
    } else {
      const isIncome = form.transaction_type === "income";
      // คำนวณภาษี (เฉพาะรายจ่าย): VAT ซื้อ 7% + หัก ณ ที่จ่าย
      const wht = whtRate;
      const tax = !isIncome && (form.vat_included || wht > 0) ? calcTax(amt, form.vat_included, wht) : null;
      const expenseRecognized = tax ? tax.base : amt; // ค่าใช้จ่ายจริง (ไม่รวม VAT ที่ขอคืนได้)

      const { data, error: txnErr } = await supabase.from("finance_transactions").insert({
        project_id: PROJECT_ID,
        transaction_type: form.transaction_type,
        amount: isIncome ? amt : -expenseRecognized,
        description: `[${form.category}] ${form.description}`,
      }).select().single();
      if (txnErr) { setSaving(false); setFinToast({ msg: thaiDbError(txnErr, "บันทึกรายการ"), type: "error" }); return; }

      // Auto-create JV entry — map หมวด -> บัญชี GL ที่ถูกต้อง (ไม่ hardcode 5000/1100)
      // วันที่แบบเวลาไทย (UTC+7) — กันรายการช่วง 00:00-07:00 น. ตกวันผิด
      const jvDate = thaiDateStr();
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
      setFinToast({ msg: "บันทึกรายการเรียบร้อย", type: "success" });
    }
    setSaving(false);
    setShowModal(false);
    setForm(emptyFinanceForm);
    setReceiptFiles([]);
    clearFormDraft("office-draft-finance");
    fetchData();
  };

  const handleApprove = async (id: string, approved: boolean) => {
    const approval = approvals.find(a => a.id === id);
    if (!approval) return;
    // Maker-Checker: ผู้อนุมัติ/ปฏิเสธ ต้องไม่ใช่ผู้ขอ
    const requester = (approval as { requested_by?: string | null }).requested_by;
    if (requester && user?.full_name && requester === user.full_name) {
      setFinToast({ msg: "ไม่สามารถดำเนินการกับรายการที่ท่านเป็นผู้ขอได้ (Maker-Checker)", type: "error" });
      return;
    }
    // กันอนุมัติซ้ำ (กดรัว/เปิด 2 หน้าต่าง): update เฉพาะแถวที่ยัง pending แล้วตรวจว่าเปลี่ยนจริง
    // — ถ้าไม่มีแถวเปลี่ยน = มีคนดำเนินการไปแล้ว ห้าม insert รายจ่าย/JV ซ้ำ (กันลงบัญชี 2 รอบ)
    const { data: changed, error: updErr } = await supabase.from("approvals").update({
      status: approved ? "approved" : "rejected",
      approved_by: user?.full_name ?? user?.email ?? "Admin",
      approved_at: new Date().toISOString(),
    }).eq("id", id).eq("status", "pending").select("id");
    if (updErr) { setFinToast({ msg: thaiDbError(updErr, "อนุมัติ"), type: "error" }); return; }
    if (!changed || changed.length === 0) {
      setFinToast({ msg: "รายการนี้ถูกดำเนินการไปแล้ว (โดยคุณหรือผู้อนุมัติท่านอื่น)", type: "info" });
      fetchData();
      return;
    }
    if (approved) {
      const { error: txnErr } = await supabase.from("finance_transactions").insert({
        project_id: PROJECT_ID,
        transaction_type: "expense",
        amount: -approval.amount,
        description: approval.description,
      });
      if (txnErr) { setFinToast({ msg: thaiDbError(txnErr, "บันทึกรายจ่ายหลังอนุมัติ"), type: "error" }); return; }
      // Auto-create JV for approved finance transaction — map หมวด -> บัญชี GL ที่ถูกต้อง
      const exp = expenseAccountFor(categoryFromDescription(approval.description));
      await postJv({
        project_id: PROJECT_ID,
        jv_date: thaiDateStr(),
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
      {finToast && <Toast message={finToast.msg} type={finToast.type} onClose={() => setFinToast(null)} />}
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

      <div className="flex items-center gap-2">
        <div className="flex-1"><PeriodFilter period={period} onChange={(p, s, e) => { setPeriod(p); setDateStart(s); setDateEnd(e); }} /></div>
        <button
          onClick={() => downloadCsv(`finance-transactions-${thaiDateStr()}`,
            ["วันที่", "ประเภท", "จำนวนเงิน", "รายละเอียด"],
            transactions.map(t => [t.created_at ? new Date(t.created_at).toLocaleDateString("th-TH") : "", t.transaction_type === "income" ? "รายรับ" : "รายจ่าย", t.amount ?? 0, t.description ?? ""]))}
          className="flex items-center gap-1 text-[11px] font-semibold text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-2.5 py-1.5 rounded-xl flex-shrink-0"
        >
          <Download size={11} /> CSV
        </button>
      </div>

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
              <button aria-label="ปิด" onClick={() => { setShowPayModal(false); setPayingInst(null); }}><X size={20} className="text-aviva-secondary" /></button>
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
                <label htmlFor="payform-payment_method" className="text-xs text-aviva-secondary mb-1 block">วิธีการชำระเงิน</label>
                <select id="payform-payment_method" value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["โอนเงิน", "เช็ค", "เงินสด"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="payform-reference_number" className="text-xs text-aviva-secondary mb-1 block">เลขที่อ้างอิง (ถ้ามี)</label>
                <input id="payform-reference_number" type="text" value={payForm.reference_number} onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })}
                  placeholder="เลขที่โอน / เลขที่เช็ค"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="payform-entry_date" className="text-xs text-aviva-secondary mb-1 block">วันที่จ่าย</label>
                <input id="payform-entry_date" type="date" value={payForm.entry_date} onChange={e => setPayForm({ ...payForm, entry_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="payform-wht_rate" className="text-xs text-aviva-secondary mb-1 block">หัก ณ ที่จ่าย (%)</label>
                  <input id="payform-wht_rate" type="number" inputMode="decimal" value={payForm.wht_rate}
                    onChange={e => setPayForm({ ...payForm, wht_rate: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="payform-retention_rate" className="text-xs text-aviva-secondary mb-1 block">เงินประกันผลงาน (%)</label>
                  <input id="payform-retention_rate" type="number" inputMode="decimal" value={payForm.retention_rate}
                    onChange={e => setPayForm({ ...payForm, retention_rate: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={payForm.vat_included}
                  onChange={e => setPayForm({ ...payForm, vat_included: e.target.checked })}
                  className="w-4 h-4 accent-aviva-gold" />
                <span className="text-xs text-aviva-secondary">ผู้รับเหมาจด VAT — บวกภาษีซื้อ 7% (ตรงกับใบส่งงวด)</span>
              </label>
              {payingInst && (() => {
                const pay = calcContractorPay(payingInst.amount, payForm.wht_rate, payForm.retention_rate, payForm.vat_included);
                return (
                  <div className="bg-aviva-bg/50 border border-aviva-gold/10 rounded-xl px-4 py-2.5 text-xs space-y-1">
                    <div className="flex justify-between text-aviva-secondary"><span>มูลค่างานงวด (ก่อน VAT)</span><span>฿{pay.base.toLocaleString()}</span></div>
                    {pay.vat > 0 && <div className="flex justify-between text-sky-400/90"><span>+ ภาษีซื้อ VAT 7%</span><span>+฿{pay.vat.toLocaleString()}</span></div>}
                    <div className="flex justify-between text-red-400/90"><span>หัก ณ ที่จ่าย {payForm.wht_rate}%</span><span>−฿{pay.wht.toLocaleString()}</span></div>
                    <div className="flex justify-between text-orange-400/90"><span>หักประกันผลงาน {payForm.retention_rate}%</span><span>−฿{pay.retention.toLocaleString()}</span></div>
                    <div className="flex justify-between text-aviva-gold font-bold border-t border-aviva-gold/10 pt-1"><span>จ่ายสุทธิ</span><span>฿{pay.net.toLocaleString()}</span></div>
                  </div>
                );
              })()}
              <div>
                <label htmlFor="payform-notes" className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <input id="payform-notes" type="text" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
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
              <button aria-label="ปิด" onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
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
                <label htmlFor="finform-amount" className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท) *</label>
                <input id="finform-amount" type="number" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                {(parseAmount(form.amount) ?? 0) >= 50000 && (
                  <p className="text-[11px] text-yellow-400 mt-1 flex items-center gap-1">
                    <Clock size={10} /> ≥ ฿50,000 จะเข้าระบบอนุมัติก่อน
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="finform-description" className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                <input id="finform-description" type="text" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="อธิบายรายการ..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="finform-category" className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select id="finform-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {FINANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="finform-cost_center" className="text-xs text-aviva-secondary mb-1 block">Cost Center (ระบุถ้ามี)</label>
                <input id="finform-cost_center" type="text" value={form.cost_center}
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

            {(parseAmount(form.amount) ?? 0) >= 50000 && (
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">แนบใบเสร็จ / สลิป (ให้ผู้อนุมัติตรวจสอบ · เลือกได้หลายไฟล์)</label>
                <MultiPhotoInput value={receiptFiles} onChange={setReceiptFiles} accept="image/*,application/pdf" label="แตะเพื่อแนบรูป/ไฟล์ PDF" />
              </div>
            )}

            <button onClick={handleSave} disabled={saving || !form.amount || !form.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : (parseAmount(form.amount) ?? 0) >= 50000 ? "ส่งขออนุมัติ" : "บันทึก"}
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
              <button aria-label="ปิด" onClick={() => setKpiModal(null)}><X size={20} className="text-aviva-secondary" /></button>
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
