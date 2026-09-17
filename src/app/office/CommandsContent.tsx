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
import { CommandTask } from "./_shared";

export default function CommandsContent() {
  const [tasks, setTasks] = useState<CommandTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchCommands();
  }, []);

  const fetchCommands = async () => {
    try {
      const res = await fetch('/api/tasks?type=commands');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch commands:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400';
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'approved':
        return 'bg-purple-500/20 text-purple-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-aviva-card text-aviva-secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '⏳ รอดำเนินการ',
      in_progress: '🔄 กำลังทำ',
      completed: '✅ เสร็จแล้ว',
      approved: '✔️ อนุมัติแล้ว',
      rejected: '❌ ปฏิเสธ',
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      feature: '✨ ฟีเจอร์ใหม่',
      bugfix: '🐛 แก้ไขข้อบกพร่อง',
      enhancement: '⬆️ ปรับปรุง',
      refactor: '♻️ ปรับโครงสร้าง',
      other: '🔧 อื่น ๆ',
    };
    return labels[type || 'feature'] || 'ไม่ระบุ';
  };

  const filteredTasks = tasks.filter((task) => {
    const statusMatch = filterStatus === 'all' || task.status === filterStatus;
    const typeMatch = filterType === 'all' || task.command_type === filterType;
    return statusMatch && typeMatch;
  });

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed' || t.status === 'approved').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    deployed: tasks.filter((t) => t.deployed_date).length,
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <SectionHeader title="📋 ติดตามคำสั่ง" subtitle="ระบบติดตามการพัฒนาฟีเจอร์และแก้ไขข้อบกพร่อง" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] text-aviva-secondary">รวมทั้งหมด</p>
          <p className="text-lg font-bold text-aviva-gold">{stats.total}</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] text-green-400">เสร็จแล้ว</p>
          <p className="text-lg font-bold text-green-400">{stats.completed}</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] text-yellow-400">รอดำเนินการ</p>
          <p className="text-lg font-bold text-yellow-400">{stats.pending}</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] text-blue-400">กำลังทำ</p>
          <p className="text-lg font-bold text-blue-400">{stats.inProgress}</p>
        </GlassCard>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-aviva-gold"
        >
          <option value="all">สถานะ: ทั้งหมด</option>
          <option value="pending">รอดำเนินการ</option>
          <option value="in_progress">กำลังทำ</option>
          <option value="completed">เสร็จแล้ว</option>
          <option value="approved">อนุมัติแล้ว</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2 py-1.5 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-aviva-gold"
        >
          <option value="all">ประเภท: ทั้งหมด</option>
          <option value="feature">ฟีเจอร์ใหม่</option>
          <option value="bugfix">แก้ไขข้อบกพร่อง</option>
          <option value="enhancement">ปรับปรุง</option>
          <option value="refactor">ปรับโครงสร้าง</option>
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-aviva-card/50 animate-pulse" />)
        ) : filteredTasks.length === 0 ? (
          <GlassCard className="p-4 text-center">
            <p className="text-xs text-aviva-secondary">ไม่มีคำสั่ง</p>
          </GlassCard>
        ) : (
          filteredTasks.map(task => (
            <GlassCard key={task.id} className="p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-aviva-text">{task.title}</p>
                  {task.description && <p className="text-[9px] text-aviva-secondary mt-0.5 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={clsx("text-[8px] font-bold px-1.5 py-0.5 rounded", getStatusColor(task.status))}>
                      {getStatusLabel(task.status)}
                    </span>
                    {task.command_type && (
                      <span className="text-[8px] text-aviva-secondary">{getTypeLabel(task.command_type)}</span>
                    )}
                    {task.deployed_date && (
                      <span className="text-[8px] text-green-400">✓ Deploy {new Date(task.deployed_date).toLocaleDateString('th-TH')}</span>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
