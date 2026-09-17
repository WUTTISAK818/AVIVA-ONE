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
import { Material, PROJECT_ID, PurchaseOrder, poTemplates } from "./_shared";

export default function MaterialsContent() {
  const user = useCurrentUser();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [houseList, setHouseList] = useState<{ id: string; house_number: string }[]>([]);
  const [activeView, setActiveView] = useState<"stock" | "po">("stock");
  const [loading, setLoading] = useState(true);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poForm, setPoForm] = useState({ supplier_name: "", notes: "", delivery_date: "", house_id: "", category: DEFAULT_MATERIAL_CATEGORY as string });
  const [poItemRows, setPoItemRows] = useState([{ name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }]);
  const [poFiles, setPoFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const fetchMaterialsData = () => {
    Promise.all([
      supabase.from("materials").select("*").eq("project_id", PROJECT_ID).order("name").limit(300),
      supabase.from("purchase_orders").select("*").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }).limit(300),
      supabase.from("houses").select("id, house_number").eq("project_id", PROJECT_ID).order("house_number").limit(300),
    ]).then(([mRes, pRes, hRes]) => {
      setMaterials((mRes.data as Material[]) ?? []);
      setPos((pRes.data as PurchaseOrder[]) ?? []);
      setHouseList((hRes.data as { id: string; house_number: string }[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(() => { fetchMaterialsData(); }, []);

  const stockStatus = (m: Material) => {
    const cur = m.current_stock ?? 0;
    const min = m.min_stock ?? 0;
    if (cur === 0) return { label: "หมด", cls: "bg-red-500/20 text-red-400" };
    if (cur < min) return { label: "ต่ำ", cls: "bg-yellow-500/20 text-yellow-400" };
    return { label: "OK", cls: "bg-green-500/20 text-green-400" };
  };

  const poStatusLabel: Record<string, { label: string; cls: string }> = {
    draft:            { label: "ร่าง",         cls: "bg-gray-500/20 text-gray-400" },
    pending_approval: { label: "รออนุมัติ",     cls: "bg-yellow-500/20 text-yellow-400" },
    approved:         { label: "อนุมัติแล้ว",   cls: "bg-green-500/20 text-green-400" },
    received:         { label: "รับของแล้ว",    cls: "bg-blue-500/20 text-blue-400" },
    cancelled:        { label: "ยกเลิก",        cls: "bg-red-500/20 text-red-400" },
  };

  const handleCreatePO = async () => {
    if (!poForm.supplier_name) { setToast({ msg: "กรอกชื่อผู้จัดจำหน่ายก่อน", type: "error" }); return; }
    if (poItemRows.every(r => !r.name)) { setToast({ msg: "เพิ่มรายการสั่งซื้ออย่างน้อย 1 รายการ", type: "error" }); return; }
    setSaving(true);
    const poDocNum = await generateDocNumber("PO");
    const parsedItems = poItemRows.filter(r => r.name).map(r => ({ name: r.name, qty: Number(r.qty) || 1, unit: r.unit || "ชิ้น", unit_price: Number(r.unit_price) || 0 }));
    const total = parsedItems.reduce((s, i) => s + (i.qty * i.unit_price), 0);
    const byName = user?.full_name ?? user?.email ?? "Unknown";
    const houseObj = houseList.find(h => h.id === poForm.house_id);
    const houseLabel = houseObj ? `หน้างาน ${houseObj.house_number}` : "";
    const { data: poData, error: poErr } = await supabase.from("purchase_orders").insert({
      project_id: PROJECT_ID,
      po_number: poDocNum,
      supplier_name: poForm.supplier_name,
      items: parsedItems,
      total_amount: total,
      status: "draft",
      requested_by: byName,
      notes: poForm.notes,
      house_id: poForm.house_id || null,
      category: poForm.category,
      ...(poForm.delivery_date ? { delivery_date: poForm.delivery_date } : {}),
    }).select().single();
    if (poErr) { setSaving(false); setToast({ msg: thaiDbError(poErr, "สร้าง PO"), type: "error" }); return; }
    if (poData) {
      // แนบใบเสนอราคา/เอกสารร้านค้า
      if (poFiles.length) {
        const urls = await uploadPhotos("document-attachments", `entity-docs/purchase_order/${poData.id}/${Date.now()}`, poFiles,
          { onFail: f => setToast({ msg: uploadFailText(f), type: "error" }) });
        for (let i = 0; i < urls.length; i++) {
          await attachDocumentToEntity("purchase_order", poData.id, urls[i], poFiles[i]?.name ?? `เอกสาร-${i + 1}`, byName);
        }
      }
      await supabase.from("approval_logs").insert({
        workflow_type: "Material_Purchase",
        source_doc_index: `${poDocNum} | ${houseLabel ? houseLabel + " · " : ""}[${poForm.category}] PO — ${poForm.supplier_name}${poForm.delivery_date ? ` (กำหนดส่ง ${poForm.delivery_date})` : ""} | โดย ${byName}`,
        submitted_by_user_id: user?.id ?? null,
        source_record_id: poData.id,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: total,
        sla_due_at: calcSlaDueAt("Material_Purchase"),
        assigned_to_name: "ผู้จัดการ",
      });
    }
    await createNotification({
      type: "approval",
      title: "ใบสั่งซื้อ (PO) ใหม่",
      message: `จาก ${byName} · ${houseLabel ? houseLabel + " · " : ""}[${poForm.category}] ${poForm.supplier_name} ฿${total.toLocaleString("th-TH")} · ส่งให้ผู้จัดการพิจารณา`,
      from_dept: "ฝ่ายก่อสร้าง",
    });
    setSaving(false);
    setShowPOModal(false);
    setPoForm({ supplier_name: "", notes: "", delivery_date: "", house_id: "", category: DEFAULT_MATERIAL_CATEGORY });
    setPoItemRows([{ name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }]);
    setPoFiles([]);
    fetchMaterialsData();
  };

  const handlePOApprove = async (id: string) => {
    const po = pos.find(p => p.id === id);
    // กันอนุมัติซ้ำ: update เฉพาะ PO ที่ยังรออนุมัติ แล้วตรวจว่าเปลี่ยนจริง
    const { data: chPo, error: poErr } = await supabase.from("purchase_orders").update({ status: "approved", approved_by: user?.full_name, approved_at: new Date().toISOString() }).eq("id", id).eq("status", "pending_approval").select("id");
    if (poErr) { alert(thaiDbError(poErr, "อนุมัติ PO")); return; }
    if (!chPo || chPo.length === 0) { alert("PO นี้ถูกดำเนินการไปแล้ว"); fetchMaterialsData(); return; }
    // ดึงผู้ขอ (submitted_by_user_id) เพื่อแจ้งผลกลับถึงตัวคนขอ
    const { data: logRow } = await supabase.from("approval_logs").update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user?.email }).eq("source_record_id", id).eq("workflow_type", "Material_Purchase").eq("action_taken", "Pending").select("submitted_by_user_id").maybeSingle();
    if (po) {
      let requesterEmail: string | null = null;
      if (logRow?.submitted_by_user_id) {
        const { data: reqUser } = await supabase.from("users").select("email").eq("id", logRow.submitted_by_user_id).maybeSingle();
        requesterEmail = reqUser?.email ?? null;
      }
      await createNotification({
        type: "success",
        title: "อนุมัติ PO แล้ว",
        message: `${po.supplier_name} — ฿${(po.total_amount ?? 0).toLocaleString("th-TH")} ได้รับการอนุมัติโดย ${user?.full_name ?? "Admin"}`,
        from_dept: "ฝ่ายก่อสร้าง",
        to_dept: "ฝ่ายก่อสร้าง",
      });
      // แจ้งเจาะถึงผู้ขอโดยตรง (ถ้าทราบอีเมล)
      if (requesterEmail) {
        await createNotification({
          type: "success",
          title: `✅ คำขอสั่งซื้อของคุณได้รับอนุมัติ`,
          message: `${po.po_number ?? ""} · ${po.supplier_name} ฿${(po.total_amount ?? 0).toLocaleString("th-TH")} — อนุมัติโดย ${user?.full_name ?? "ผู้บริหาร"}`,
          from_dept: "ผู้บริหาร",
          to_user_email: requesterEmail,
          link: "/construction",
        });
      }
    }
    fetchMaterialsData();
  };

  // A4: รับของจาก PO ที่อนุมัติ → อัปเดตสต็อกวัสดุ + บันทึก goods_receipts + PO=received
  const handleReceivePO = async (po: PurchaseOrder) => {
    if (!Array.isArray(po.items) || po.items.length === 0) return;
    for (const item of po.items) {
      const mat = materials.find(m => m.name === item.name);
      if (mat) await supabase.from("materials").update({ current_stock: (mat.current_stock ?? 0) + Number(item.qty) }).eq("id", mat.id);
    }
    await supabase.from("goods_receipts").insert({
      grn_number: `GRN-${Date.now().toString().slice(-8)}`, po_id: po.id,
      received_by: user?.full_name ?? user?.email ?? null,
      received_date: thaiDateStr(),
      items: po.items, status: "received", project_id: PROJECT_ID,
    });
    await supabase.from("purchase_orders").update({ status: "received" }).eq("id", po.id);
    await createNotification({ type: "success", title: "รับของเข้าสต็อกแล้ว", message: `${po.po_number ?? ""} — ${po.supplier_name} (อัปเดตสต็อก ${po.items.length} รายการ)`, from_dept: "ฝ่ายก่อสร้าง" });
    fetchMaterialsData();
  };

  const lowStockCount = materials.filter(m => (m.current_stock ?? 0) < (m.min_stock ?? 0)).length;

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <Package size={14} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-lg font-bold text-aviva-text">{materials.length}</p>
          <p className="text-[10px] text-aviva-secondary">รายการวัสดุ</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <AlertTriangle size={14} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-yellow-400">{lowStockCount}</p>
          <p className="text-[10px] text-aviva-secondary">สต๊อกต่ำ</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <FileText size={14} className="text-blue-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-400">{pos.filter(p => p.status === "pending_approval").length}</p>
          <p className="text-[10px] text-aviva-secondary">รออนุมัติ PO</p>
        </GlassCard>
      </div>

      {/* View tabs */}
      <div className="flex gap-2">
        {[{ k: "stock", l: "สต๊อกวัสดุ" }, { k: "po", l: "ใบสั่งซื้อ" }].map(({ k, l }) => (
          <button key={k} onClick={() => setActiveView(k as "stock" | "po")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              activeView === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
        {(user?.isManager || user?.isAdmin) && (
          <button onClick={() => setShowPOModal(true)}
            className="flex items-center gap-1 bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/30 px-3 py-2 rounded-xl text-xs font-medium">
            <Plus size={12} /> PO
          </button>
        )}
      </div>

      {/* Stock View */}
      {activeView === "stock" && (
        <div className="space-y-2">
          {loading ? [1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />) :
           materials.map(m => {
            const st = stockStatus(m);
            return (
              <GlassCard key={m.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-aviva-card flex items-center justify-center flex-shrink-0">
                    <Package size={16} className="text-aviva-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-aviva-text font-medium truncate">{m.name}</p>
                    <p className="text-[10px] text-aviva-secondary">
                      สต๊อก: {m.current_stock ?? 0} {m.unit} · ขั้นต่ำ: {m.min_stock ?? 0} {m.unit}
                    </p>
                  </div>
                  <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", st.cls)}>{st.label}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* PO View */}
      {activeView === "po" && (
        <div className="space-y-2">
          {loading ? [1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />) :
           pos.length === 0 ? (
            <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีใบสั่งซื้อ</p></GlassCard>
           ) : pos.map(po => {
            const stConf = poStatusLabel[po.status] ?? { label: po.status, cls: "bg-gray-500/20 text-gray-400" };
            const isExpanded = expandedPO === po.id;
            return (
              <GlassCard key={po.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-aviva-gold">{po.po_number ?? "—"}</span>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full", stConf.cls)}>{stConf.label}</span>
                    </div>
                    <p className="text-sm text-aviva-text mt-0.5">{po.supplier_name}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {po.house_id && houseList.find(h => h.id === po.house_id) && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">🏠 {houseList.find(h => h.id === po.house_id)!.house_number}</span>
                      )}
                      {po.category && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/25">{po.category}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-aviva-secondary mt-0.5">โดย {po.requested_by} · ฿{(po.total_amount ?? 0).toLocaleString("th-TH")}</p>
                  </div>
                  <button onClick={() => setExpandedPO(isExpanded ? null : po.id)} className="text-aviva-secondary/50 mt-1">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {isExpanded && Array.isArray(po.items) && (
                  <div className="bg-aviva-bg rounded-xl p-2 space-y-1">
                    {po.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-aviva-secondary">{item.name} × {item.qty} {item.unit}</span>
                        <span className="text-aviva-text">฿{(item.qty * item.unit_price).toLocaleString("th-TH")}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-0.5">
                  <AttachDocButton entityType="purchase_order" entityId={po.id} attachedBy={user?.full_name ?? ""} templates={poTemplates(po)} />
                </div>
                {po.status === "pending_approval" && (user?.isManager || user?.isAdmin) && (
                  <button onClick={() => handlePOApprove(po.id)}
                    className="w-full py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    <CheckCircle size={12} /> อนุมัติ PO
                  </button>
                )}
                {po.status === "approved" && (
                  <button onClick={() => handleReceivePO(po)}
                    className="w-full py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    📦 รับของเข้าสต็อก
                  </button>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Create PO Modal */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">สร้างใบสั่งซื้อ (PO)</h2>
              <button onClick={() => setShowPOModal(false)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="poform-house" className="text-xs text-aviva-secondary mb-1 block">บ้าน / หน้างาน</label>
                  <select id="poform-house" value={poForm.house_id} onChange={e => setPoForm(p => ({ ...p, house_id: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">— เลือกหน้างาน —</option>
                    {houseList.map(h => <option key={h.id} value={h.id}>{h.house_number}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="poform-category" className="text-xs text-aviva-secondary mb-1 block">หมวดวัสดุ</label>
                  <select id="poform-category" value={poForm.category} onChange={e => setPoForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="poform-supplier_name" className="text-xs text-aviva-secondary mb-1 block">ชื่อผู้จำหน่าย *</label>
                <input id="poform-supplier_name" value={poForm.supplier_name} onChange={e => setPoForm(p => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="บ. วัสดุก่อสร้าง จก." className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="poform-materials" className="text-xs text-aviva-secondary mb-1 block">รายการวัสดุ *</label>
                <div id="poform-materials" className="space-y-2">
                  <datalist id="po-mat-names">{materials.map(m => <option key={m.id} value={m.name} />)}</datalist>
                  {poItemRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                      <input value={row.name} list="po-mat-names" onChange={e => setPoItemRows(r => r.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                        placeholder="ชื่อวัสดุ" className="col-span-4 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
                      <input type="number" value={row.qty} onChange={e => setPoItemRows(r => r.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))}
                        placeholder="จำนวน" className="col-span-2 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
                      <input value={row.unit} onChange={e => setPoItemRows(r => r.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))}
                        placeholder="หน่วย" className="col-span-2 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
                      <input type="number" value={row.unit_price} onChange={e => setPoItemRows(r => r.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))}
                        placeholder="ราคา/หน่วย" className="col-span-3 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/60" />
                      <button onClick={() => setPoItemRows(r => r.filter((_, i) => i !== idx))} disabled={poItemRows.length === 1}
                        className="col-span-1 text-red-400/60 disabled:opacity-20 flex items-center justify-center"><X size={12} /></button>
                    </div>
                  ))}
                  <button onClick={() => setPoItemRows(r => [...r, { name: "", qty: "1", unit: "ชิ้น", unit_price: "0" }])}
                    className="text-xs text-aviva-gold/70 flex items-center gap-1 mt-1"><Plus size={12} /> เพิ่มรายการ</button>
                  {poItemRows.some(r => r.name) && (
                    <p className="text-xs text-aviva-secondary text-right">รวม: ฿{poItemRows.filter(r => r.name).reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0).toLocaleString("th-TH")}</p>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="poform-delivery_date" className="text-xs text-aviva-secondary mb-1 block">กำหนดส่งของ</label>
                <input id="poform-delivery_date" type="date" value={poForm.delivery_date} onChange={e => setPoForm(p => ({ ...p, delivery_date: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="poform-notes" className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <input id="poform-notes" value={poForm.notes} onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="หมายเหตุเพิ่มเติม" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">แนบใบเสนอราคา / เอกสารร้านค้า (รูปหรือ PDF)</label>
                <MultiPhotoInput value={poFiles} onChange={setPoFiles} accept="image/*,application/pdf" label="แตะเพื่อแนบใบเสนอราคา/เอกสาร" />
              </div>
            </div>
            <button onClick={handleCreatePO} disabled={saving || !poForm.supplier_name || poItemRows.every(r => !r.name)}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "สร้าง PO"}
            </button>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
