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
import { AuditEntry } from "./_shared";

export default function AuditLogContent() {
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
          <button onClick={() => downloadCsv(`audit-log-${thaiDateStr()}`,
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
