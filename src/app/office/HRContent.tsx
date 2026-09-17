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
import { DEPARTMENTS, Employee, LEAVE_QUOTA, PROJECT_ID, WEEKLY_OFF_OPTIONS, deptColor, emptyEmployeeForm, formatM, formatThb, leaveDays, leaveTemplates, today } from "./_shared";
import PayrollContent from "./PayrollContent";

export default function HRContent() {
  const user = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  // รายชื่อพนักงานแบบปลอดภัย (ไม่มีเงินเดือน) — ใช้กับ dropdown ยื่นคำขอลาที่พนักงานทุกคนต้องเข้าถึงได้
  // แยกจาก employees (ตารางเต็มมีฐานเงินเดือน — RLS จำกัดเฉพาะผู้บริหาร/บัญชี/บุคคล)
  const [directory, setDirectory] = useState<{ id: string; full_name: string; department: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyEmployeeForm);
  const [saving, setSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [filterDept, setFilterDept] = useState("ทั้งหมด");
  const [kpiModalHR, setKpiModalHR] = useState<"employees" | "probation" | "salary" | null>(null);
  const [hrTab, setHrTab] = useState<"บุคคล" | "ลงเวลา" | "เงินเดือน" | "การลา" | "กล้องวงจรปิด">("บุคคล");
  const [leaveForm, setLeaveForm] = useState({ employee_name: "", leave_type: "ลาพักร้อน", date_from: "", date_to: "", reason: "" });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveList, setLeaveList] = useState<{id:string;employee_name:string;leave_type:string;date_from:string;date_to:string;reason:string;status:string;created_at:string;days_count:number|null;doctor_cert_required:boolean}[]>([]);
  const [hrToast, setHrToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showPRModal, setShowPRModal] = useState(false);
  const [prForm, setPrForm] = useState({ supplier_name: "", description: "", amount: "", notes: "" });
  const [prSaving, setPrSaving] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState<{annual:number;sick:number;study:number;personal:number;maternity:number;absent:number;annual_status:"Normal"|"Low"|"Critical"}|null>(null);

  const fetchEmployees = () => {
    supabase.from("employees").select("*")
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => {
        setEmployees((data as Employee[]) ?? []);
        setLoading(false);
      });
  };

  const fetchDirectory = () => {
    supabase.from("employees_directory").select("id,full_name,department,status")
      .then(({ data }) => setDirectory(data ?? []));
  };

  const fetchLeave = () => {
    setLeaveLoading(true);
    // C4: sync สถานะล่าสุดจาก approval_logs ให้ตรงกับหน้า /approvals
    Promise.all([
      supabase.from("leave_requests").select("id,employee_name,leave_type,date_from,date_to,reason,status,created_at,days_count,doctor_cert_required").order("created_at", { ascending: false }).limit(30),
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

  const fetchLeaveBalance = async (employeeName: string) => {
    if (!employeeName) { setLeaveBalance(null); return; }
    const emp = employees.find(e => e.full_name === employeeName);
    if (!emp) return;
    const { data } = await supabase.from("employee_payroll_config").select("annual_leave_balance,sick_leave_balance,study_leave_balance,personal_leave_balance,maternity_leave_balance,absent_days,annual_leave_status").eq("employee_id", emp.id).single();
    if (data) {
      setLeaveBalance({
        annual: data.annual_leave_balance ?? 15,
        sick: data.sick_leave_balance ?? 10,
        study: data.study_leave_balance ?? 5,
        personal: data.personal_leave_balance ?? 3,
        maternity: data.maternity_leave_balance ?? 98,
        absent: data.absent_days ?? 0,
        annual_status: data.annual_leave_status ?? "Normal"
      });
    }
  };

  useEffect(() => { fetchEmployees(); fetchDirectory(); }, []);

  // มาจากกล่องงาน (/office?tab=hr&focus=<leaveId>) → เปิดแท็บ "การลา" ให้เห็นใบลาที่ต้องอนุมัติ
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("focus")) setHrTab("การลา");
  }, []);

  useEffect(() => { if (hrTab === "การลา") fetchLeave(); }, [hrTab]);

  // ── ขอสลับวันหยุด (พนักงานขอ → ผู้บริหารอนุมัติ → มีผลกับการนับวันหยุด/ส่งรายงาน) ──
  const [swapForm, setSwapForm] = useState({ employee_name: "", original_off_date: "", swapped_off_date: "", reason: "" });
  const [swapSaving, setSwapSaving] = useState(false);
  const [swapList, setSwapList] = useState<OffDaySwap[]>([]);

  const fetchSwaps = useCallback(async () => {
    if (!user?.email) return;
    setSwapList(user.isManager ? await loadPendingSwaps() : await loadMySwaps(user.email));
  }, [user?.email, user?.isManager]);
  useEffect(() => { if (hrTab === "การลา") fetchSwaps(); }, [hrTab, fetchSwaps]);

  const handleSwapSubmit = async () => {
    const emp = employees.find(e => e.full_name === swapForm.employee_name);
    if (!emp || !swapForm.original_off_date || !swapForm.swapped_off_date) return;
    if (swapForm.original_off_date === swapForm.swapped_off_date) {
      setHrToast({ msg: "วันที่มาทำงานแทนกับวันที่ขอหยุดต้องไม่ใช่วันเดียวกัน", type: "error" });
      return;
    }
    setSwapSaving(true);
    const { data: execs } = await supabase.from("users").select("email").in("role", ["admin", "ceo", "coo"]);
    const res = await requestSwap({
      employeeId: emp.id,
      employeeEmail: emp.email || user?.email || "",
      employeeName: emp.full_name,
      department: emp.department ?? null,
      originalOffDate: swapForm.original_off_date,
      swappedOffDate: swapForm.swapped_off_date,
      reason: swapForm.reason,
      executiveEmails: ((execs ?? []) as { email: string | null }[]).map(e => e.email ?? "").filter(Boolean),
    });
    setSwapSaving(false);
    if (!res.ok) { setHrToast({ msg: res.error ?? "ส่งคำขอไม่สำเร็จ", type: "error" }); return; }
    await logAction("hr", "swap_request", `ขอสลับวันหยุด ${emp.full_name}: ทำงาน ${swapForm.original_off_date} / หยุด ${swapForm.swapped_off_date}`);
    setSwapForm({ employee_name: "", original_off_date: "", swapped_off_date: "", reason: "" });
    setHrToast({ msg: "ส่งคำขอสลับวันหยุดแล้ว — รอผู้บริหารอนุมัติ", type: "success" });
    fetchSwaps();
  };

  const handleSwapDecision = async (s: OffDaySwap, approve: boolean) => {
    setSwapSaving(true);
    const res = await decideSwap(s, approve, user?.full_name ?? user?.email ?? "ผู้บริหาร", user?.role ?? null);
    setSwapSaving(false);
    if (!res.ok) { setHrToast({ msg: res.error ?? "ดำเนินการไม่สำเร็จ", type: "error" }); return; }
    await logAction("hr", approve ? "swap_approve" : "swap_reject", `${approve ? "อนุมัติ" : "ไม่อนุมัติ"}สลับวันหยุด ${s.employee_name}`);
    setHrToast({ msg: approve ? "อนุมัติสลับวันหยุดแล้ว" : "ไม่อนุมัติคำขอแล้ว", type: "success" });
    fetchSwaps();
  };

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

    // Check against new leave balance system (Phase 2.1)
    if (leaveBalance) {
      const balanceMap: Record<string, number | undefined> = { "ลาพักร้อน": leaveBalance.annual, "ลาป่วย": leaveBalance.sick, "ลากิจ": leaveBalance.personal, "ลาคลอด": leaveBalance.maternity };
      const balance = balanceMap[leaveForm.leave_type as keyof typeof balanceMap];
      if (balance != null && days > balance) {
        setHrToast({ msg: `ลาครบ — เหลือ ${balance} วัน (ขอ ${days} วัน)\nกรุณาตรวจสอบยอดวันลาของคุณ`, type: "error" });
        setLeaveSaving(false);
        return;
      }
    }

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
    const emp = employees.find(e => e.full_name === leaveForm.employee_name);
    try {
      await createLeaveRequest({
        employeeName: leaveForm.employee_name,
        leaveType: leaveForm.leave_type,
        dateFrom: leaveForm.date_from,
        dateTo: leaveForm.date_to,
        reason: leaveForm.reason,
        userId: user?.id ?? null,
        employeeId: emp?.id ?? null,
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

  // อนุมัติ/ปฏิเสธใบลา จากกล่องงาน (ผู้บริหาร) — ปิด loop ให้ทำงานต่อได้จริง ไม่ค้าง
  const [leaveActing, setLeaveActing] = useState<string | null>(null);
  const handleLeaveDecision = async (
    l: { id: string; employee_name: string; leave_type: string; date_from: string; date_to: string },
    approved: boolean,
  ) => {
    if (leaveActing) return;
    setLeaveActing(l.id);
    const byName = user?.full_name ?? "ผู้บริหาร";
    const newStatus = approved ? "approved" : "rejected";
    try {
      // 1) อัปเดตสถานะใบลา + บันทึกผู้อนุมัติ (trigger log_leave_request ใช้ approved_by)
      const { error } = await supabase.from("leave_requests").update({
        status: newStatus,
        approved_by: byName,
        approved_by_role: user?.role ?? null,
        approved_at: new Date().toISOString(),
      }).eq("id", l.id);
      if (error) throw error;
      // 2) ซิงก์ approval_logs ถ้ามี (best-effort — test data เก่าอาจไม่มี)
      await supabase.from("approval_logs")
        .update({ action_taken: approved ? "Approved" : "Rejected", action_timestamp: new Date().toISOString(), approver_email: user?.email ?? null })
        .eq("source_record_id", l.id).eq("workflow_type", "Leave_Request");
      // 3) ปิดงานในกล่องงานผู้บริหาร (best-effort)
      await closeWorkQueue(l.id, "manager", byName);
      // 4) แจ้งเตือนฝ่ายบุคคล
      await createNotification({
        type: "info",
        title: approved ? "อนุมัติใบลาแล้ว" : "ปฏิเสธใบลา",
        message: `${l.employee_name} · ${l.leave_type} (${l.date_from} – ${l.date_to}) — ${approved ? "อนุมัติ" : "ปฏิเสธ"}โดย ${byName}`,
        from_dept: "ผู้บริหาร",
        to_dept: "ฝ่ายบุคคล",
      });
      await logAction("hr", approved ? "approve_leave" : "reject_leave", `${approved ? "อนุมัติ" : "ปฏิเสธ"}ใบลา ${l.employee_name} (${l.date_from} – ${l.date_to})`, l.id);
      setHrToast({ msg: approved ? "อนุมัติใบลาแล้ว" : "ปฏิเสธใบลาแล้ว", type: "success" });
      fetchLeave();
    } catch {
      setHrToast({ msg: "ดำเนินการไม่สำเร็จ — ลองใหม่อีกครั้ง", type: "error" });
    } finally {
      setLeaveActing(null);
    }
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
        base_salary: parseAmountOrZero(form.base_salary) ?? 0,
        commission_rate: parseAmountOrZero(form.commission_rate) ?? 0,
        weekly_off_day: form.weekly_off_day === "" ? null : Number(form.weekly_off_day),
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
        base_salary: parseAmountOrZero(form.base_salary) ?? 0,
        commission_rate: parseAmountOrZero(form.commission_rate) ?? 0,
        start_date: form.start_date,
        employee_code: empCode,
        status: "active",
        weekly_off_day: form.weekly_off_day === "" ? null : Number(form.weekly_off_day),
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
    const today = thaiDateStr();
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
      weekly_off_day: emp.weekly_off_day != null ? String(emp.weekly_off_day) : "",
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
      <div className="px-4 pt-6 pb-0 max-w-lg mx-auto">
        <DeptAIChat dept="hr" label="AI ฝ่ายบุคคล" />
        <DeptBriefingPanel dept="hr" label="ฝ่ายบุคคล" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["บุคคล", "ลงเวลา", "เงินเดือน", "การลา", "กล้องวงจรปิด"] as const).map(t => (
            <button key={t} onClick={() => setHrTab(t)}
              className={clsx("py-3 px-2 rounded-xl text-xs font-medium border transition-all text-center",
                hrTab === t ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10 hover:border-aviva-gold/30"
              )}>{t}</button>
          ))}
        </div>
      </div>

      {hrTab === "ลงเวลา" && (
        <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
          <GlassCard className="p-4">
            <p className="text-xs text-aviva-secondary mb-3 block">เลือกวันที่เพื่อดูรายงานลงเวลา</p>
            <input type="date" defaultValue={today}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 mb-4" />
            <div className="grid grid-cols-4 gap-2">
              <GlassCard className="p-3 text-center">
                <p className="text-xs text-aviva-secondary">เข้างาน</p>
                <p className="text-lg font-bold text-green-400 mt-1">—</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-xs text-aviva-secondary">ขาด</p>
                <p className="text-lg font-bold text-red-400 mt-1">—</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-xs text-aviva-secondary">สาย</p>
                <p className="text-lg font-bold text-yellow-400 mt-1">—</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-xs text-aviva-secondary">อัตรา %</p>
                <p className="text-lg font-bold text-blue-400 mt-1">—</p>
              </GlassCard>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-xs text-aviva-secondary text-center">ข้อมูลลงเวลาในระบบการจัดการ</p>
          </GlassCard>
        </div>
      )}

      {hrTab === "เงินเดือน" && <PayrollContent />}

      {hrTab === "การลา" && (
        <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
          <GlassCard className="p-4 space-y-3">
            <p className="text-sm font-semibold text-aviva-text">ยื่นคำขอลา</p>
            <div>
              <label htmlFor="leaveform-employee_name" className="text-xs text-aviva-secondary mb-1 block">ชื่อพนักงาน *</label>
              <select id="leaveform-employee_name" value={leaveForm.employee_name} onChange={e => { setLeaveForm({...leaveForm, employee_name: e.target.value}); fetchLeaveBalance(e.target.value); }}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                <option value="">— เลือกพนักงาน —</option>
                {directory.map(e => (
                  <option key={e.id} value={e.full_name}>{e.full_name} ({e.department})</option>
                ))}
              </select>
            </div>
            {leaveBalance && leaveForm.employee_name && (
              <div className="p-3 bg-aviva-bg border border-aviva-gold/20 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-aviva-secondary">ยอดวันลาคงเหลือ</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-[10px] text-aviva-secondary">พักร้อน</p>
                    <p className={clsx("text-base font-bold", leaveBalance.annual_status === "Critical" ? "text-red-400" : leaveBalance.annual_status === "Low" ? "text-yellow-400" : "text-green-400")}>
                      {leaveBalance.annual} วัน
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-aviva-secondary">ลาป่วย</p>
                    <p className="text-base font-bold text-aviva-text">{leaveBalance.sick} วัน</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-aviva-secondary">ลากิจ</p>
                    <p className="text-base font-bold text-aviva-text">{leaveBalance.personal} วัน</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-aviva-secondary">ขาดงาน</p>
                    <p className={clsx("text-base font-bold", leaveBalance.absent > 0 ? "text-red-400" : "text-aviva-text")}>{leaveBalance.absent} วัน</p>
                  </div>
                </div>
                {leaveBalance.annual_status !== "Normal" && (
                  <p className={clsx("text-[10px] text-center font-medium", leaveBalance.annual_status === "Critical" ? "text-red-400" : "text-yellow-400")}>
                    ⚠️ {leaveBalance.annual_status === "Critical" ? "วันลาคงเหลือน้อยมาก" : "วันลาคงเหลือน้อย"}
                  </p>
                )}
              </div>
            )}
            <div>
              <label htmlFor="leaveform-leave_type" className="text-xs text-aviva-secondary mb-1 block">ประเภทการลา</label>
              <select id="leaveform-leave_type" value={leaveForm.leave_type} onChange={e => setLeaveForm({...leaveForm, leave_type: e.target.value})}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                {["ลาพักร้อน","ลาป่วย","ลากิจ","ลาคลอด","ขาดงาน","ลาครอบครัว","ลาอื่นๆ"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="leaveform-date_from" className="text-xs text-aviva-secondary mb-1 block">วันที่เริ่มลา</label>
                <input id="leaveform-date_from" type="date" value={leaveForm.date_from} onChange={e => setLeaveForm({...leaveForm, date_from: e.target.value})}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="leaveform-date_to" className="text-xs text-aviva-secondary mb-1 block">วันที่กลับ</label>
                <input id="leaveform-date_to" type="date" value={leaveForm.date_to} onChange={e => setLeaveForm({...leaveForm, date_to: e.target.value})}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <div>
              <label htmlFor="leaveform-reason" className="text-xs text-aviva-secondary mb-1 block">เหตุผล</label>
              <input id="leaveform-reason" type="text" value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                placeholder="ระบุเหตุผล (ถ้ามี)"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            {leaveForm.leave_type === "ลาป่วย" && leaveForm.date_from && leaveForm.date_to && leaveDays(leaveForm.date_from, leaveForm.date_to) > 3 && (
              <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
                ⚠️ ลาป่วยเกิน 3 วัน — ต้องมีใบรับรองแพทย์ (พ.ร.บ.คุ้มครองแรงงาน) ถ้าไม่มีจะถูกเปลี่ยนเป็นลากิจ
              </p>
            )}
            {leaveForm.leave_type === "ขาดงาน" && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                ขาดงานจะถูกบันทึกเป็นวันขาด — ไม่หักจากวันลา แต่อาจมีผลทางวินัย
              </p>
            )}
            <button onClick={handleLeaveSubmit} disabled={leaveSaving || !leaveForm.employee_name || !leaveForm.date_from || !leaveForm.date_to}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
              {leaveSaving ? "กำลังส่ง..." : "ส่งคำขอลา"}
            </button>
          </GlassCard>

          {/* ขอสลับวันหยุด — ไม่ใช้สิทธิ์วันลา แค่ย้ายว่าสัปดาห์นั้นหยุดวันไหน */}
          <GlassCard className="p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-aviva-gold">ขอสลับวันหยุด</p>
              <p className="text-[10px] text-aviva-secondary/70 mt-0.5">ย้ายวันหยุดประจำสัปดาห์เฉพาะครั้งนั้น — ไม่ตัดสิทธิ์วันลา · มีผลหลังผู้บริหารอนุมัติ</p>
            </div>
            <div>
              <label htmlFor="swapform-employee" className="text-xs text-aviva-secondary mb-1 block">พนักงาน</label>
              <select id="swapform-employee" value={swapForm.employee_name} onChange={e => setSwapForm({ ...swapForm, employee_name: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text">
                <option value="">เลือกพนักงาน</option>
                {active.map(e => <option key={e.id} value={e.full_name}>{e.full_name}{e.nickname ? ` (${e.nickname})` : ""}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="swapform-original" className="text-xs text-aviva-secondary mb-1 block">วันหยุดเดิม (มาทำงานแทน)</label>
                <input id="swapform-original" type="date" value={swapForm.original_off_date}
                  onChange={e => setSwapForm({ ...swapForm, original_off_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              <div>
                <label htmlFor="swapform-swapped" className="text-xs text-aviva-secondary mb-1 block">วันที่ขอหยุดแทน</label>
                <input id="swapform-swapped" type="date" value={swapForm.swapped_off_date}
                  onChange={e => setSwapForm({ ...swapForm, swapped_off_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
            </div>
            <div>
              <label htmlFor="swapform-reason" className="text-xs text-aviva-secondary mb-1 block">เหตุผล (ถ้ามี)</label>
              <input id="swapform-reason" type="text" value={swapForm.reason} onChange={e => setSwapForm({ ...swapForm, reason: e.target.value })}
                placeholder="เช่น มีธุระวันพุธ ขอสลับมาหยุดวันพฤหัสแทน"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
            </div>
            <button onClick={handleSwapSubmit} disabled={swapSaving || !swapForm.employee_name || !swapForm.original_off_date || !swapForm.swapped_off_date}
              className="w-full bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/40 font-bold py-2.5 rounded-2xl text-sm disabled:opacity-40">
              {swapSaving ? "กำลังส่ง..." : "ส่งคำขอสลับวันหยุด"}
            </button>

            {swapList.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-bold text-aviva-secondary/70">
                  {user?.isManager ? "คำขอรออนุมัติ" : "คำขอของฉัน"}
                </p>
                {swapList.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 bg-aviva-bg/50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-aviva-text truncate">{s.employee_name}</p>
                      <p className="text-[10px] text-aviva-secondary/70">
                        ทำงาน {thSwapDate(s.original_off_date)} · หยุดแทน {thSwapDate(s.swapped_off_date)}
                        {s.reason ? ` — ${s.reason}` : ""}
                      </p>
                    </div>
                    {user?.isManager && s.status === "pending" ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleSwapDecision(s, true)} disabled={swapSaving}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 disabled:opacity-40">อนุมัติ</button>
                        <button onClick={() => handleSwapDecision(s, false)} disabled={swapSaving}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 disabled:opacity-40">ไม่อนุมัติ</button>
                      </div>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                        s.status === "approved" ? "bg-green-500/10 text-green-400 border-green-500/30"
                          : s.status === "rejected" ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-orange-500/10 text-orange-400 border-orange-500/30"
                      }`}>
                        {s.status === "approved" ? "อนุมัติแล้ว" : s.status === "rejected" ? "ไม่อนุมัติ" : "รออนุมัติ"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
          <div className="flex items-center justify-between">
            <SectionHeader title="ประวัติคำขอลา" />
            {leaveList.length > 0 && (
              <button onClick={() => downloadCsv(`leave-requests-${thaiDateStr()}`,
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
                      <p className="text-[10px] text-aviva-secondary">{l.leave_type} · {l.date_from} – {l.date_to}{l.doctor_cert_required ? " · ⚠️ ต้องมีใบรับรองแพทย์" : ""}</p>
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
                  {l.status === "pending" && (user?.isManager || user?.isAdmin) && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleLeaveDecision(l, true)}
                        disabled={leaveActing === l.id}
                        className="flex-1 bg-green-500/15 text-green-400 border border-green-500/30 text-xs font-bold py-2 rounded-xl disabled:opacity-50 active:scale-[0.97] transition-transform">
                        {leaveActing === l.id ? "กำลังทำ..." : "✓ อนุมัติ"}
                      </button>
                      <button
                        onClick={() => handleLeaveDecision(l, false)}
                        disabled={leaveActing === l.id}
                        className="flex-1 bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-bold py-2 rounded-xl disabled:opacity-50 active:scale-[0.97] transition-transform">
                        ✕ ปฏิเสธ
                      </button>
                    </div>
                  )}
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
                      {emp.weekly_off_day != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                          หยุด{WEEKLY_OFF_OPTIONS.find(([, d]) => d === emp.weekly_off_day)?.[0]}
                        </span>
                      )}
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
              <button aria-label="ปิด" onClick={() => { setShowModal(false); setEditingEmployee(null); setForm(emptyEmployeeForm); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="empform-full_name" className="text-xs text-aviva-secondary mb-1 block">ชื่อ-นามสกุล *</label>
                  <input id="empform-full_name" type="text" value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="ชื่อจริง นามสกุล"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="empform-nickname" className="text-xs text-aviva-secondary mb-1 block">ชื่อเล่น</label>
                  <input id="empform-nickname" type="text" value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    placeholder="ชื่อเล่น"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label htmlFor="empform-phone" className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร</label>
                <input id="empform-phone" type="tel" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="empform-email" className="text-xs text-aviva-secondary mb-1 block">Email</label>
                <input id="empform-email" type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="empform-department" className="text-xs text-aviva-secondary mb-1 block">ฝ่าย</label>
                  <select id="empform-department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="empform-position" className="text-xs text-aviva-secondary mb-1 block">ตำแหน่ง</label>
                  <input id="empform-position" type="text" value={form.position}
                    onChange={e => setForm({ ...form, position: e.target.value })}
                    placeholder="เช่น พนักงานขาย"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="empform-base_salary" className="text-xs text-aviva-secondary mb-1 block">เงินเดือน (บาท)</label>
                  <input id="empform-base_salary" type="number" value={form.base_salary}
                    onChange={e => setForm({ ...form, base_salary: e.target.value })}
                    placeholder="15000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="empform-commission_rate" className="text-xs text-aviva-secondary mb-1 block">ค่าคอม (%)</label>
                  <input id="empform-commission_rate" type="number" value={form.commission_rate}
                    onChange={e => setForm({ ...form, commission_rate: e.target.value })}
                    placeholder="1.5" step="0.1"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label htmlFor="empform-start_date" className="text-xs text-aviva-secondary mb-1 block">วันเริ่มงาน</label>
                <input id="empform-start_date" type="date" value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันหยุดประจำสัปดาห์ (เฉพาะคนนี้)</label>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setForm({ ...form, weekly_off_day: "" })}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-semibold border ${form.weekly_off_day === "" ? "bg-aviva-gold/20 text-aviva-gold border-aviva-gold/40" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/15"}`}>
                    ค่ากลาง
                  </button>
                  {WEEKLY_OFF_OPTIONS.map(([label, d]) => (
                    <button type="button" key={d} onClick={() => setForm({ ...form, weekly_off_day: String(d) })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${form.weekly_off_day === String(d) ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/15"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-aviva-secondary/60 mt-1">"ค่ากลาง" = ใช้วันหยุดบริษัทตามที่ตั้งไว้ที่ Settings → เวลาทำงาน & วันหยุด</p>
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
              <button onClick={() => setKpiModalHR(null)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
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

      {hrTab === "กล้องวงจรปิด" && (
        <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
          <GlassCard className="p-4">
            <p className="text-xs text-aviva-secondary mb-3 block">เลือกวันที่เพื่อดูบันทึก CCTV</p>
            <input type="date" defaultValue={today}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 mb-4" />
            <div className="grid grid-cols-4 gap-2">
              <GlassCard className="p-3 text-center">
                <p className="text-xs text-aviva-secondary">เหตุการณ์</p>
                <p className="text-lg font-bold text-blue-400 mt-1">—</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-xs text-aviva-secondary">พนักงาน</p>
                <p className="text-lg font-bold text-green-400 mt-1">—</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-xs text-aviva-secondary">ผู้มาเยี่ยม</p>
                <p className="text-lg font-bold text-purple-400 mt-1">—</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-xs text-aviva-secondary">แจ้งเตือน</p>
                <p className="text-lg font-bold text-red-400 mt-1">—</p>
              </GlassCard>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-xs text-aviva-secondary text-center">ข้อมูล CCTV ในระบบการจัดการ</p>
          </GlassCard>
        </div>
      )}

      {/* Purchase Request Modal — HR */}
      {showPRModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ขอสั่งซื้ออุปกรณ์สำนักงาน</h2>
              <button onClick={() => setShowPRModal(false)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="hrprform-supplier_name" className="text-xs text-aviva-secondary mb-1 block">ผู้จำหน่าย / ร้านค้า *</label>
                <input id="hrprform-supplier_name" type="text" value={prForm.supplier_name} onChange={e => setPrForm(p => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="ชื่อร้าน / บริษัท"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="hrprform-description" className="text-xs text-aviva-secondary mb-1 block">รายการที่ต้องการ *</label>
                <input id="hrprform-description" type="text" value={prForm.description} onChange={e => setPrForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="เช่น กระดาษ A4 x 10 รีม, ปากกา x 20 ด้าม"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="hrprform-amount" className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท)</label>
                <input id="hrprform-amount" type="number" value={prForm.amount} onChange={e => setPrForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="hrprform-notes" className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea id="hrprform-notes" value={prForm.notes} onChange={e => setPrForm(p => ({ ...p, notes: e.target.value }))}
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
