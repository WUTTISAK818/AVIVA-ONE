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
import { DocFilterCat, OfficeDocument, PROJECT_ID, docCategoryStyle, docCategoryTh, docStatusConfig } from "./_shared";

export default function DocumentsContent() {
  const user = useCurrentUser();
  const [docs, setDocs] = useState<OfficeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DocFilterCat>("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Contract", uploaded_by: "", file_url: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchDocs = () => {
    supabase.from("documents").select("*").eq("project_id", PROJECT_ID).limit(300)
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => { setDocs((data as OfficeDocument[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchDocs(); }, []);

  const counts = {
    approved: docs.filter(d => d.status === "approved").length,
    pending:  docs.filter(d => d.status === "pending").length,
  };

  const filtered = docs.filter(
    d => (filter === "all" || d.category === filter) &&
      (search === "" || d.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const docNum = await generateDocNumber("DOC");
    const { data: docData, error: docErr } = await supabase.from("documents").insert({
      project_id: PROJECT_ID,
      name: form.name,
      category: form.category,
      doc_number: docNum,
      uploaded_by: form.uploaded_by || user?.full_name || user?.email || "ไม่ทราบ",
      file_url: form.file_url || null,
      description: form.description || null,
      status: "pending",
    }).select().single();
    if (docErr) { setSaving(false); alert(thaiDbError(docErr, "เพิ่มเอกสาร")); return; }
    if (docData) {
      await supabase.from("approval_logs").insert({
        workflow_type: "Document_Approval",
        source_doc_index: form.name,
        source_record_id: docData.id,
        submitted_by_user_id: user?.id ?? null,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: null,
        sla_due_at: calcSlaDueAt("Document_Approval"),
        assigned_to_name: "ผู้จัดการ",
      });
    }
    await createNotification({
      type: "document",
      title: "เอกสารใหม่รอการอนุมัติ",
      message: `[${docCategoryTh[form.category] ?? form.category}] ${form.name}${form.description ? ` — ${form.description}` : ""}`,
      from_dept: "ฝ่ายออฟฟิศ",
    });
    setSaving(false);
    setShowModal(false);
    setForm({ name: "", category: "Contract", uploaded_by: "", file_url: "", description: "" });
    fetchDocs();
  };

  const handleApprove = async (id: string, approve: boolean) => {
    const doc = docs.find(d => d.id === id);
    await supabase.from("documents").update({
      status: approve ? "approved" : "rejected",
      approved_by: user?.full_name ?? "Admin",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    await supabase.from("approval_logs").update({ action_taken: approve ? "Approved" : "Rejected", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("source_record_id", id).eq("workflow_type", "Document_Approval").eq("action_taken", "Pending");
    if (doc) {
      await createNotification({
        type: approve ? "success" : "info",
        title: approve ? "อนุมัติเอกสารแล้ว" : "ปฏิเสธเอกสาร",
        message: `${doc.name}${doc.description ? ` — ${doc.description}` : ""}`,
        from_dept: "ฝ่ายออฟฟิศ",
      });
    }
    fetchDocs();
  };

  return (
    <>
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <DeptBriefingPanel dept="document" label="ฝ่ายเอกสาร" />
      <div className="flex items-center justify-between">
        <p className="text-xs text-aviva-secondary">
          {loading ? "กำลังโหลด..." : `${docs.length} ไฟล์`}
        </p>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
          <Upload size={13} /> เพิ่มเอกสาร
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">{loading ? "—" : counts.approved}</p>
          <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <Clock size={16} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-yellow-400">{loading ? "—" : counts.pending}</p>
          <p className="text-[10px] text-aviva-secondary">รออนุมัติ</p>
        </GlassCard>
        <GlassCard gold className="p-3 text-center">
          <FolderOpen size={16} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-gold">{loading ? "—" : docs.length}</p>
          <p className="text-[10px] text-aviva-secondary">ทั้งหมด</p>
        </GlassCard>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
        <input
          type="text"
          placeholder="ค้นหาเอกสาร..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "Contract", "Loan", "Permit", "Utility"] as DocFilterCat[]).map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={clsx("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              filter === cat ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>
            {cat === "all" ? "ทั้งหมด" : docCategoryTh[cat]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <SectionHeader title={`เอกสาร (${filtered.length})`} />
        {loading
          ? [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />)
          : filtered.length === 0
          ? (
            <GlassCard className="p-8 text-center">
              <p className="text-aviva-secondary text-sm">ไม่พบเอกสาร</p>
            </GlassCard>
          )
          : filtered.map((doc) => {
              const sConf = docStatusConfig[doc.status] ?? docStatusConfig.pending;
              const Icon = sConf.icon;
              return (
                <GlassCard key={doc.id} className={clsx("p-3 border", sConf.bg)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-aviva-card flex items-center justify-center flex-shrink-0">
                      <FolderOpen size={16} className="text-aviva-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {doc.doc_number && (
                          <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-md border border-aviva-gold/20 flex-shrink-0">
                            {doc.doc_number}
                          </span>
                        )}
                        <p className="text-sm text-aviva-text font-medium truncate">{doc.name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", docCategoryStyle[doc.category])}>
                          {docCategoryTh[doc.category] ?? doc.category}
                        </span>
                        <span className="text-[10px] text-aviva-secondary">{doc.uploaded_by}</span>
                      </div>
                      {doc.description && (
                        <p className="text-[10px] text-aviva-secondary/70 mt-0.5 line-clamp-2">{doc.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {doc.file_url && (
                        doc.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                          ? <a href={doc.file_url} target="_blank" rel="noreferrer">
                              <img src={doc.file_url} alt="ไฟล์แนบ" className="w-12 h-12 rounded-lg object-cover border border-aviva-gold/20" />
                            </a>
                          : <a href={doc.file_url} target="_blank" rel="noreferrer"
                              className="text-[10px] text-aviva-gold underline">ดูไฟล์</a>
                      )}
                      <Icon size={14} className={sConf.color} />
                      <span className={clsx("text-[10px] font-medium", sConf.color)}>{sConf.label}</span>
                    </div>
                  </div>
                  {doc.status === "pending" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleApprove(doc.id, true)}
                        className="flex-1 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium">
                        อนุมัติ
                      </button>
                      <button onClick={() => handleApprove(doc.id, false)}
                        className="flex-1 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium">
                        ปฏิเสธ
                      </button>
                    </div>
                  )}
                </GlassCard>
              );
            })}
      </div>
    </div>

    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-aviva-text">เพิ่มเอกสาร</h2>
            <button aria-label="ปิด" onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="docform-name" className="text-xs text-aviva-secondary mb-1 block">ชื่อเอกสาร *</label>
              <input id="docform-name" type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น สัญญาจะซื้อจะขาย บ้านเลข A-01"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="docform-category" className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select id="docform-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["Contract","Loan","Permit","Utility","Other"].map(c =>
                    <option key={c} value={c}>{docCategoryTh[c] ?? c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="docform-uploaded_by" className="text-xs text-aviva-secondary mb-1 block">อัปโหลดโดย</label>
                <input id="docform-uploaded_by" type="text" value={form.uploaded_by}
                  onChange={(e) => setForm({ ...form, uploaded_by: e.target.value })}
                  placeholder="ชื่อผู้อัปโหลด"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <div>
              <label htmlFor="docform-description" className="text-xs text-aviva-secondary mb-1 block">คำอธิบายเอกสาร</label>
              <textarea id="docform-description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="อธิบายวัตถุประสงค์และเนื้อหาของเอกสาร..." rows={2}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
            </div>
            <div>
              <label htmlFor="docform-file_url" className="text-xs text-aviva-secondary mb-1 block">ลิงค์ไฟล์ (Google Drive / URL)</label>
              <input id="docform-file_url" type="url" value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "เพิ่มเอกสาร"}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
