"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Download, ChevronLeft, ChevronRight, Search, ClipboardList, HardHat, BadgeCheck, Filter } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import Link from "next/link";

type AuditTab = "reports" | "construction" | "approvals";

interface WReport {
  id: string;
  employee_name: string;
  department: string;
  report_date: string;
  status: string;
  summary: string;
  work_location?: string;
  submitted_at?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

interface Installment {
  id: string;
  name: string;
  status: string;
  amount: number;
  house_number?: string;
  project_id: string;
  created_at: string;
  updated_at?: string;
}

interface ApprovalLog {
  approval_id: string;
  source_doc_index: string;
  workflow_type: string;
  action_taken: string;
  action_timestamp: string | null;
  approver_email: string | null;
  rejection_comment: string | null;
  amount: number | null;
  created_at: string;
}

const WORKFLOW_LABEL: Record<string, string> = {
  Installment_Review: "ตรวจงวดงาน",
  Material_Purchase: "จัดซื้อวัสดุ",
  Document_Approval: "อนุมัติเอกสาร",
  Finance_Approval: "อนุมัติการเงิน",
  Leave_Request: "ขออนุมัติลา",
  Booking_Deposit: "จ่ายเงินจอง",
};

const DEPT_LIST = ["ทุกฝ่าย", "ฝ่ายขาย", "ฝ่ายก่อสร้าง", "ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายออฟฟิศ", "ฝ่ายบุคคล"];
const INST_STATUS_LABEL: Record<string, string> = { pending: "รอส่ง", in_review: "รอตรวจ", approved: "อนุมัติ", paid: "เบิกจ่ายแล้ว", rejected: "ปฏิเสธ" };
const INST_STATUS_COLOR: Record<string, string> = { pending: "text-aviva-secondary", in_review: "text-yellow-400", approved: "text-green-400", paid: "text-blue-400", rejected: "text-red-400" };

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function formatThaiDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function formatThaiDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditPage() {
  const user = useCurrentUser();
  const canAccess = user?.isManager || user?.isAdmin;

  const today = new Date().toISOString().split("T")[0];
  const oneMonthAgo = addDays(today, -30);

  const [tab, setTab] = useState<AuditTab>("reports");
  const [startDate, setStartDate] = useState(oneMonthAgo);
  const [endDate, setEndDate] = useState(today);
  const [deptFilter, setDeptFilter] = useState("ทุกฝ่าย");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [reports, setReports] = useState<WReport[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [approvalLogs, setApprovalLogs] = useState<ApprovalLog[]>([]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("work_reports").select("*")
      .gte("report_date", startDate)
      .lte("report_date", endDate)
      .eq("report_type", "daily")
      .order("report_date", { ascending: false })
      .order("department")
      .limit(200);
    if (deptFilter !== "ทุกฝ่าย") q = q.eq("department", deptFilter);
    const { data } = await q;
    setReports((data ?? []) as WReport[]);
    setLoading(false);
  }, [startDate, endDate, deptFilter]);

  const fetchInstallments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contractor_installments")
      .select("id,name,status,amount,project_id,created_at,updated_at,house_id")
      .eq("project_id", "aaaaaaaa-0000-0000-0000-000000000001")
      .gte("created_at", startDate)
      .lte("created_at", endDate + "T23:59:59")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) {
      const houseIds = [...new Set(data.map((r: Record<string, string>) => r.house_id).filter(Boolean))];
      if (houseIds.length > 0) {
        const { data: houses } = await supabase.from("houses").select("id,house_number").in("id", houseIds);
        const houseMap = Object.fromEntries((houses ?? []).map((h: { id: string; house_number: string }) => [h.id, h.house_number]));
        setInstallments(data.map((r: Record<string, unknown>) => ({ ...r, house_number: houseMap[r.house_id as string] ?? "—" })) as Installment[]);
      } else {
        setInstallments(data as Installment[]);
      }
    }
    setLoading(false);
  }, [startDate, endDate]);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("approval_logs")
      .select("approval_id,source_doc_index,workflow_type,action_taken,action_timestamp,approver_email,rejection_comment,amount,created_at")
      .gte("created_at", startDate)
      .lte("created_at", endDate + "T23:59:59")
      .order("created_at", { ascending: false })
      .limit(300);
    setApprovalLogs((data ?? []) as ApprovalLog[]);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    if (!canAccess) return;
    if (tab === "reports") fetchReports();
    else if (tab === "construction") fetchInstallments();
    else if (tab === "approvals") fetchApprovals();
  }, [canAccess, tab, fetchReports, fetchInstallments, fetchApprovals]);

  function exportReportsCsv() {
    const filtered = reports.filter(r =>
      (!search || r.employee_name.includes(search) || r.department.includes(search))
    );
    const header = ["วันที่", "ชื่อพนักงาน", "ฝ่าย", "สถานที่ทำงาน", "สถานะ", "บันทึกผู้รับทราบ", "เวลารับทราบ"].join(",");
    const rows = filtered.map(r => [
      r.report_date,
      `"${r.employee_name}"`,
      `"${r.department}"`,
      `"${r.work_location ?? ""}"`,
      r.status,
      `"${r.acknowledged_by ?? ""}"`,
      r.acknowledged_at ? formatThaiDateTime(r.acknowledged_at) : "",
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AVIVA-Private-work-reports-${startDate}-${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportInstallmentsCsv() {
    const header = ["วันที่สร้าง", "งวดงาน", "บ้านเลขที่", "มูลค่า (บาท)", "สถานะ"].join(",");
    const rows = installments.map(r => [
      r.created_at ? formatThaiDate(r.created_at) : "",
      `"${r.name}"`,
      `"${r.house_number ?? ""}"`,
      r.amount ?? 0,
      INST_STATUS_LABEL[r.status] ?? r.status,
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AVIVA-Private-installments-${startDate}-${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportApprovalsCsv() {
    const header = ["วันที่", "เอกสาร", "ประเภท", "สถานะ", "มูลค่า (บาท)", "ผู้อนุมัติ", "เวลาดำเนินการ"].join(",");
    const rows = approvalLogs.map(r => [
      r.created_at ? formatThaiDate(r.created_at) : "",
      `"${r.source_doc_index}"`,
      `"${WORKFLOW_LABEL[r.workflow_type] ?? r.workflow_type}"`,
      r.action_taken,
      r.amount ?? "",
      `"${r.approver_email ?? ""}"`,
      r.action_timestamp ? formatThaiDateTime(r.action_timestamp) : "",
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AVIVA-Private-approvals-${startDate}-${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center px-4">
        <GlassCard className="p-6 text-center">
          <ShieldAlert size={28} className="text-aviva-secondary/40 mx-auto mb-3" />
          <p className="text-aviva-secondary text-sm">เฉพาะผู้จัดการและผู้ดูแลระบบ</p>
        </GlassCard>
      </div>
    );
  }

  const filteredReports = reports.filter(r =>
    !search || r.employee_name.includes(search) || r.department.includes(search) || r.summary?.includes(search)
  );

  const instPaid = installments.filter(i => i.status === "paid");
  const instApproved = installments.filter(i => i.status === "approved");
  const instPending = installments.filter(i => i.status === "in_review" || i.status === "pending");
  const instRejected = installments.filter(i => i.status === "rejected");
  const totalPaid = instPaid.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const totalApproved = instApproved.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const totalPending = instPending.reduce((s, i) => s + Number(i.amount ?? 0), 0);

  const approvedCount = approvalLogs.filter(l => l.action_taken === "Approved").length;
  const rejectedCount = approvalLogs.filter(l => l.action_taken === "Rejected").length;
  const pendingCount = approvalLogs.filter(l => l.action_taken === "Pending").length;
  const totalApprovalAmount = approvalLogs.filter(l => l.action_taken === "Approved" && l.amount).reduce((s, l) => s + Number(l.amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <BadgeCheck size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">ประวัติการตรวจสอบ (Audit Trail)</h1>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {([
              { k: "reports", l: "รายงานประจำวัน", Icon: ClipboardList },
              { k: "construction", l: "ก่อสร้าง-การเงิน", Icon: HardHat },
              { k: "approvals", l: "ประวัติอนุมัติ", Icon: BadgeCheck },
            ] as { k: AuditTab; l: string; Icon: typeof ClipboardList }[]).map(({ k, l, Icon }) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${tab === k ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-secondary border border-aviva-gold/20"}`}>
                <Icon size={12} />{l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        <GlassCard className="p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <ChevronLeft size={14} className="text-aviva-secondary flex-shrink-0" />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none" />
            </div>
            <span className="text-aviva-secondary text-xs">—</span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none" />
              <ChevronRight size={14} className="text-aviva-secondary flex-shrink-0" />
            </div>
          </div>
          {tab === "reports" && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aviva-secondary/40" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / ฝ่าย..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg pl-7 pr-3 py-1.5 text-xs text-aviva-text outline-none" />
              </div>
              <div className="relative">
                <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aviva-secondary/40" />
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  className="bg-aviva-bg border border-aviva-gold/20 rounded-lg pl-7 pr-3 py-1.5 text-xs text-aviva-text outline-none appearance-none">
                  {DEPT_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}
        </GlassCard>

        {tab === "reports" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-aviva-secondary">{filteredReports.length} รายการ</p>
              <button onClick={exportReportsCsv} className="flex items-center gap-1.5 text-xs text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-3 py-1.5 rounded-xl">
                <Download size={12} /> Export CSV
              </button>
            </div>
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card animate-pulse" />)
            ) : filteredReports.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <p className="text-aviva-secondary text-sm">ไม่มีรายงานในช่วงเวลานี้</p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {filteredReports.map(r => (
                  <GlassCard key={r.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-semibold text-aviva-text">{r.employee_name}</span>
                          <span className="text-[10px] text-aviva-secondary/70 bg-aviva-bg/50 px-1.5 py-0.5 rounded-full">{r.department}</span>
                        </div>
                        <p className="text-[10px] text-aviva-secondary">{formatThaiDate(r.report_date)}{r.work_location ? ` · ${r.work_location}` : ""}</p>
                        {r.summary && <p className="text-[11px] text-aviva-text/80 mt-1 line-clamp-2">{r.summary}</p>}
                        {r.acknowledged_by && (
                          <p className="text-[10px] text-green-400 mt-1">✓ รับทราบโดย {r.acknowledged_by} · {r.acknowledged_at ? formatThaiDateTime(r.acknowledged_at) : ""}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${r.status === "submitted" ? "bg-green-500/10 text-green-400" : r.status === "late" ? "bg-orange-500/10 text-orange-400" : "bg-aviva-bg/50 text-aviva-secondary"}`}>
                          {r.status === "submitted" ? "ส่งแล้ว" : r.status === "late" ? "ส่งล่าช้า" : "ยังไม่ส่ง"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-aviva-gold/10">
                      <Link href={`/reports/review`} className="text-[10px] text-aviva-gold/70 hover:text-aviva-gold">
                        ดูรายละเอียด →
                      </Link>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "construction" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <GlassCard className="p-3 text-center">
                <p className="text-lg font-bold text-blue-400">฿{totalPaid.toLocaleString()}</p>
                <p className="text-[10px] text-aviva-secondary">เบิกจ่ายแล้ว ({instPaid.length} งวด)</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-lg font-bold text-green-400">฿{totalApproved.toLocaleString()}</p>
                <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว ({instApproved.length} งวด)</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-lg font-bold text-yellow-400">฿{totalPending.toLocaleString()}</p>
                <p className="text-[10px] text-aviva-secondary">รอดำเนินการ ({instPending.length} งวด)</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-lg font-bold text-red-400">{instRejected.length}</p>
                <p className="text-[10px] text-aviva-secondary">ถูกปฏิเสธ</p>
              </GlassCard>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-aviva-secondary">{installments.length} งวดงาน</p>
              <button onClick={exportInstallmentsCsv} className="flex items-center gap-1.5 text-xs text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-3 py-1.5 rounded-xl">
                <Download size={12} /> Export CSV
              </button>
            </div>
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-aviva-card animate-pulse" />)
            ) : installments.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <p className="text-aviva-secondary text-sm">ไม่มีข้อมูลงวดงานในช่วงเวลานี้</p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {installments.map(inst => (
                  <GlassCard key={inst.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-aviva-text line-clamp-1">{inst.name}</p>
                        <p className="text-[10px] text-aviva-secondary mt-0.5">{inst.house_number ?? "—"} · {inst.created_at ? formatThaiDate(inst.created_at) : ""}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-bold text-aviva-gold">฿{Number(inst.amount ?? 0).toLocaleString()}</p>
                        <p className={`text-[10px] font-semibold ${INST_STATUS_COLOR[inst.status] ?? "text-aviva-secondary"}`}>
                          {INST_STATUS_LABEL[inst.status] ?? inst.status}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "approvals" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <GlassCard className="p-3 text-center">
                <p className="text-lg font-bold text-green-400">{approvedCount}</p>
                <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-lg font-bold text-red-400">{rejectedCount}</p>
                <p className="text-[10px] text-aviva-secondary">ปฏิเสธ</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-lg font-bold text-yellow-400">{pendingCount}</p>
                <p className="text-[10px] text-aviva-secondary">รออนุมัติ</p>
              </GlassCard>
            </div>
            {totalApprovalAmount > 0 && (
              <GlassCard className="p-3 flex items-center justify-between">
                <p className="text-xs text-aviva-secondary">มูลค่าอนุมัติรวม (ช่วงเวลานี้)</p>
                <p className="text-sm font-bold text-aviva-gold">฿{totalApprovalAmount.toLocaleString()}</p>
              </GlassCard>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-aviva-secondary">{approvalLogs.length} รายการ</p>
              <button onClick={exportApprovalsCsv} className="flex items-center gap-1.5 text-xs text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-3 py-1.5 rounded-xl">
                <Download size={12} /> Export CSV
              </button>
            </div>
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-aviva-card animate-pulse" />)
            ) : approvalLogs.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <p className="text-aviva-secondary text-sm">ไม่มีประวัติอนุมัติในช่วงเวลานี้</p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {approvalLogs.map(log => (
                  <GlassCard key={log.approval_id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-aviva-text line-clamp-2">{log.source_doc_index}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-aviva-secondary/70 bg-aviva-bg/50 px-1.5 py-0.5 rounded-full">
                            {WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type}
                          </span>
                          {log.amount && (
                            <span className="text-[10px] text-aviva-gold font-semibold">฿{Number(log.amount).toLocaleString()}</span>
                          )}
                        </div>
                        {log.approver_email && (
                          <p className="text-[10px] text-aviva-secondary mt-1">โดย {log.approver_email}</p>
                        )}
                        {log.action_timestamp && (
                          <p className="text-[10px] text-aviva-secondary/60">{formatThaiDateTime(log.action_timestamp)}</p>
                        )}
                        {log.rejection_comment && (
                          <p className="text-[10px] text-red-400 mt-1">เหตุผล: {log.rejection_comment}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          log.action_taken === "Approved" ? "bg-green-500/10 text-green-400" :
                          log.action_taken === "Rejected" ? "bg-red-500/10 text-red-400" :
                          "bg-yellow-500/10 text-yellow-400"
                        }`}>
                          {log.action_taken === "Approved" ? "อนุมัติ" : log.action_taken === "Rejected" ? "ปฏิเสธ" : "รออนุมัติ"}
                        </span>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}