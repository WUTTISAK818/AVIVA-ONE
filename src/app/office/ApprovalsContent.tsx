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
import { Approval, ApprovalLog, ApprovalsFilterTab, PROJECT_ID, fmtAmt, getSlaBadge } from "./_shared";

export default function ApprovalsContent() {
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
      .order("action_timestamp", { ascending: false, nullsFirst: true }).limit(300)
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
      const { data: ch1, error: e1 } = await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("approval_id", id).eq("action_taken", "Pending").select("approval_id");
      if (!e1 && (!ch1 || ch1.length === 0)) { setSaving(false); setToast({ msg: "รายการนี้ถูกดำเนินการไปแล้ว", type: "info" }); fetchLogs(); return; }
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

    const { data: chA, error } = await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("approval_id", id).eq("action_taken", "Pending").select("approval_id");
    if (!error && (!chA || chA.length === 0)) { setSaving(false); setToast({ msg: "รายการนี้ถูกดำเนินการไปแล้ว (โดยผู้อนุมัติท่านอื่น)", type: "info" }); fetchLogs(); return; }
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
      await notifyRequester(log, true);
    }
    if (log?.source_record_id) {
      await resolveApprovalQueue({ workflowType: log.workflow_type, sourceRecordId: log.source_record_id, docIndex: log.source_doc_index, approved: true, amount: log.amount ?? null, actorName: user?.full_name ?? user?.email, actorRole: user?.isAdmin ? "admin" : "manager" });
    }
    setSaving(false);
    fetchLogs();
  };

  // แจ้งผลอนุมัติ/ตีกลับ เจาะถึงตัวผู้ขอ (ทดแทนการตอบในแชต LINE)
  async function notifyRequester(log: { submitted_by_user_id: string | null; source_doc_index: string; workflow_type: string }, approved: boolean, note?: string) {
    if (!log.submitted_by_user_id) return;
    const { data: reqUser } = await supabase.from("users").select("email").eq("id", log.submitted_by_user_id).maybeSingle();
    if (!reqUser?.email) return;
    await createNotification({
      type: approved ? "success" : "info",
      title: approved ? "✅ คำขอของคุณได้รับอนุมัติ" : "↩️ คำขอของคุณถูกตีกลับ",
      message: `${log.source_doc_index}${!approved && note ? ` — เหตุผล: ${note}` : ""}`,
      from_dept: "ผู้บริหาร",
      to_user_email: reqUser.email,
      link: log.workflow_type === "Material_Purchase" ? "/construction" : "/office",
    });
  }

  const handleReject = async (id: string, commentArg?: string) => {
    setSaving(true);
    const log = logs.find(l => l.approval_id === id);

    // Maker-checker: block rejecting your own submission
    if (log && user?.full_name && log.source_doc_index.includes(`โดย ${user.full_name}`)) {
      setSaving(false);
      setToast({ msg: "ไม่สามารถปฏิเสธรายการที่ท่านเป็นผู้ส่งได้ (Maker-Checker)", type: "error" });
      return;
    }

    const { data: chR, error } = await supabase.from("approval_logs").update({ action_taken: "Rejected", action_timestamp: new Date().toISOString(), approver_email: user?.email, rejection_comment: commentArg ?? rejectComment }).eq("approval_id", id).eq("action_taken", "Pending").select("approval_id");
    if (!error && (!chR || chR.length === 0)) { setSaving(false); setToast({ msg: "รายการนี้ถูกดำเนินการไปแล้ว (โดยผู้อนุมัติท่านอื่น)", type: "info" }); fetchLogs(); return; }
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
      await notifyRequester(log, false, commentArg ?? rejectComment);
    }
    if (log?.source_record_id) {
      await resolveApprovalQueue({ workflowType: log.workflow_type, sourceRecordId: log.source_record_id, docIndex: log.source_doc_index, approved: false, amount: log.amount ?? null, actorName: user?.full_name ?? user?.email, actorRole: user?.isAdmin ? "admin" : "manager", conditionNote: (commentArg ?? rejectComment) || undefined });
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
              <button onClick={() => setRejectingId(null)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
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
