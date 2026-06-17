"use client";

import { ArrowRight, Clock, CheckCircle, AlertCircle, User, Briefcase } from "lucide-react";
import clsx from "clsx";

export interface WorkflowInfo {
  /** ที่มา - เช่น "ฝ่ายก่อสร้าง" */
  from: { label: string; description?: string };
  /** ถึงใคร - เช่น "ผู้จัดการ" */
  to: { label: string; description?: string };
  /** ต้องทำอะไร - เช่น "ตรวจสอบและอนุมัติ" */
  action: { label: string; description?: string };
  /** ส่งต่อไหน/เมื่อไหร่ */
  nextStep?: { label: string; description?: string };
  /** SLA */
  sla?: { days: number; label: string };
  /** สถานะปัจจุบัน */
  status?: "pending" | "approved" | "rejected" | "in_progress";
  /** ใครอนุมัติ/ปฏิเสธ */
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
}

export default function WorkflowInfoPanel({ workflow }: { workflow: WorkflowInfo }) {
  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pending: {
      icon: <Clock size={16} className="text-yellow-400" />,
      label: "รออนุมัติ",
      color: "bg-yellow-500/10 border-yellow-500/30",
    },
    approved: {
      icon: <CheckCircle size={16} className="text-green-400" />,
      label: "อนุมัติแล้ว",
      color: "bg-green-500/10 border-green-500/30",
    },
    rejected: {
      icon: <AlertCircle size={16} className="text-red-400" />,
      label: "ถูกปฏิเสธ",
      color: "bg-red-500/10 border-red-500/30",
    },
    in_progress: {
      icon: <Clock size={16} className="text-blue-400" />,
      label: "กำลังดำเนินการ",
      color: "bg-blue-500/10 border-blue-500/30",
    },
  };

  const currentStatus = statusConfig[workflow.status ?? "pending"];

  return (
    <div className="space-y-3">
      {/* Status Header */}
      <div className={clsx(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
        currentStatus.color
      )}>
        {currentStatus.icon}
        <span className="text-xs font-semibold text-aviva-text">{currentStatus.label}</span>
        {workflow.sla && (
          <span className="text-[10px] text-aviva-secondary/70 ml-auto">
            SLA: {workflow.sla.days} วัน
          </span>
        )}
      </div>

      {/* Workflow Journey */}
      <div className="bg-aviva-bg/30 border border-aviva-gold/10 rounded-xl p-3 space-y-2">
        <p className="text-[10px] font-bold text-aviva-secondary/70 uppercase tracking-wider">ไหลของงาน</p>

        {/* From → To → Action → Next */}
        <div className="space-y-2">
          {/* FROM */}
          <div className="flex items-start gap-2">
            <Briefcase size={14} className="text-aviva-gold flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-aviva-secondary/60">📍 ที่มา</p>
              <p className="text-xs font-semibold text-aviva-text">{workflow.from.label}</p>
              {workflow.from.description && (
                <p className="text-[10px] text-aviva-secondary/70 mt-0.5">{workflow.from.description}</p>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center py-1">
            <ArrowRight size={14} className="text-aviva-gold/50 rotate-90" />
          </div>

          {/* TO */}
          <div className="flex items-start gap-2">
            <User size={14} className="text-aviva-gold flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-aviva-secondary/60">👤 ถึงใคร</p>
              <p className="text-xs font-semibold text-aviva-text">{workflow.to.label}</p>
              {workflow.to.description && (
                <p className="text-[10px] text-aviva-secondary/70 mt-0.5">{workflow.to.description}</p>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center py-1">
            <ArrowRight size={14} className="text-aviva-gold/50 rotate-90" />
          </div>

          {/* ACTION */}
          <div className="flex items-start gap-2">
            <CheckCircle size={14} className="text-aviva-gold flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-aviva-secondary/60">⚙️ ต้องทำอะไร</p>
              <p className="text-xs font-semibold text-aviva-text">{workflow.action.label}</p>
              {workflow.action.description && (
                <p className="text-[10px] text-aviva-secondary/70 mt-0.5">{workflow.action.description}</p>
              )}
            </div>
          </div>

          {/* Arrow */}
          {workflow.nextStep && (
            <>
              <div className="flex justify-center py-1">
                <ArrowRight size={14} className="text-aviva-gold/50 rotate-90" />
              </div>

              {/* NEXT STEP */}
              <div className="flex items-start gap-2">
                <ArrowRight size={14} className="text-aviva-gold flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-aviva-secondary/60">➡️ ส่งต่อไป</p>
                  <p className="text-xs font-semibold text-aviva-text">{workflow.nextStep.label}</p>
                  {workflow.nextStep.description && (
                    <p className="text-[10px] text-aviva-secondary/70 mt-0.5">{workflow.nextStep.description}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Approval Info */}
      {(workflow.approvedBy || workflow.rejectionReason) && (
        <div className="bg-aviva-bg/30 border border-aviva-gold/10 rounded-xl p-3 text-[11px] space-y-1.5">
          {workflow.approvedBy && (
            <>
              <p className="text-aviva-secondary/60">✓ อนุมัติโดย</p>
              <p className="text-aviva-text font-semibold">{workflow.approvedBy}</p>
              {workflow.approvedAt && (
                <p className="text-aviva-secondary/70">
                  {new Date(workflow.approvedAt).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </>
          )}
          {workflow.rejectionReason && (
            <>
              <p className="text-red-400/80">✗ เหตุผลการปฏิเสธ</p>
              <p className="text-aviva-text">{workflow.rejectionReason}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
