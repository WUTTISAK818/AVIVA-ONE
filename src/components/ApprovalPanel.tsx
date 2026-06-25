"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, User, Calendar, MessageSquare } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { useCurrentUser } from "@/lib/user-context";

interface ApprovalHistory {
  id: string;
  action: string;
  approved_by_name: string;
  approval_date: string;
  reason?: string;
  previous_status?: string;
  new_status?: string;
}

interface ApprovalPanelProps {
  activity_id: string;
  current_status?: string;
  approved_by_name?: string;
  approved_date?: string;
  approval_reason?: string;
  onApprove?: (reason?: string) => void;
  onReject?: (reason: string) => void;
  isLoading?: boolean;
}

export function ApprovalPanel({
  activity_id,
  current_status = "pending",
  approved_by_name,
  approved_date,
  approval_reason,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalPanelProps) {
  const user = useCurrentUser();
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchApprovalHistory();
  }, [activity_id]);

  const fetchApprovalHistory = async () => {
    try {
      const res = await fetch(`/api/activity/approve?activity_id=${activity_id}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching approval history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleApprove = async () => {
    if (onApprove) {
      onApprove();
    }
  };

  const handleReject = async () => {
    if (rejectReason.trim() && onReject) {
      onReject(rejectReason);
      setShowRejectReason(false);
      setRejectReason("");
    }
  };

  const canApprove = user?.isManager && current_status !== "approved";
  const canReject = user?.isManager && current_status !== "rejected";

  const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string; bg: string }> = {
    pending: { icon: Clock, color: "text-yellow-400", label: "รอการอนุมัติ", bg: "bg-yellow-500/10" },
    approved: { icon: CheckCircle, color: "text-green-400", label: "อนุมัติแล้ว", bg: "bg-green-500/10" },
    rejected: { icon: XCircle, color: "text-red-400", label: "ปฏิเสธ", bg: "bg-red-500/10" },
  };

  const currentConfig = statusConfig[current_status] || statusConfig.pending;
  const StatusIcon = currentConfig.icon;

  return (
    <div className="space-y-3">
      {/* Current Status */}
      <GlassCard className={`p-3 border ${currentConfig.bg}`}>
        <div className="flex items-center gap-2 mb-2">
          <StatusIcon size={16} className={currentConfig.color} />
          <p className="text-sm font-semibold text-aviva-text">{currentConfig.label}</p>
        </div>

        {/* Approval Details */}
        {current_status !== "pending" && (
          <div className="space-y-1.5 text-xs text-aviva-secondary">
            {approved_by_name && (
              <div className="flex items-center gap-2">
                <User size={12} />
                <span>โดย {approved_by_name}</span>
              </div>
            )}
            {approved_date && (
              <div className="flex items-center gap-2">
                <Calendar size={12} />
                <span>{new Date(approved_date).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            )}
            {approval_reason && (
              <div className="flex items-start gap-2 mt-2">
                <MessageSquare size={12} className="flex-shrink-0 mt-0.5" />
                <span className="text-aviva-secondary/80">{approval_reason}</span>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Action Buttons */}
      {canApprove || canReject ? (
        <div className="space-y-2">
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-semibold hover:bg-green-500/30 disabled:opacity-50"
            >
              <CheckCircle size={14} />
              อนุมัติรายงานนี้
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setShowRejectReason(!showRejectReason)}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-50"
            >
              <XCircle size={14} />
              ปฏิเสธรายงานนี้
            </button>
          )}
        </div>
      ) : null}

      {/* Reject Reason Input */}
      {showRejectReason && (
        <GlassCard className="p-3 space-y-2 bg-red-500/5 border border-red-500/20">
          <label className="text-xs font-semibold text-aviva-text">เหตุผลในการปฏิเสธ</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="กรุณาระบุเหตุผลในการปฏิเสธ..."
            className="w-full px-3 py-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-xs text-aviva-text placeholder-aviva-secondary/40 resize-none"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim() || isLoading}
              className="flex-1 py-1.5 rounded-lg bg-red-500/30 border border-red-500/50 text-red-400 text-xs font-semibold hover:bg-red-500/40 disabled:opacity-50"
            >
              ยืนยันปฏิเสธ
            </button>
            <button
              onClick={() => setShowRejectReason(false)}
              className="flex-1 py-1.5 rounded-lg bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-xs font-semibold hover:border-aviva-gold/50"
            >
              ยกเลิก
            </button>
          </div>
        </GlassCard>
      )}

      {/* Approval History */}
      {!loadingHistory && history.length > 0 && (
        <GlassCard className="p-3 space-y-2 bg-aviva-card/50">
          <p className="text-xs font-semibold text-aviva-gold uppercase">ประวัติการอนุมัติ</p>
          <div className="space-y-2">
            {history.map((record) => (
              <div key={record.id} className="bg-aviva-bg/50 rounded-lg p-2 border border-aviva-gold/10">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    {record.action === "approved" && <CheckCircle size={12} className="text-green-400" />}
                    {record.action === "rejected" && <XCircle size={12} className="text-red-400" />}
                    {record.action === "sent_back" && <Clock size={12} className="text-yellow-400" />}
                    <span className="text-[11px] font-semibold text-aviva-text">
                      {record.action === "approved"
                        ? "อนุมัติ"
                        : record.action === "rejected"
                          ? "ปฏิเสธ"
                          : "ส่งกลับไปแก้"}
                    </span>
                  </div>
                  <span className="text-[10px] text-aviva-secondary">
                    {new Date(record.approval_date).toLocaleDateString("th-TH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-[10px] text-aviva-secondary">โดย {record.approved_by_name}</p>
                {record.reason && <p className="text-[10px] text-aviva-secondary/70 mt-1">{record.reason}</p>}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
