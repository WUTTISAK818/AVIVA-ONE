"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { BadgeCheck, X, CheckCircle, XCircle, ShieldAlert, Clock, AlertTriangle, Search, Download, FileText, BookOpen } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import Toast, { type ToastType } from "@/components/Toast";
import AttachDocButton from "@/components/AttachDocButton";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { createNotification } from "@/lib/notify";
import { SLA_DAYS, calcSlaDueAt } from "@/lib/approval-matrix";

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
  assigned_to_name?: string | null;
  sla_due_at?: string | null;
}

function SlaBadge({ slaDueAt }: { slaDueAt: string | null | undefined }) {
  if (!slaDueAt) return null;
  const due = new Date(slaDueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return (
    <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
      เกินกำหนด {Math.abs(diffDays)} วัน
    </span>
  );
  if (diffDays <= 1) return (
    <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full">
      SLA เหลือ {diffDays} วัน
    </span>
  );
  return (
    <span className="text-[10px] bg-aviva-bg text-aviva-secondary/60 border border-aviva-gold/10 px-1.5 py-0.5 rounded-full">
      SLA {diffDays} วัน
    </span>
  );
}

const DEPT_BY_WORKFLOW: Record<string, string> = {
  Material_Purchase:  "ฝ่ายก่อสร้าง",
  Finance_Approval:   "ฝ่ายการเงิน",
  Installment_Review: "ฝ่ายก่อสร้าง",
  Leave_Request:      "ฝ่ายบุคคล",
  Document_Approval:  "ฝ่ายออฟฟิศ",
  Booking_Deposit:    "ฝ่ายขาย",
  Contract_Approval:  "ฝ่ายขาย",
  Marketing_Budget:   "ฝ่ายการตลาด",
};

const WORKFLOW_LABEL: Record<string, string> = {
  Material_Purchase:  "ขออนุมัติจัดซื้อวัสดุ",
  Finance_Approval:   "ขออนุมัติรายจ่าย",
  Installment_Review: "ตรวจสอบงวดงาน",
  Leave_Request:      "ขออนุมัติการลา",
  Document_Approval:  "ขออนุมัติเอกสาร",
  Booking_Deposit:    "อนุมัติเงินจอง",
  Contract_Approval:  "อนุมัติสัญญาซื้อขาย",
  Marketing_Budget:   "อนุมัติงบการตลาด",
};

const ALL_WORKFLOW_TYPES = Object.keys(WORKFLOW_LABEL);

function fmt(n: number) {
  if (n >= 1_000_000) return `฿${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n/1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

function getSlaBadge(log: ApprovalLog): { label: string; cls: string } | null {
  if (log.action_taken !== "Pending") return null;
  const sla = SLA_DAYS[log.workflow_type] ?? 3;
  const daysPending = Math.floor((Date.now() - new Date(log.created_at).getTime()) / 86_400_000);
  if (daysPending > sla) return { label: `เกิน SLA ${daysPending - sla} วัน`, cls: "bg-red-500/20 text-red-400 border border-red-500/30" };
  if (daysPending >= sla) return { label: "ครบ SLA วันนี้", cls: "bg-orange-500/20 text-orange-400 border border-orange-500/30" };
  return null;
}

function parseDocParts(source: string) {
  const parts = source.split(" | ");
  const docNum = parts[0];
  const desc = parts[1] ?? "";
  const byPart = parts.find(p => p.startsWith("โดย ")) ?? "";
  const submitter = byPart.replace("โดย ", "");
  return { docNum, desc, submitter };
}

// ─── Registry Tab ────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function RegistryContent() {
  const [allLogs, setAllLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    supabase.from("approval_logs").select("*")
      .gte("created_at", dateStart)
      .lte("created_at", dateEnd + "T23:59:59")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => { setAllLogs((data as ApprovalLog[]) ?? []); setLoading(false); });
  }, [dateStart, dateEnd]);

  const filtered = useMemo(() => allLogs.filter(l => {
    if (filterType !== "all" && l.workflow_type !== filterType) return false;
    if (filterStatus !== "all" && l.action_taken !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.source_doc_index.toLowerCase().includes(q);
    }
    return true;
  }), [allLogs, filterType, filterStatus, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: filtered.length,
    pending: filtered.filter(l => l.action_taken === "Pending").length,
    approved: filtered.filter(l => l.action_taken === "Approved").length,
    rejected: filtered.filter(l => l.action_taken === "Rejected").length,
    totalAmount: filtered.filter(l => l.amount != null).reduce((s, l) => s + (l.amount ?? 0), 0),
  }), [filtered]);

  const exportCSV = () => {
    const headers = ["เลขที่เอกสาร","ประเภท","ฝ่าย","รายละเอียด","ผู้ส่ง","วันที่ส่ง","ยอดเงิน (บาท)","สถานะ","ผู้อนุมัติ","วันที่อนุมัติ","เหตุผลปฏิเสธ"];
    const rows = filtered.map(l => {
      const { docNum, desc, submitter } = parseDocParts(l.source_doc_index);
      return [
        docNum,
        WORKFLOW_LABEL[l.workflow_type] ?? l.workflow_type,
        DEPT_BY_WORKFLOW[l.workflow_type] ?? "",
        desc,
        submitter,
        new Date(l.created_at).toLocaleDateString("th-TH"),
        l.amount != null ? l.amount : "",
        l.action_taken === "Pending" ? "รออนุมัติ" : l.action_taken === "Approved" ? "อนุมัติแล้ว" : "ปฏิเสธ",
        l.approver_email ?? "",
        l.action_timestamp ? new Date(l.action_timestamp).toLocaleDateString("th-TH") : "",
        l.rejection_comment ?? "",
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doc-registry-${dateStart}-${dateEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
      {/* Date range filter */}
      <GlassCard className="p-4 space-y-3">
        <p className="text-xs font-medium text-aviva-gold flex items-center gap-1.5"><Clock size={12} /> ช่วงวันที่</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-aviva-secondary mb-1 block">ตั้งแต่</label>
            <input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(0); }}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-aviva-secondary mb-1 block">ถึง</label>
            <input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(0); }}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
          </div>
        </div>
      </GlassCard>

      {/* Search + Type + Status filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary/50" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="ค้นหาเลขที่, รายละเอียด, ผู้ส่ง..."
            className="w-full bg-aviva-card border border-aviva-gold/20 rounded-xl pl-8 pr-4 py-2.5 text-xs text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
        </div>
        <div className="flex gap-2">
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}
            className="flex-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/60">
            <option value="all">ทุกประเภท</option>
            {ALL_WORKFLOW_TYPES.map(t => <option key={t} value={t}>{WORKFLOW_LABEL[t]}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="flex-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/60">
            <option value="all">ทุกสถานะ</option>
            <option value="Pending">รออนุมัติ</option>
            <option value="Approved">อนุมัติแล้ว</option>
            <option value="Rejected">ปฏิเสธ</option>
          </select>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "ทั้งหมด", val: stats.total, cls: "text-aviva-text" },
            { label: "รออนุมัติ", val: stats.pending, cls: "text-yellow-400" },
            { label: "อนุมัติ", val: stats.approved, cls: "text-green-400" },
            { label: "ปฏิเสธ", val: stats.rejected, cls: "text-red-400" },
          ].map(({ label, val, cls }) => (
            <GlassCard key={label} className="p-2 text-center">
              <p className={clsx("text-base font-bold", cls)}>{val}</p>
              <p className="text-[9px] text-aviva-secondary mt-0.5">{label}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Export + count row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-aviva-secondary">{loading ? "กำลังโหลด..." : `พบ ${filtered.length} รายการ`}</p>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 rounded-xl text-xs font-medium disabled:opacity-40 active:scale-95 transition-transform">
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {loading ? (
          [1,2,3,4,5].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : paged.length === 0 ? (
          <GlassCard className="p-10 text-center">
            <FileText size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่พบเอกสารในเงื่อนไขที่เลือก</p>
          </GlassCard>
        ) : paged.map(log => {
          const { docNum, desc, submitter } = parseDocParts(log.source_doc_index);
          const statusCls =
            log.action_taken === "Approved" ? "bg-green-500/20 text-green-400" :
            log.action_taken === "Rejected"  ? "bg-red-500/20 text-red-400" :
            "bg-yellow-500/20 text-yellow-400";
          const statusLabel =
            log.action_taken === "Approved" ? "✓ อนุมัติ" :
            log.action_taken === "Rejected"  ? "✗ ปฏิเสธ" : "รออนุมัติ";
          return (
            <GlassCard key={log.approval_id} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-aviva-gold font-mono">{docNum}</span>
                    <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full font-medium", statusCls)}>{statusLabel}</span>
                    {DEPT_BY_WORKFLOW[log.workflow_type] && (
                      <span className="text-[9px] text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-full">
                        {DEPT_BY_WORKFLOW[log.workflow_type]}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-aviva-text mt-0.5 truncate">{WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type}{desc ? ` — ${desc}` : ""}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {submitter && <p className="text-[10px] text-aviva-secondary truncate">ผู้ส่ง: {submitter}</p>}
                    <p className="text-[10px] text-aviva-secondary/60 flex-shrink-0">
                      {new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                    </p>
                  </div>
                  {log.action_taken !== "Pending" && log.approver_email && (
                    <p className="text-[10px] text-aviva-secondary/60">อนุมัติโดย: {log.approver_email}{log.action_timestamp ? ` · ${new Date(log.action_timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : ""}</p>
                  )}
                  {log.rejection_comment && (
                    <p className="text-[10px] text-red-400/80 mt-0.5 truncate">เหตุผล: {log.rejection_comment}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {log.amount != null && <p className="text-xs font-bold text-aviva-gold">{fmt(log.amount)}</p>}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="flex-1 py-2 rounded-xl text-xs bg-aviva-card border border-aviva-gold/10 text-aviva-secondary disabled:opacity-30">
            ← ก่อนหน้า
          </button>
          <span className="text-xs text-aviva-secondary px-2">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="flex-1 py-2 rounded-xl text-xs bg-aviva-card border border-aviva-gold/10 text-aviva-secondary disabled:opacity-30">
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Approvals Tab ────────────────────────────────────────────────────────────

type FilterTab = "pending" | "approved" | "rejected";

function ApprovalsContent({ logs, loading, fetchLogs }: {
  logs: ApprovalLog[];
  loading: boolean;
  fetchLogs: () => void;
}) {
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState<FilterTab>("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const filtered = logs.filter(l => {
    if (activeTab === "pending") return l.action_taken === "Pending";
    if (activeTab === "approved") return l.action_taken === "Approved";
    return l.action_taken === "Rejected";
  });
  const pendingCount = logs.filter(l => l.action_taken === "Pending").length;
  const overdueCount = logs.filter(l => {
    if (l.action_taken !== "Pending") return false;
    const sla = SLA_DAYS[l.workflow_type] ?? 3;
    return Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86_400_000) > sla;
  }).length;

  const cascadeApprove = async (log: ApprovalLog): Promise<string | null> => {
    if (!log.source_record_id) return null;
    try {
      if (log.workflow_type === "Installment_Review") {
        const { error } = await supabase.from("contractor_installments").update({ status: "approved" }).eq("id", log.source_record_id);
        if (error) return error.message;
      } else if (log.workflow_type === "Material_Purchase") {
        const { error } = await supabase.from("purchase_orders").update({ status: "approved", approved_by: user?.full_name, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
        if (error) return error.message;
      } else if (log.workflow_type === "Document_Approval") {
        const { error } = await supabase.from("documents").update({ status: "approved" }).eq("id", log.source_record_id);
        if (error) return error.message;
      } else if (log.workflow_type === "Booking_Deposit") {
        const { error } = await supabase.from("leads").update({ status: "Booking" }).eq("id", log.source_record_id);
        if (error) return error.message;
      } else if (log.workflow_type === "Finance_Approval") {
        const { error: e1 } = await supabase.from("approvals").update({ status: "approved", approved_by: user?.email, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
        if (e1) return e1.message;
        if (log.amount && log.amount > 0) {
          const desc = log.source_doc_index.split(" | ")[1] ?? "รายจ่ายที่อนุมัติ";
          const { error: e2 } = await supabase.from("finance_transactions").insert({ project_id: "aaaaaaaa-0000-0000-0000-000000000001", transaction_type: "expense", amount: -log.amount, description: desc });
          if (e2) return e2.message;
        }
      } else if (log.workflow_type === "Leave_Request") {
        const { error } = await supabase.from("leave_requests").update({ status: "approved", approved_by: user?.email, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
        if (error) return error.message;
      }
    } catch (e) { return String(e); }
    return null;
  };

  const cascadeReject = async (log: ApprovalLog): Promise<string | null> => {
    if (!log.source_record_id) return null;
    try {
      if (log.workflow_type === "Installment_Review") {
        const { error } = await supabase.from("contractor_installments").update({ status: "pending" }).eq("id", log.source_record_id);
        if (error) return error.message;
      } else if (log.workflow_type === "Material_Purchase") {
        const { error } = await supabase.from("purchase_orders").update({ status: "draft" }).eq("id", log.source_record_id);
        if (error) return error.message;
      } else if (log.workflow_type === "Document_Approval") {
        const { error } = await supabase.from("documents").update({ status: "rejected" }).eq("id", log.source_record_id);
        if (error) return error.message;
      } else if (log.workflow_type === "Finance_Approval") {
        const { error } = await supabase.from("approvals").update({ status: "rejected" }).eq("id", log.source_record_id);
        if (error) return error.message;
      } else if (log.workflow_type === "Leave_Request") {
        const { error } = await supabase.from("leave_requests").update({ status: "rejected" }).eq("id", log.source_record_id);
        if (error) return error.message;
      }
    } catch (e) { return String(e); }
    return null;
  };

  const handleApprove = async (id: string) => {
    setSaving(true);
    const log = logs.find(l => l.approval_id === id);
    if (log && user?.full_name && log.source_doc_index.includes(`โดย ${user.full_name}`)) {
      setSaving(false);
      setToast({ msg: "ไม่สามารถอนุมัติรายการที่ท่านเป็นผู้ส่งได้ (Maker-Checker)", type: "error" });
      return;
    }
    // Guard against double-click race condition
    const { data: freshLog } = await supabase.from("approval_logs").select("action_taken").eq("approval_id", id).single();
    if (freshLog?.action_taken !== "Pending") {
      setSaving(false);
      setToast({ msg: "รายการนี้ได้รับการดำเนินการไปแล้ว", type: "info" });
      fetchLogs();
      return;
    }
    if (log && !user?.isAdmin && (log.amount ?? 0) > 50000 && !log.source_doc_index.startsWith("[2nd Approval]")) {
      const { error: e1 } = await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("approval_id", id);
      if (e1) { setSaving(false); setToast({ msg: "เกิดข้อผิดพลาด: " + e1.message, type: "error" }); return; }
      await supabase.from("approval_logs").insert({
        workflow_type: log.workflow_type,
        source_doc_index: `[2nd Approval] ${log.source_doc_index}`,
        source_record_id: log.source_record_id,
        current_approver_role: "admin",
        action_taken: "Pending",
        amount: log.amount,
        sla_due_at: calcSlaDueAt(log.workflow_type),
        assigned_to_name: "ผู้จัดการ",
      });
      const dept = DEPT_BY_WORKFLOW[log.workflow_type] ?? "ระบบ";
      await createNotification({ type: "info", title: `ส่งอนุมัติชั้น 2 — ${log.source_doc_index}`, message: `${WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type} ผ่านชั้น 1 แล้ว รอผู้บริหารอนุมัติชั้น 2`, from_dept: dept, to_dept: dept });
      setToast({ msg: `ผ่านชั้น 1 แล้ว — ส่งขออนุมัติชั้น 2 (ผู้บริหาร)`, type: "info" });
      setSaving(false); fetchLogs(); return;
    }
    const { error } = await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("approval_id", id);
    if (error) { setSaving(false); setToast({ msg: "เกิดข้อผิดพลาด: " + error.message, type: "error" }); return; }
    if (log) {
      const cascadeError = await cascadeApprove(log);
      const dept = DEPT_BY_WORKFLOW[log.workflow_type] ?? "ระบบ";
      setToast({ msg: cascadeError ? "อนุมัติแล้ว แต่อัปเดตสถานะต้นทางล้มเหลว" : `อนุมัติแล้ว — ${log.source_doc_index}`, type: cascadeError ? "warning" : "success" });
      await createNotification({ type: "success", title: `อนุมัติแล้ว — ${log.source_doc_index}`, message: `${WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type}${log.amount ? ` ฿${Number(log.amount).toLocaleString()}` : ""} ได้รับการอนุมัติแล้ว`, from_dept: dept, to_dept: dept });
    }
    setSaving(false); fetchLogs();
  };

  const handleReject = async (id: string) => {
    setSaving(true);
    const log = logs.find(l => l.approval_id === id);
    if (log && user?.full_name && log.source_doc_index.includes(`โดย ${user.full_name}`)) {
      setSaving(false);
      setToast({ msg: "ไม่สามารถปฏิเสธรายการที่ท่านเป็นผู้ส่งได้ (Maker-Checker)", type: "error" });
      return;
    }
    const { data: freshLog2 } = await supabase.from("approval_logs").select("action_taken").eq("approval_id", id).single();
    if (freshLog2?.action_taken !== "Pending") {
      setSaving(false);
      setToast({ msg: "รายการนี้ได้รับการดำเนินการไปแล้ว", type: "info" });
      fetchLogs();
      return;
    }
    const { error } = await supabase.from("approval_logs").update({ action_taken: "Rejected", action_timestamp: new Date().toISOString(), approver_email: user?.email, rejection_comment: rejectComment }).eq("approval_id", id);
    if (error) { setSaving(false); setToast({ msg: "เกิดข้อผิดพลาด: " + error.message, type: "error" }); return; }
    if (log) {
      const cascadeErr = await cascadeReject(log);
      const dept = DEPT_BY_WORKFLOW[log.workflow_type] ?? "ระบบ";
      setToast({ msg: cascadeErr ? "ปฏิเสธแล้ว แต่อัปเดตสถานะต้นทางล้มเหลว" : `ปฏิเสธแล้ว — ${log.source_doc_index}`, type: cascadeErr ? "warning" : "info" });
      await createNotification({ type: "info", title: `ปฏิเสธ — ${log.source_doc_index}`, message: `${WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type} ถูกปฏิเสธ${rejectComment ? `: ${rejectComment}` : ""}`, from_dept: dept, to_dept: dept });
    }
    setSaving(false); setRejectingId(null); setRejectComment(""); fetchLogs();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-xs text-red-400 font-medium">{overdueCount} รายการเกิน SLA — ต้องอนุมัติด่วน</span>
        </div>
      )}
      <div className="flex gap-2">
        {[
          { k: "pending",  l: `รออนุมัติ${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          { k: "approved", l: "อนุมัติแล้ว" },
          { k: "rejected", l: "ปฏิเสธ" },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => setActiveTab(k as FilterTab)}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              activeTab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>
      <div className="space-y-3">
        {loading ? [1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />) :
        filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <BadgeCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีรายการในหมวดนี้</p>
          </GlassCard>
        ) : filtered.map(log => {
          const slaBadge = getSlaBadge(log);
          return (
            <GlassCard key={log.approval_id} className={clsx("p-4 space-y-3", slaBadge ? "border border-red-500/20" : "")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-aviva-gold font-mono">{log.source_doc_index.split(" | ")[0]}</span>
                    {log.amount != null && log.amount > 50000 && (
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ShieldAlert size={9} /> 2 ชั้น</span>
                    )}
                    {slaBadge && (
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5", slaBadge.cls)}>
                        <AlertTriangle size={9} /> {slaBadge.label}
                      </span>
                    )}
                  </div>
                  {log.source_doc_index.includes(" | ") && (
                    <p className="text-[10px] text-aviva-secondary/70 mt-0.5 truncate">{log.source_doc_index.split(" | ").slice(1).join(" · ")}</p>
                  )}
                  <p className="text-sm text-aviva-text mt-0.5">{WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-aviva-secondary">ผู้อนุมัติ: {log.current_approver_role}</p>
                    {DEPT_BY_WORKFLOW[log.workflow_type] && <span className="text-[10px] text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-full">{DEPT_BY_WORKFLOW[log.workflow_type]}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock size={9} className="text-aviva-secondary/50" />
                    <p className="text-[10px] text-aviva-secondary/60">
                      ส่งเมื่อ {new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      {log.action_taken === "Pending" && ` · SLA ${SLA_DAYS[log.workflow_type] ?? 3} วันทำงาน`}
                      {log.action_timestamp && log.action_taken !== "Pending" && ` · อัปเดต ${new Date(log.action_timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>
                  {log.approver_email && log.action_taken !== "Pending" && <p className="text-[10px] text-aviva-secondary/60 mt-0.5">โดย: {log.approver_email}</p>}
                  {log.action_taken === "Pending" && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <SlaBadge slaDueAt={log.sla_due_at} />
                      {log.assigned_to_name && (
                        <span className="text-[10px] text-aviva-secondary/70">มอบหมาย: {log.assigned_to_name}</span>
                      )}
                    </div>
                  )}
                  {log.action_taken === "Pending" && (
                    <div className="mt-1.5">
                      <input
                        defaultValue={log.assigned_to_name ?? ""}
                        onBlur={async e => {
                          await supabase.from("approval_logs")
                            .update({ assigned_to_name: e.target.value || null })
                            .eq("approval_id", log.approval_id);
                        }}
                        placeholder="มอบหมายให้..."
                        className="text-[10px] bg-aviva-bg border border-aviva-gold/10 rounded-lg px-2 py-1 text-aviva-text outline-none focus:border-aviva-gold/40 w-28"
                      />
                    </div>
                  )}
                  <div className="mt-1.5">
                    <AttachDocButton entityType="approval_log" entityId={log.approval_id} attachedBy={user?.full_name ?? ""} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {log.amount != null && <p className="text-sm font-bold text-aviva-gold">{fmt(log.amount)}</p>}
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                    log.action_taken === "Pending" ? "bg-yellow-500/20 text-yellow-400" :
                    log.action_taken === "Approved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>{log.action_taken === "Pending" ? "รออนุมัติ" : log.action_taken === "Approved" ? "✓ อนุมัติ" : "✗ ปฏิเสธ"}</span>
                </div>
              </div>
              {log.rejection_comment && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">เหตุผล: {log.rejection_comment}</p>}
              {log.action_taken === "Pending" && (
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(log.approval_id)} disabled={saving}
                    className="flex-1 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    <CheckCircle size={12} /> อนุมัติ</button>
                  <button onClick={() => { setRejectingId(log.approval_id); setRejectComment(""); }} disabled={saving}
                    className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    <XCircle size={12} /> ปฏิเสธ</button>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เหตุผลการปฏิเสธ</h2>
              <button onClick={() => setRejectingId(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <label className="text-xs text-aviva-secondary font-medium mb-1 block">เหตุผล <span className="text-red-400">*</span> (บังคับระบุ)</label>
            <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="ระบุเหตุผล..." rows={3}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
            <button onClick={() => handleReject(rejectingId)} disabled={saving || !rejectComment.trim()}
              className="w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "ยืนยันการปฏิเสธ"}
            </button>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Page Shell ───────────────────────────────────────────────────────────────

type MainTab = "approvals" | "registry";

export default function ApprovalsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("approvals");
  const slaNotifiedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (!user.isAdmin && !user.isManager) { router.replace("/dashboard"); return; }
    fetchLogs();
  }, [user, router]);

  const fetchLogs = () => {
    supabase.from("approval_logs").select("*")
      .order("action_timestamp", { ascending: false, nullsFirst: true }).limit(200)
      .then(({ data }) => { setLogs((data as ApprovalLog[]) ?? []); setLoading(false); });
  };

  const pendingCount = logs.filter(l => l.action_taken === "Pending").length;
  const overdueCount = logs.filter(l => {
    if (l.action_taken !== "Pending") return false;
    const sla = SLA_DAYS[l.workflow_type] ?? 3;
    return Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86_400_000) > sla;
  }).length;

  const pending = logs.filter(l => l.action_taken === "Pending");

  useEffect(() => {
    const overdue = pending.filter(p => p.sla_due_at && new Date(p.sla_due_at) < new Date());
    if (overdue.length > 0 && !slaNotifiedRef.current) {
      slaNotifiedRef.current = true;
      createNotification({
        type: "info",
        title: `SLA เกินกำหนด ${overdue.length} รายการ`,
        message: `มีคำขออนุมัติที่เลยกำหนดแล้ว — กรุณาดำเนินการโดยด่วน`,
        from_dept: "ระบบ",
      });
    }
    // Check for SLA approaching (within 1 day)
    const now = new Date();
    const soonLogs = logs.filter(l => {
      if (l.action_taken !== 'Pending' || !l.sla_due_at) return false;
      const due = new Date(l.sla_due_at);
      const hoursLeft = (due.getTime() - now.getTime()) / 3600000;
      return hoursLeft > 0 && hoursLeft <= 24;
    });
    if (soonLogs.length > 0) {
      createNotification({
        type: 'info',
        title: `SLA ใกล้ครบกำหนด ${soonLogs.length} รายการ`,
        message: soonLogs.map(l => l.source_doc_index?.split(' | ')[0] ?? l.workflow_type).join(', '),
        from_dept: 'ระบบ',
      });
    }
  }, [loading, pending]);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <BadgeCheck size={20} className="text-aviva-gold" />
            <h1 className="text-xl font-bold text-aviva-text">ระบบอนุมัติ</h1>
            {overdueCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                <AlertTriangle size={9} /> {overdueCount} เกิน SLA
              </span>
            )}
            <span className="ml-auto text-[10px] text-aviva-secondary">{loading ? "กำลังโหลด..." : `รออนุมัติ ${pendingCount}`}</span>
          </div>
          {/* Main tabs */}
          <div className="flex gap-2">
            <button onClick={() => setMainTab("approvals")}
              className={clsx("flex items-center gap-1.5 flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                mainTab === "approvals" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              <BadgeCheck size={13} /> อนุมัติ{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
            <button onClick={() => setMainTab("registry")}
              className={clsx("flex items-center gap-1.5 flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                mainTab === "registry" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              <BookOpen size={13} /> ทะเบียนเอกสาร
            </button>
          </div>
        </div>
      </div>

      {mainTab === "approvals" && (
        <ApprovalsContent logs={logs} loading={loading} fetchLogs={fetchLogs} />
      )}
      {mainTab === "registry" && <RegistryContent />}
    </div>
  );
}
