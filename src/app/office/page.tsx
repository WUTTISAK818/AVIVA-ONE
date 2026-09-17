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
import { thaiMonthStr } from "@/lib/thai-date";
import dynamic from "next/dynamic";
import { MANAGER_LINKS, MENU_SECTIONS, OfficeTab, TABS } from "./_shared";

// แต่ละแท็บอยู่คนละไฟล์และโหลดเมื่อเปิดใช้จริง — พนักงานที่เห็นแค่แท็บแผนกตัวเอง
// ไม่ต้องดาวน์โหลดโค้ดของอีก 11 แท็บติดมาด้วย (เดิมรวมกัน 4,843 บรรทัดในไฟล์เดียว)
const tabLoading = () => <p className="text-xs text-aviva-secondary/60 py-10 text-center">กำลังโหลด…</p>;
const FinanceContent = dynamic(() => import("./FinanceContent"), { ssr: false, loading: tabLoading });
const AccountingContent = dynamic(() => import("./AccountingContent"), { ssr: false, loading: tabLoading });
const MarketingContent = dynamic(() => import("./MarketingContent"), { ssr: false, loading: tabLoading });
const HRContent = dynamic(() => import("./HRContent"), { ssr: false, loading: tabLoading });
const AfterSalesContent = dynamic(() => import("./AfterSalesContent"), { ssr: false, loading: tabLoading });
const ApprovalsContent = dynamic(() => import("./ApprovalsContent"), { ssr: false, loading: tabLoading });
const MaterialsContent = dynamic(() => import("./MaterialsContent"), { ssr: false, loading: tabLoading });
const PayrollContent = dynamic(() => import("./PayrollContent"), { ssr: false, loading: tabLoading });
const CommunityContent = dynamic(() => import("./CommunityContent"), { ssr: false, loading: tabLoading });
const DocumentsContent = dynamic(() => import("./DocumentsContent"), { ssr: false, loading: tabLoading });
const CommandsContent = dynamic(() => import("./CommandsContent"), { ssr: false, loading: tabLoading });
const AuditLogContent = dynamic(() => import("./AuditLogContent"), { ssr: false, loading: tabLoading });

