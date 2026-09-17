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
import { CommunityHouse, CommunityMember, PROJECT_ID } from "./_shared";

export default function CommunityContent() {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [houses, setHouses] = useState<CommunityHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ house_id: "", owner_name: "", owner_phone: "", area_sqw: "" });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "Paid" | "Unpaid">("all");

  const fetchMembers = () => {
    supabase.from("community_members").select("*").order("owner_name").limit(300)
      .then(({ data }) => { setMembers((data as CommunityMember[]) ?? []); setLoading(false); });
  };

  useEffect(() => {
    fetchMembers();
    supabase.from("houses").select("id,house_number,land_size").eq("project_id", PROJECT_ID).order("plot_number").limit(31)
      .then(({ data }) => setHouses((data as CommunityHouse[]) ?? []));
  }, []);

  const fmtFee = (n: number) => `฿${Number(n).toLocaleString("th-TH")}`;
  const totalFee = members.reduce((s, m) => s + Number(m.annual_fee), 0);
  const paidCount = members.filter((m) => m.fee_status === "Paid").length;
  const unpaidCount = members.filter((m) => m.fee_status === "Unpaid").length;
  const filtered = filterStatus === "all" ? members : members.filter((m) => m.fee_status === filterStatus);

  const handleAdd = async () => {
    if (!form.owner_name || !form.area_sqw) return;
    setSaving(true);
    await supabase.from("community_members").insert({
      house_id: form.house_id || null,
      owner_name: form.owner_name,
      owner_phone: form.owner_phone,
      area_sqw: parseAmountOrZero(form.area_sqw) ?? 0,
      annual_fee: (parseAmountOrZero(form.area_sqw) ?? 0) * 30,
      fee_status: "Unpaid",
    });
    setSaving(false);
    setShowModal(false);
    setForm({ house_id: "", owner_name: "", owner_phone: "", area_sqw: "" });
    fetchMembers();
  };

  const handleMarkPaid = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Paid" ? "Unpaid" : "Paid";
    await supabase.from("community_members").update({
      fee_status: newStatus,
      transferred_at: newStatus === "Paid" ? new Date().toISOString() : null,
    }).eq("member_id", id);
    fetchMembers();
  };

  return (
    <>
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-aviva-secondary">
          {loading ? "กำลังโหลด..." : `${members.length} สมาชิก · รวม ${fmtFee(totalFee)}`}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCsv(`community-members-${thaiDateStr()}`,
            ["เจ้าของ", "เบอร์โทร", "พื้นที่(ตร.ว.)", "ค่าส่วนกลาง", "สถานะ", "วันที่ชำระ"],
            members.map(m => [m.owner_name, m.owner_phone, m.area_sqw, m.annual_fee, m.fee_status === "Paid" ? "ชำระแล้ว" : "ค้างชำระ", m.transferred_at ? new Date(m.transferred_at).toLocaleDateString("th-TH") : ""]))}
            className="bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-xs font-bold px-3 py-2 rounded-xl">
            CSV
          </button>
          <button onClick={() => { setForm({ house_id: "", owner_name: "", owner_phone: "", area_sqw: "" }); setShowModal(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
            <Plus size={14} /> เพิ่มสมาชิก
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <GlassCard className="p-3 text-center">
          <Users size={16} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-text">{members.length}</p>
          <p className="text-[10px] text-aviva-secondary">สมาชิกทั้งหมด</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">{paidCount}</p>
          <p className="text-[10px] text-aviva-secondary">ชำระแล้ว</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <DollarSign size={16} className="text-red-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-red-400">{unpaidCount}</p>
          <p className="text-[10px] text-aviva-secondary">ค้างชำระ</p>
        </GlassCard>
      </div>

      <div className="flex gap-2">
        {[{ k: "all", l: "ทั้งหมด" }, { k: "Unpaid", l: "ค้างชำระ" }, { k: "Paid", l: "ชำระแล้ว" }].map(({ k, l }) => (
          <button key={k} onClick={() => setFilterStatus(k as "all" | "Paid" | "Unpaid")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              filterStatus === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      <div className="space-y-3">
        <SectionHeader title="ทะเบียนสมาชิก" subtitle="ค่าส่วนกลาง = พื้นที่ × ฿30/ตร.ว." />
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Home size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีสมาชิก</p>
          </GlassCard>
        ) : (
          filtered.map((m) => (
            <GlassCard key={m.member_id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-aviva-text">{m.owner_name}</p>
                  {m.owner_phone && <p className="text-xs text-aviva-secondary">{m.owner_phone}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-aviva-secondary">{m.area_sqw} ตร.ว.</span>
                    <span className="text-xs font-medium text-aviva-gold">{fmtFee(Number(m.annual_fee))}/ปี</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                    m.fee_status === "Paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {m.fee_status === "Paid" ? "ชำระแล้ว" : "ค้างชำระ"}
                  </span>
                  {m.fee_status === "Paid" ? (
                    <>
                      {m.transferred_at && (
                        <span className="text-[9px] text-aviva-secondary">ชำระเมื่อ {new Date(m.transferred_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                      <button onClick={() => handleMarkPaid(m.member_id, m.fee_status)}
                        className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg">
                        ยกเลิกการชำระ
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleMarkPaid(m.member_id, m.fee_status)}
                      className="text-[10px] bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg">
                      บันทึกรับชำระ
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>

    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-aviva-text">เพิ่มสมาชิกใหม่</h2>
            <button aria-label="ปิด" onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="commform-house_id" className="text-xs text-aviva-secondary mb-1 block">แปลงบ้าน (ผูกกับทะเบียนบ้าน)</label>
              <select id="commform-house_id" value={form.house_id}
                onChange={(e) => {
                  const h = houses.find(h => h.id === e.target.value);
                  setForm({ ...form, house_id: e.target.value, area_sqw: h?.land_size != null ? String(h.land_size) : form.area_sqw });
                }}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                <option value="">— ไม่ผูกแปลง (กรอกพื้นที่เอง) —</option>
                {houses.map(h => (
                  <option key={h.id} value={h.id}>{h.house_number}{h.land_size != null ? ` · ${h.land_size} ตร.ว.` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="commform-owner_name" className="text-xs text-aviva-secondary mb-1 block">ชื่อเจ้าของ *</label>
              <input id="commform-owner_name" type="text" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div>
              <label htmlFor="commform-owner_phone" className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร</label>
              <input id="commform-owner_phone" type="tel" value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                placeholder="0XX-XXX-XXXX"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div>
              <label htmlFor="commform-area_sqw" className="text-xs text-aviva-secondary mb-1 block">พื้นที่ (ตร.ว.) *</label>
              <input id="commform-area_sqw" type="number" value={form.area_sqw} onChange={(e) => setForm({ ...form, area_sqw: e.target.value })}
                placeholder="50"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              {form.area_sqw && (
                <p className="text-xs text-aviva-gold mt-1">ค่าส่วนกลางต่อปี: ฿{(Number(form.area_sqw) * 30).toLocaleString("th-TH")}</p>
              )}
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving || !form.owner_name || !form.area_sqw}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "เพิ่มสมาชิก"}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
