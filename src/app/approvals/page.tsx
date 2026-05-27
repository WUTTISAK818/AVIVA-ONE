"use client";

import { useState, useEffect } from "react";
import { BadgeCheck, X, CheckCircle, XCircle, ShieldAlert, Clock } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { createNotification } from "@/lib/notify";

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
}

const DEPT_BY_WORKFLOW: Record<string, string> = {
  Material_Purchase: "ฝ่ายก่อสร้าง",
  Finance_Approval: "ฝ่ายการเงิน",
  Installment_Review: "ฝ่ายก่อสร้าง",
  Leave_Request: "ฝ่ายบุคคล",
  Document_Approval: "ฝ่ายออฟฟิศ",
};

const WORKFLOW_LABEL: Record<string, string> = {
  Material_Purchase: "ขออนุมัติจัดซื้อวัสดุ",
  Finance_Approval: "ขออนุมัติรายจ่าย",
  Installment_Review: "ตรวจสอบงวดงาน",
  Leave_Request: "ขออนุมัติการลา",
  Document_Approval: "ขออนุมัติเอกสาร",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `฿${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n/1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

type FilterTab = "pending" | "approved" | "rejected";

export default function ApprovalsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!user.isAdmin && !user.isManager) { router.replace("/dashboard"); return; }
    fetchLogs();
  }, [user, router]);

  const fetchLogs = () => {
    supabase.from("approval_logs").select("*")
      .order("action_timestamp", { ascending: false, nullsFirst: true }).limit(100)
      .then(({ data }) => { setLogs((data as ApprovalLog[]) ?? []); setLoading(false); });
  };

  const filtered = logs.filter(l => {
    if (activeTab === "pending") return l.action_taken === "Pending";
    if (activeTab === "approved") return l.action_taken === "Approved";
    return l.action_taken === "Rejected";
  });
  const pendingCount = logs.filter(l => l.action_taken === "Pending").length;

  const cascadeApprove = async (log: ApprovalLog) => {
    if (!log.source_record_id) return;
    if (log.workflow_type === "Installment_Review") await supabase.from("contractor_installments").update({ status: "approved" }).eq("id", log.source_record_id);
    else if (log.workflow_type === "Material_Purchase") await supabase.from("purchase_orders").update({ status: "approved", approved_by: user?.full_name, approved_at: new Date().toISOString() }).eq("id", log.source_record_id);
    else if (log.workflow_type === "Document_Approval") await supabase.from("documents").update({ status: "approved" }).eq("id", log.source_record_id);
  };

  const cascadeReject = async (log: ApprovalLog) => {
    if (!log.source_record_id) return;
    if (log.workflow_type === "Installment_Review") await supabase.from("contractor_installments").update({ status: "pending" }).eq("id", log.source_record_id);
    else if (log.workflow_type === "Material_Purchase") await supabase.from("purchase_orders").update({ status: "draft" }).eq("id", log.source_record_id);
    else if (log.workflow_type === "Document_Approval") await supabase.from("documents").update({ status: "rejected" }).eq("id", log.source_record_id);
  };

  const handleApprove = async (id: string) => {
    setSaving(true);
    const log = logs.find(l => l.approval_id === id);
    await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("approval_id", id);
    if (log) {
      await cascadeApprove(log);
      const dept = DEPT_BY_WORKFLOW[log.workflow_type] ?? "ระบบ";
      await createNotification({ type: "success", title: `อนุมัติแล้ว — ${log.source_doc_index}`, message: `${WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type}${log.amount ? ` ฿${Number(log.amount).toLocaleString()}` : ""} ได้รับการอนุมัติแล้ว`, from_dept: dept, to_dept: dept });
    }
    setSaving(false); fetchLogs();
  };

  const handleReject = async (id: string) => {
    setSaving(true);
    const log = logs.find(l => l.approval_id === id);
    await supabase.from("approval_logs").update({ action_taken: "Rejected", action_timestamp: new Date().toISOString(), approver_email: user?.email, rejection_comment: rejectComment }).eq("approval_id", id);
    if (log) {
      await cascadeReject(log);
      const dept = DEPT_BY_WORKFLOW[log.workflow_type] ?? "ระบบ";
      await createNotification({ type: "info", title: `ปฏิเสธ — ${log.source_doc_index}`, message: `${WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type} ถูกปฏิเสธ${rejectComment ? `: ${rejectComment}` : ""}`, from_dept: dept, to_dept: dept });
    }
    setSaving(false); setRejectingId(null); setRejectComment(""); fetchLogs();
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2"><BadgeCheck size={20} className="text-aviva-gold" /><h1 className="text-xl font-bold text-aviva-text">ระบบอนุมัติ</h1></div>
          <p className="text-xs text-aviva-secondary mt-0.5">{loading ? "กำลังโหลด..." : `รออนุมัติ ${pendingCount} รายการ`}</p>
        </div>
      </div>
      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="flex gap-2">
          {[{ k: "pending", l: `รออนุมัติ${pendingCount > 0 ? ` (${pendingCount})` : ""}` }, { k: "approved", l: "อนุมัติแล้ว" }, { k: "rejected", l: "ปฏิเสธ" }].map(({ k, l }) => (
            <button key={k} onClick={() => setActiveTab(k as FilterTab)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all", activeTab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10")}>{l}</button>
          ))}
        </div>
        <div className="space-y-3">
          {loading ? [1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />) :
          filtered.length === 0 ? (
            <GlassCard className="p-8 text-center"><BadgeCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" /><p className="text-aviva-secondary text-sm">ไม่มีรายการในหมวดนี้</p></GlassCard>
          ) : filtered.map(log => (
            <GlassCard key={log.approval_id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-aviva-gold">{log.source_doc_index}</span>
                    {log.amount != null && log.amount > 50000 && (
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ShieldAlert size={9} /> ต้องอนุมัติ 2 ชั้น</span>
                    )}
                  </div>
                  <p className="text-sm text-aviva-text mt-0.5">{WORKFLOW_LABEL[log.workflow_type] ?? log.workflow_type}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-aviva-secondary">ผู้อนุมัติ: {log.current_approver_role}</p>
                    {DEPT_BY_WORKFLOW[log.workflow_type] && <span className="text-[10px] text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-full">{DEPT_BY_WORKFLOW[log.workflow_type]}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock size={9} className="text-aviva-secondary/50" />
                    <p className="text-[10px] text-aviva-secondary/60">ส่งเมื่อ {new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}{log.action_timestamp && ` · อัปเดต ${new Date(log.action_timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`}</p>
                  </div>
                  {log.approver_email && log.action_taken !== "Pending" && <p className="text-[10px] text-aviva-secondary/60 mt-0.5">โดย: {log.approver_email}</p>}
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
          ))}
        </div>
      </div>
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-aviva-text">เหตุผลการปฏิเสธ</h2><button onClick={() => setRejectingId(null)}><X size={20} className="text-aviva-secondary" /></button></div>
            <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="ระบุเหตุผล..." rows={3}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
            <button onClick={() => handleReject(rejectingId)} disabled={saving || !rejectComment.trim()}
              className="w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "ยืนยันการปฏิเสธ"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