export default function OfficePage() {
  const user = useCurrentUser();
  // "menu" = หน้า grid เมนูหลัก (จัดหมวด+ไอคอน) — ผู้บริหารเริ่มที่นี่ · พนักงานเด้งเข้าแท็บแผนกตัวเอง
  // แบบ A+ (Pom เลือก 2026-07-03): เมนูชุดเดียวอยู่บนสุด + เนื้อหาแท็บแสดงต่อด้านล่างทันที
  // ไม่มีหน้าเมนูแยก/แถบสลับซ้ำ · เมนูไม่ sticky — เลื่อนลงอ่านเนื้อหาแล้วเมนูพ้นจอไปเอง
  const [activeTab, setActiveTab] = useState<OfficeTab>("finance");
  useFocusHighlight();

  // มาตรฐานทีม: sync แท็บลง URL — refresh/แชร์ลิงก์แล้วกลับมาแท็บเดิม (deep-link ?tab= มีขาอ่านอยู่แล้ว)
  const selectTab = (key: OfficeTab) => {
    setActiveTab(key);
    window.history.replaceState(null, "", `/office?tab=${key}`);
  };

  const isConstruction = user?.department === "ฝ่ายก่อสร้าง";
  const canSeeTab = (t: (typeof TABS)[number]) => {
    if (t.adminOnly && !user?.isAdmin) return false;
    if (t.managerOnly && !user?.isManager && !user?.isAdmin) return false;
    if (t.constructionOnly && !isConstruction && !user?.isManager && !user?.isAdmin) return false;
    // Regular staff only see their own department's tab (managers/admins see all)
    if (!user?.isManager && !user?.isAdmin && t.dept && t.dept !== user?.department) return false;
    return true;
  };
  const showManagerLinks = user?.isManager || user?.isAdmin;

  useEffect(() => {
    // Deep-link: /office?tab=documents (ใช้ redirect จากหน้า /documents เดิม) — มาก่อน default ตามแผนก
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && TABS.some(t => t.key === tabParam)) { setActiveTab(tabParam as OfficeTab); return; }
    if (user?.department === "ฝ่ายบัญชี") setActiveTab("accounting");
    else if (user?.department === "ฝ่ายการเงิน") setActiveTab("finance");
    else if (user?.department === "ฝ่ายบุคคล") setActiveTab("hr");
    else if (user?.department === "ฝ่ายการตลาด") setActiveTab("marketing");
    else if (user?.department === "ฝ่ายหลังการขาย") setActiveTab("after-sales");
    else if (user?.department === "ฝ่ายก่อสร้าง") setActiveTab("materials");
  }, [user]);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* เมนูจัดหมวดอยู่บนสุด (ไม่ sticky) — ชิปที่เลือกไฮไลต์ทอง เนื้อหาแสดงต่อด้านล่าง */}
      <div className="px-4 pt-12 pb-3 border-b border-aviva-gold/10">
        <div className="max-w-lg mx-auto space-y-3">
          <h1 className="text-lg font-bold text-aviva-text">ออฟฟิศ</h1>
          {(() => {
            // ทุกหมวดใช้จำนวนคอลัมน์เท่ากัน (อิงหมวดที่มีเมนูมากสุด) → ช่องทุกหมวดกว้างเท่ากัน
            const sectionCells = MENU_SECTIONS.map(section => {
              const items = section.keys
                .map(k => TABS.find(t => t.key === k)!)
                .filter(t => t && canSeeTab(t));
              const withLinks = section.title === "ผู้บริหารและระบบ" && showManagerLinks;
              return { section, items, withLinks, count: items.length + (withLinks ? MANAGER_LINKS.length : 0) };
            });
            const cols = Math.max(...sectionCells.map(s => s.count), 4);
            return sectionCells.map(({ section, items, withLinks, count }) => {
            if (count === 0) return null;
            return (
              <div key={section.title}>
                <p className="text-[10px] font-bold text-aviva-secondary/70 uppercase tracking-wider mb-1.5">{section.title}</p>
                {/* กลุ่มละ 1 บรรทัดพอดีจอ — ช่องเท่ากันทุกหมวด (ไอคอนบน ชื่อล่าง) */}
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {items.map(({ key, label, icon: Icon, iconColor, iconBg }) => (
                    <button
                      key={key}
                      onClick={() => selectTab(key)}
                      className={clsx(
                        "flex flex-col items-center gap-1 rounded-xl border px-0.5 py-2 transition-all active:scale-95",
                        activeTab === key
                          ? "bg-aviva-gold/15 border-aviva-gold"
                          : "bg-aviva-card border-aviva-gold/10 hover:border-aviva-gold/40"
                      )}
                    >
                      <span className={`w-7 h-7 rounded-lg border flex items-center justify-center ${iconBg}`}>
                        <Icon size={14} className={iconColor} />
                      </span>
                      <span className={clsx(
                        "text-[9.5px] font-semibold text-center leading-tight",
                        activeTab === key ? "text-aviva-gold" : "text-aviva-text"
                      )}>{label}</span>
                    </button>
                  ))}
                  {withLinks && MANAGER_LINKS.map(({ label, href, icon: Icon, iconColor, iconBg }) => (
                    <Link
                      key={href}
                      href={href}
                      className="relative flex flex-col items-center gap-1 bg-aviva-card border border-aviva-gold/10 rounded-xl px-0.5 py-2 hover:border-aviva-gold/40 active:scale-95 transition-all"
                    >
                      <span className="absolute top-1 right-1.5 text-[8px] text-aviva-gold/60">↗</span>
                      <span className={`w-7 h-7 rounded-lg border flex items-center justify-center ${iconBg}`}>
                        <Icon size={14} className={iconColor} />
                      </span>
                      <span className="text-[9.5px] font-semibold text-aviva-text text-center leading-tight">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          });
          })()}
        </div>
      </div>

      {/* Conditional content */}
      {activeTab === "finance"     && <FinanceContent />}
      {activeTab === "accounting"  && <AccountingContent />}
      {activeTab === "marketing"   && <MarketingContent />}
      {activeTab === "hr"          && <HRContent />}
      {activeTab === "after-sales" && <AfterSalesContent />}
      {activeTab === "approvals"   && <ApprovalsContent />}
      {activeTab === "materials"   && <MaterialsContent />}
      {activeTab === "community"   && <CommunityContent />}
      {activeTab === "documents"   && <DocumentsContent />}
      {activeTab === "commands"    && <CommandsContent />}
      {activeTab === "audit"       && <AuditLogContent />}
    </div>
  );
}
