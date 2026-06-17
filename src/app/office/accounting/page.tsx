"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, BookOpen, Users, Truck, Receipt, Calculator,
  TrendingUp, Scan, GitMerge, Plus, X, Check, AlertTriangle,
  Clock, Download, ChevronDown, ChevronUp, Building2, Coins,
  FileCheck, RefreshCw, Eye, Send, Landmark, ArrowLeftRight, Scale,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { postJv, yymm } from "@/lib/jv";
import { AR as ACC_AR, AP as ACC_AP, BANK, OUTPUT_VAT, INPUT_VAT, SALES_REVENUE, CUSTOMER_ADVANCE, COGS, WIP, WHT_PAYABLE, PREPAID_WHT, SBT_EXPENSE, TRANSFER_FEE } from "@/lib/gl-accounts";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import ReceiptScanner from "@/components/ReceiptScanner";
import clsx from "clsx";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
// C6 — รวมอัตราภาษีไว้ที่เดียว (เลิก hardcode กระจาย)
const TAX_CONFIG = {
  VAT_RATE: 0.07,        // ภาษีมูลค่าเพิ่ม 7%
  SBT_BASE_RATE: 0.03,   // ภ.ธ.40 3%
  SBT_LOCAL_SURTAX: 0.1, // ภาษีท้องถิ่น 10% ของ ภ.ธ.
  SBT_RATE: 0.033,       // รวม 3.3%
  LBT_RATE: 0.003,       // ภาษีที่ดินเพื่อการค้า 0.3%
  WHT_RATES: [0, 1, 2, 3, 5, 10] as const,
};
const fmt = (n: number) =>
  (n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtM = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : fmt(n);
const today = () => new Date().toISOString().split("T")[0];

type AccTab = "dashboard" | "journal" | "ar" | "ap" | "tax" | "lot-cost" | "tfrs15" | "scanner" | "matching" | "bankrec" | "reports";
type TaxSubTab = "transfer" | "vat" | "wht" | "sbt" | "lbt";

const TABS: { key: AccTab; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "ภาพรวม", icon: TrendingUp },
  { key: "journal", label: "สมุดรายวัน", icon: BookOpen },
  { key: "ar", label: "ลูกหนี้", icon: Users },
  { key: "ap", label: "เจ้าหนี้", icon: Truck },
  { key: "tax", label: "ภาษี", icon: Calculator },
  { key: "lot-cost", label: "ต้นทุนแปลง", icon: Building2 },
  { key: "tfrs15", label: "TFRS 15", icon: FileCheck },
  { key: "scanner", label: "สแกนใบเสร็จ", icon: Scan },
  { key: "matching", label: "จับคู่สลิป", icon: GitMerge },
  { key: "bankrec", label: "กระทบยอด", icon: Landmark },
  { key: "reports", label: "งบ/รายงาน", icon: Scale },
];

interface ChartAccount { code: string; name_th: string; account_type: string; }
interface JvEntry { id: string; jv_number: string; jv_date: string; description: string; status: string; total_debit: number; total_credit: number; ref_number?: string; }
interface JvLine { account_code: string; account_name: string; debit: number; credit: number; description: string; }
interface ArInvoice { id: string; invoice_number: string; customer_name: string; invoice_date: string; due_date: string; base_amount: number; vat_amount: number; total_amount: number; paid_amount: number; status: string; description?: string; is_advance?: boolean; jv_id?: string; }
interface ApBill { id: string; bill_number: string; vendor_name: string; bill_date: string; due_date: string; base_amount: number; vat_amount: number; wht_rate: number; wht_amount: number; total_amount: number; paid_amount: number; status: string; description?: string; jv_id?: string; pay_jv_id?: string; expense_account?: string; }
interface VatEntry { id: string; vat_type: string; invoice_no: string; invoice_date: string; party_name: string; base_amount: number; vat_amount: number; total_amount: number; period: string; etax_status: string; }
interface WhtCert { id: string; cert_number: string; cert_date: string; payee_name: string; base_amount: number; wht_rate: number; wht_amount: number; tax_form: string; }

// พิมพ์หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)
function printWht(w: WhtCert) {
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const baht = (n: number) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>50 ทวิ ${esc(w.cert_number)}</title>
  <style>
    body{font-family:'Sarabun','TH Sarabun New',sans-serif;color:#1a1a1a;max-width:780px;margin:24px auto;padding:0 24px;font-size:14px}
    .hd{text-align:center;border-bottom:2px solid #1E4A35;padding-bottom:8px;margin-bottom:12px}
    .hd h1{margin:2px 0;font-size:18px;color:#1E4A35}
    .row{display:flex;justify-content:space-between;margin:4px 0}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th,td{border:1px solid #999;padding:6px 8px;font-size:13px}
    th{background:#f0ece1}
    .right{text-align:right}
    .sign{display:flex;justify-content:space-between;margin-top:48px}
    .sign div{text-align:center;width:45%}
    .line{border-top:1px dotted #555;margin-top:36px;padding-top:4px}
    .btns{position:fixed;top:10px;right:10px}
    button{padding:8px 14px;margin-left:6px;border:0;border-radius:6px;cursor:pointer}
    .p{background:#1E4A35;color:#fff}.c{background:#ccc}
    @media print{.btns{display:none}}
  </style></head><body>
  <div class="btns"><button class="p" onclick="window.print()">พิมพ์</button><button class="c" onclick="window.close()">ปิด</button></div>
  <div class="hd">
    <h1>หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
    <p>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร — แบบ ภ.ง.ด.${esc(w.tax_form)}</p>
    <p>เลขที่ ${esc(w.cert_number)}</p>
  </div>
  <div class="row"><span><b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย:</b> บริษัท อลิสา พร็อพเพอร์ตี้ ดีเวลลอปเม้นท์ จำกัด</span></div>
  <div class="row"><span><b>ผู้ถูกหักภาษี ณ ที่จ่าย:</b> ${esc(w.payee_name)}</span><span><b>วันที่:</b> ${esc(w.cert_date)}</span></div>
  <table>
    <tr><th>ประเภทเงินได้</th><th class="right">จำนวนเงินที่จ่าย (บาท)</th><th class="right">อัตรา</th><th class="right">ภาษีที่หัก (บาท)</th></tr>
    <tr><td>ค่าบริการ / ค่าจ้าง</td><td class="right">${baht(w.base_amount)}</td><td class="right">${w.wht_rate}%</td><td class="right">${baht(w.wht_amount)}</td></tr>
    <tr><td class="right"><b>รวม</b></td><td class="right"><b>${baht(w.base_amount)}</b></td><td></td><td class="right"><b>${baht(w.wht_amount)}</b></td></tr>
  </table>
  <p style="margin-top:10px">ผู้จ่ายเงินออกหนังสือรับรองฯ ฉบับนี้เพื่อเป็นหลักฐานการหักภาษี ณ ที่จ่าย</p>
  <div class="sign">
    <div><div class="line">ลงชื่อผู้จ่ายเงิน / ผู้มีหน้าที่หักภาษี</div></div>
    <div><div class="line">ลงชื่อผู้รับเงิน</div></div>
  </div>
  <p style="text-align:center;color:#888;font-size:11px;margin-top:24px">ออกโดยระบบ AVIVA ONE · ${new Date().toLocaleDateString("th-TH")}</p>
  </body></html>`;
  const win = window.open("", "_blank", "width=820,height=900");
  if (win) { win.document.write(html); win.document.close(); }
}
interface SbtEntry { id: string; period: string; base_amount: number; sbt_amount: number; total_tax: number; status: string; transfer_date?: string; }
interface LbtEntry { id: string; tax_year: number; appraised_value: number; tax_amount: number; status: string; due_date?: string; }
interface InfraCost { id: string; cost_type: string; total_cost: number; phase?: string; is_allocated: boolean; description?: string; }
interface RevenueRec { id: string; house_id?: string; house_number: string; contract_value: number; recognized_amount: number; deferred_amount: number; received_total: number; status: string; transfer_date?: string; contract_date?: string; }
interface House { id: string; house_number: string; plot_number: number; house_model: string; sale_price?: number; price?: number; land_cost?: number; }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-300",
    posted: "bg-green-500/20 text-green-300",
    pending: "bg-yellow-500/20 text-yellow-300",
    partial: "bg-blue-500/20 text-blue-300",
    paid: "bg-green-500/20 text-green-300",
    overdue: "bg-red-500/20 text-red-300",
    cancelled: "bg-gray-500/20 text-gray-400",
    recognized: "bg-green-500/20 text-green-300",
    submitted: "bg-blue-500/20 text-blue-300",
    active: "bg-green-500/20 text-green-300",
  };
  const label: Record<string, string> = {
    draft: "แบบร่าง", posted: "บันทึกแล้ว", pending: "รอดำเนินการ",
    partial: "ชำระบางส่วน", paid: "ชำระแล้ว", overdue: "เกินกำหนด",
    cancelled: "ยกเลิก", recognized: "รับรู้รายได้แล้ว", submitted: "ส่งแล้ว", active: "ใช้งาน",
  };
  return (
    <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium", map[status] ?? "bg-gray-500/20 text-gray-400")}>
      {label[status] ?? status}
    </span>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState({ jvCount: 0, arOutstanding: 0, apOverdue: 0, vatDue: 0, whtDue: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("jv_entries").select("id", { count: "exact" }).eq("project_id", PROJECT_ID).eq("status", "draft"),
      supabase.from("ar_invoices").select("total_amount,paid_amount").eq("project_id", PROJECT_ID).in("status", ["pending", "partial", "overdue"]),
      supabase.from("ap_bills").select("total_amount,paid_amount,due_date").eq("project_id", PROJECT_ID).in("status", ["pending", "partial"]),
      supabase.from("vat_register").select("vat_amount").eq("project_id", PROJECT_ID).eq("etax_status", "pending"),
      supabase.from("wht_certificates").select("wht_amount").eq("project_id", PROJECT_ID).is("period", null),
    ]).then(([jv, ar, ap, vat, wht]) => {
      const arOut = (ar.data ?? []).reduce((s, r) => s + (Number(r.total_amount) - Number(r.paid_amount)), 0);
      const now = today();
      const apOvd = (ap.data ?? []).filter(b => b.due_date < now).reduce((s, b) => s + (Number(b.total_amount) - Number(b.paid_amount)), 0);
      const vatDue = (vat.data ?? []).reduce((s, v) => s + Number(v.vat_amount), 0);
      const whtDue = (wht.data ?? []).reduce((s, w) => s + Number(w.wht_amount), 0);
      setStats({ jvCount: jv.count ?? 0, arOutstanding: arOut, apOverdue: apOvd, vatDue, whtDue });
    });
  }, []);

  const cards = [
    { label: "JV รอบันทึก", value: `${stats.jvCount} รายการ`, color: "text-yellow-300", icon: BookOpen },
    { label: "ลูกหนี้คงค้าง", value: `฿${fmtM(stats.arOutstanding)}`, color: "text-blue-300", icon: Users },
    { label: "เจ้าหนี้เกินกำหนด", value: `฿${fmtM(stats.apOverdue)}`, color: "text-red-400", icon: AlertTriangle },
    { label: "VAT รอส่ง", value: `฿${fmtM(stats.vatDue)}`, color: "text-aviva-gold", icon: Calculator },
    { label: "WHT รอออกหนังสือ", value: `฿${fmtM(stats.whtDue)}`, color: "text-purple-300", icon: Receipt },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader title="ภาพรวมฝ่ายบัญชี" subtitle="สรุปสถานะงานบัญชีทั้งหมด" />
      <div className="grid grid-cols-2 gap-3">
        {cards.map(c => (
          <GlassCard key={c.label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon size={14} className={c.color} />
              <p className="text-[11px] text-aviva-secondary">{c.label}</p>
            </div>
            <p className={clsx("text-lg font-bold", c.color)}>{c.value}</p>
          </GlassCard>
        ))}
      </div>
      <GlassCard gold className="p-4">
        <p className="text-xs font-semibold text-aviva-gold mb-1">ลงบัญชีด่วนด้วย AI</p>
        <p className="text-[11px] text-aviva-secondary mb-3">ถ่าย/อัปโหลดใบเสร็จหรือสลิปโอนเงิน ระบบจะอ่านยอด-วันที่-ร้านค้า แล้วจัดหมวดบัญชีให้อัตโนมัติ</p>
        <ReceiptScanner />
      </GlassCard>
      <GlassCard className="p-4">
        <p className="text-xs font-semibold text-aviva-gold mb-2">มาตรฐานที่ใช้</p>
        <div className="space-y-1.5 text-[11px] text-aviva-secondary">
          <p>• TFRS 15 — รับรู้รายได้เมื่อโอนกรรมสิทธิ์</p>
          <p>• VAT 7% (ภาษีมูลค่าเพิ่ม) + e-Tax Invoice</p>
          <p>• WHT ภ.ง.ด.1/3/53 ตามประเภทเงินได้</p>
          <p>• ภ.ธ.40 อัตรา 3.3% (ภาษีธุรกิจเฉพาะ)</p>
          <p>• Dr = Cr ทุกรายการบังคับ ก่อน Post JV</p>
        </div>
      </GlassCard>
    </div>
  );
}

function JournalTab({ accounts }: { accounts: ChartAccount[] }) {
  const [entries, setEntries] = useState<JvEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ jv_date: today(), description: "", ref_number: "" });
  const [jvLines, setJvLines] = useState<JvLine[]>([
    { account_code: "", account_name: "", debit: 0, credit: 0, description: "" },
    { account_code: "", account_name: "", debit: 0, credit: 0, description: "" },
  ]);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("jv_entries").select("*").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }).limit(50);
    setEntries((data ?? []) as JvEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const totalDr = jvLines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCr = jvLines.reduce((s, l) => s + Number(l.credit), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  const addLine = () => setJvLines(prev => [...prev, { account_code: "", account_name: "", debit: 0, credit: 0, description: "" }]);
  const removeLine = (i: number) => setJvLines(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof JvLine, value: string | number) => {
    setJvLines(prev => {
      const copy = [...prev];
      if (field === "account_code") {
        const acc = accounts.find(a => a.code === value);
        copy[i] = { ...copy[i], account_code: String(value), account_name: acc?.name_th ?? "" };
      } else {
        copy[i] = { ...copy[i], [field]: value };
      }
      return copy;
    });
  };

  const handleSave = async (postNow: boolean) => {
    if (!form.description || !balanced) return;
    setSaving(true);
    await postJv({
      project_id: PROJECT_ID,
      jv_date: form.jv_date,
      description: form.description,
      ref_number: form.ref_number || null,
      status: postNow ? "posted" : "draft",
      lines: jvLines.filter(l => l.account_code).map(l => ({
        account_code: l.account_code,
        account_name: l.account_name,
        debit: Number(l.debit),
        credit: Number(l.credit),
        description: l.description || null,
      })),
    });
    setSaving(false);
    setShowModal(false);
    setForm({ jv_date: today(), description: "", ref_number: "" });
    setJvLines([
      { account_code: "", account_name: "", debit: 0, credit: 0, description: "" },
      { account_code: "", account_name: "", debit: 0, credit: 0, description: "" },
    ]);
    fetch();
  };

  const postEntry = async (id: string) => {
    await supabase.from("jv_entries").update({ status: "posted" }).eq("id", id);
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="สมุดรายวัน (JV)" subtitle={`${entries.length} รายการ`} />
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-4 py-2 rounded-xl text-sm font-bold">
          <Plus size={14} /> สร้าง JV
        </button>
      </div>

      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
      ) : entries.length === 0 ? (
        <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ JV</p></GlassCard>
      ) : entries.map(e => (
        <GlassCard key={e.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs font-mono text-aviva-gold">{e.jv_number}</p>
                <StatusBadge status={e.status} />
              </div>
              <p className="text-sm text-aviva-text">{e.description}</p>
              <p className="text-[11px] text-aviva-secondary mt-0.5">{e.jv_date} · Dr ฿{fmt(e.total_debit)}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {e.status === "draft" && (
                <button onClick={() => postEntry(e.id)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30">
                  Post
                </button>
              )}
              <button onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                className="text-aviva-secondary">
                {expandedId === e.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>
          {expandedId === e.id && (
            <JvLinesView jvId={e.id} />
          )}
        </GlassCard>
      ))}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
          <div className="bg-aviva-card rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-aviva-card px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10">
              <h2 className="font-bold text-aviva-text">สร้าง JV ใหม่</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-aviva-secondary" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-aviva-secondary mb-1 block">วันที่ JV *</label>
                  <input type="date" value={form.jv_date} onChange={e => setForm(f => ({ ...f, jv_date: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text" />
                </div>
                <div>
                  <label className="text-[11px] text-aviva-secondary mb-1 block">เลขที่อ้างอิง</label>
                  <input type="text" placeholder="เช่น TINV-2601-001" value={form.ref_number}
                    onChange={e => setForm(f => ({ ...f, ref_number: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary mb-1 block">คำอธิบาย *</label>
                <input type="text" placeholder="เช่น ขายบ้าน Lot A-01" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-aviva-secondary">รายการ Dr/Cr</p>
                  <button onClick={addLine} className="text-[10px] text-aviva-gold flex items-center gap-1">
                    <Plus size={11} /> เพิ่มบรรทัด
                  </button>
                </div>
                <div className="space-y-2">
                  {jvLines.map((line, i) => (
                    <div key={i} className="bg-aviva-bg rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select value={line.account_code}
                          onChange={e => updateLine(i, "account_code", e.target.value)}
                          className="flex-1 bg-aviva-card border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text">
                          <option value="">-- รหัสบัญชี --</option>
                          {accounts.filter(a => !a.account_type.endsWith("header")).map(a => (
                            <option key={a.code} value={a.code}>{a.code} — {a.name_th}</option>
                          ))}
                        </select>
                        {jvLines.length > 2 && (
                          <button onClick={() => removeLine(i)}><X size={14} className="text-red-400" /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-aviva-secondary">Dr (เดบิต)</label>
                          <input type="number" min="0" placeholder="0.00"
                            value={line.debit || ""}
                            onChange={e => updateLine(i, "debit", e.target.value ? Number(e.target.value) : 0)}
                            disabled={line.credit > 0}
                            className="w-full bg-aviva-card border border-aviva-gold/10 rounded-lg px-2 py-1 text-xs text-aviva-text disabled:opacity-30" />
                        </div>
                        <div>
                          <label className="text-[10px] text-aviva-secondary">Cr (เครดิต)</label>
                          <input type="number" min="0" placeholder="0.00"
                            value={line.credit || ""}
                            onChange={e => updateLine(i, "credit", e.target.value ? Number(e.target.value) : 0)}
                            disabled={line.debit > 0}
                            className="w-full bg-aviva-card border border-aviva-gold/10 rounded-lg px-2 py-1 text-xs text-aviva-text disabled:opacity-30" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-aviva-secondary">รวม Dr:</span>
                    <span className={clsx("font-mono font-bold", balanced ? "text-green-400" : "text-aviva-text")}>
                      ฿{fmt(totalDr)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-aviva-secondary">รวม Cr:</span>
                    <span className={clsx("font-mono font-bold", balanced ? "text-green-400" : "text-aviva-text")}>
                      ฿{fmt(totalCr)}
                    </span>
                  </div>
                  {!balanced && totalDr > 0 && (
                    <p className="text-[10px] text-red-400 mt-1">⚠ Dr ≠ Cr ไม่สมดุล — ห้าม Post</p>
                  )}
                  {balanced && <p className="text-[10px] text-green-400 mt-1">✓ Dr = Cr สมดุล</p>}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleSave(false)} disabled={!form.description || totalDr === 0 || saving}
                  className="flex-1 py-3 rounded-2xl border border-aviva-gold/30 text-aviva-gold text-sm font-semibold disabled:opacity-40">
                  บันทึกแบบร่าง
                </button>
                <button onClick={() => handleSave(true)} disabled={!form.description || !balanced || saving}
                  className="flex-1 py-3 rounded-2xl bg-aviva-gold text-aviva-bg text-sm font-bold disabled:opacity-40">
                  {saving ? "กำลังบันทึก..." : "Post JV"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JvLinesView({ jvId }: { jvId: string }) {
  const [lines, setLines] = useState<{ account_code: string; account_name: string; debit: number; credit: number }[]>([]);
  useEffect(() => {
    supabase.from("jv_lines").select("account_code,account_name,debit,credit").eq("jv_id", jvId).order("line_order")
      .then(({ data }) => setLines(data ?? []));
  }, [jvId]);
  return (
    <div className="mt-3 pt-3 border-t border-aviva-gold/10">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-aviva-secondary">
            <th className="text-left pb-1">รหัสบัญชี</th>
            <th className="text-left pb-1">ชื่อบัญชี</th>
            <th className="text-right pb-1">Dr</th>
            <th className="text-right pb-1">Cr</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="text-aviva-text">
              <td className="py-0.5 font-mono">{l.account_code}</td>
              <td className="py-0.5">{l.account_name}</td>
              <td className="py-0.5 text-right text-blue-300">{l.debit > 0 ? fmt(l.debit) : ""}</td>
              <td className="py-0.5 text-right text-purple-300">{l.credit > 0 ? fmt(l.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ARTab() {
  const [invoices, setInvoices] = useState<ArInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_name: "", invoice_date: today(), due_date: "", base_amount: "", description: "", is_advance: false });
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("ar_invoices").select("*").eq("project_id", PROJECT_ID).order("invoice_date", { ascending: false }).limit(50);
    setInvoices((data ?? []) as ArInvoice[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const aging = { a0_30: 0, a31_60: 0, a61_90: 0, a90p: 0 };
  const now = new Date();
  invoices.filter(i => ["pending", "partial", "overdue"].includes(i.status)).forEach(inv => {
    const days = Math.ceil((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
    const bal = Number(inv.total_amount) - Number(inv.paid_amount);
    if (days < 0) return;
    if (days <= 30) aging.a0_30 += bal;
    else if (days <= 60) aging.a31_60 += bal;
    else if (days <= 90) aging.a61_90 += bal;
    else aging.a90p += bal;
  });

  const handleSave = async () => {
    if (!form.customer_name || !form.base_amount || !form.due_date) return;
    setSaving(true);
    const base = Number(form.base_amount);
    const vat = Math.round(base * TAX_CONFIG.VAT_RATE * 100) / 100;
    const total = base + vat;
    const d = new Date();
    const invNo = `TINV-${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;
    // ข้อ 2 — ตั้งลูกหนี้ + ลง GL อัตโนมัติ
    // เงินรับล่วงหน้า (ดาวน์): Dr ลูกหนี้การค้า / Cr เงินรับล่วงหน้า + VAT ขาย
    // ขายปกติ: Dr ลูกหนี้การค้า / Cr รายได้ขายบ้าน + VAT ขาย
    const creditAcc = form.is_advance ? CUSTOMER_ADVANCE : SALES_REVENUE;
    const jvLines = [
      { account_code: ACC_AR.code, account_name: ACC_AR.name, debit: total, credit: 0, description: form.customer_name },
      { account_code: creditAcc.code, account_name: creditAcc.name, debit: 0, credit: base, description: form.description || invNo },
    ];
    if (vat > 0) jvLines.push({ account_code: OUTPUT_VAT.code, account_name: OUTPUT_VAT.name, debit: 0, credit: vat, description: `VAT 7% ${invNo}` });
    const jvId = await postJv({
      project_id: PROJECT_ID,
      jv_date: form.invoice_date,
      description: `${form.is_advance ? "รับล่วงหน้า/ดาวน์" : "ตั้งลูกหนี้ขายบ้าน"} — ${form.customer_name}`,
      ref_number: invNo,
      lines: jvLines,
    });
    await supabase.from("ar_invoices").insert({
      invoice_number: invNo,
      customer_name: form.customer_name,
      invoice_date: form.invoice_date,
      due_date: form.due_date,
      base_amount: base,
      vat_amount: vat,
      total_amount: total,
      paid_amount: 0,
      status: "pending",
      description: form.description || null,
      is_advance: form.is_advance,
      jv_id: jvId,
      project_id: PROJECT_ID,
    });
    setSaving(false);
    setShowModal(false);
    setForm({ customer_name: "", invoice_date: today(), due_date: "", base_amount: "", description: "", is_advance: false });
    fetch();
  };

  // ข้อ 2 — รับชำระจากลูกหนี้ + ลง GL (Dr เงินฝากธนาคาร / Cr ลูกหนี้การค้า)
  const receivePayment = async (inv: ArInvoice) => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const jvId = await postJv({
      project_id: PROJECT_ID,
      jv_date: today(),
      description: `รับชำระลูกหนี้ — ${inv.customer_name}`,
      ref_number: inv.invoice_number,
      lines: [
        { account_code: BANK.code, account_name: BANK.name, debit: amt, credit: 0, description: inv.invoice_number },
        { account_code: ACC_AR.code, account_name: ACC_AR.name, debit: 0, credit: amt, description: inv.customer_name },
      ],
    });
    await supabase.from("ar_payments").insert({
      invoice_id: inv.id, payment_date: today(), amount: amt, payment_method: "โอน", jv_id: jvId,
    });
    const newPaid = Number(inv.paid_amount) + amt;
    const newStatus = newPaid >= Number(inv.total_amount) - 0.01 ? "paid" : "partial";
    await supabase.from("ar_invoices").update({ paid_amount: newPaid, status: newStatus }).eq("id", inv.id);
    setSaving(false);
    setPayingId(null);
    setPayAmount("");
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="ลูกหนี้ (AR)" subtitle="ใบแจ้งหนี้และการรับชำระ" />
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-4 py-2 rounded-xl text-sm font-bold">
          <Plus size={14} /> ออกใบแจ้งหนี้
        </button>
      </div>
      <GlassCard className="p-4">
        <p className="text-xs font-semibold text-aviva-gold mb-3">Aging Analysis (ยอดคงค้าง)</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "0–30 วัน", value: aging.a0_30, color: "text-green-400" },
            { label: "31–60 วัน", value: aging.a31_60, color: "text-yellow-400" },
            { label: "61–90 วัน", value: aging.a61_90, color: "text-orange-400" },
            { label: "90+ วัน", value: aging.a90p, color: "text-red-400" },
          ].map(a => (
            <div key={a.label} className="text-center">
              <p className={clsx("text-sm font-bold", a.color)}>฿{fmtM(a.value)}</p>
              <p className="text-[10px] text-aviva-secondary mt-0.5">{a.label}</p>
            </div>
          ))}
        </div>
      </GlassCard>
      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
      ) : invoices.length === 0 ? (
        <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีใบแจ้งหนี้</p></GlassCard>
      ) : invoices.map(inv => (
        <GlassCard key={inv.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs font-mono text-aviva-gold">{inv.invoice_number}</p>
                <StatusBadge status={inv.status} />
                {inv.is_advance && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">เงินดาวน์/ล่วงหน้า</span>}
                {inv.jv_id && <span className="text-[9px] text-green-400">● ลง GL แล้ว</span>}
              </div>
              <p className="text-sm text-aviva-text">{inv.customer_name}</p>
              <p className="text-[11px] text-aviva-secondary mt-0.5">ออก: {inv.invoice_date} · กำหนด: {inv.due_date}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-aviva-gold">฿{fmtM(Number(inv.total_amount))}</p>
              <p className="text-[10px] text-aviva-secondary">ชำระแล้ว ฿{fmtM(Number(inv.paid_amount))}</p>
            </div>
          </div>
          {inv.status !== "paid" && (
            <div className="mt-2 pt-2 border-t border-aviva-gold/10">
              {payingId === inv.id ? (
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" placeholder="ยอดรับชำระ" value={payAmount}
                    onChange={e => setPayAmount(e.target.value)} autoFocus
                    className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text" />
                  <button onClick={() => receivePayment(inv)} disabled={saving || !payAmount}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 disabled:opacity-40 flex items-center gap-1">
                    <Check size={11} /> รับ + ลง GL
                  </button>
                  <button onClick={() => { setPayingId(null); setPayAmount(""); }} className="text-[11px] px-2 py-1.5 rounded-lg bg-gray-500/20 text-gray-400"><X size={11} /></button>
                </div>
              ) : (
                <button onClick={() => { setPayingId(inv.id); setPayAmount(String(Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount)))); }}
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/30 flex items-center gap-1">
                  <Coins size={11} /> รับชำระ
                </button>
              )}
            </div>
          )}
        </GlassCard>
      ))}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
          <div className="bg-aviva-card rounded-3xl w-full max-w-lg">
            <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10">
              <h2 className="font-bold text-aviva-text">ออกใบแจ้งหนี้</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-aviva-secondary" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[11px] text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input type="text" placeholder="ชื่อ-นามสกุล" value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-aviva-secondary mb-1 block">วันที่ออก</label>
                  <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text" />
                </div>
                <div>
                  <label className="text-[11px] text-aviva-secondary mb-1 block">วันครบกำหนด *</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary mb-1 block">ประเภทรายการ</label>
                <div className="flex gap-2">
                  <button onClick={() => setForm(f => ({ ...f, is_advance: false }))}
                    className={clsx("flex-1 py-2 rounded-xl text-xs border font-medium transition-all", !form.is_advance ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg border-aviva-gold/20 text-aviva-secondary")}>ขายปกติ (รายได้)</button>
                  <button onClick={() => setForm(f => ({ ...f, is_advance: true }))}
                    className={clsx("flex-1 py-2 rounded-xl text-xs border font-medium transition-all", form.is_advance ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg border-aviva-gold/20 text-aviva-secondary")}>เงินดาวน์/ล่วงหน้า</button>
                </div>
                <p className="text-[10px] text-aviva-secondary/70 mt-1">{form.is_advance ? "ลงบัญชี: เครดิต เงินรับล่วงหน้าจากลูกค้า (2200)" : "ลงบัญชี: เครดิต รายได้จากการขายบ้าน (4100)"}</p>
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary mb-1 block">ยอดก่อน VAT (บาท) *</label>
                <input type="number" min="0" placeholder="0.00" value={form.base_amount}
                  onChange={e => setForm(f => ({ ...f, base_amount: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
                {form.base_amount && (
                  <p className="text-[10px] text-aviva-secondary mt-1">
                    VAT 7%: ฿{fmt(Math.round(Number(form.base_amount) * TAX_CONFIG.VAT_RATE * 100) / 100)} ·
                    รวม: ฿{fmt(Math.round(Number(form.base_amount) * (1 + TAX_CONFIG.VAT_RATE) * 100) / 100)}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary mb-1 block">รายละเอียด</label>
                <input type="text" placeholder="เช่น ค่างวดโอนกรรมสิทธิ์ แปลง A-01" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
              </div>
              <button onClick={handleSave} disabled={!form.customer_name || !form.base_amount || !form.due_date || saving}
                className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">
                {saving ? "กำลังบันทึก..." : "ออกใบแจ้งหนี้"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function APTab({ accounts }: { accounts: ChartAccount[] }) {
  const [bills, setBills] = useState<ApBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vendor_name: "", vendor_tax_id: "", bill_date: today(), due_date: "",
    base_amount: "", wht_rate: "0", description: "", expense_account: "5200",
  });
  const expenseAccounts = accounts.filter(a => a.account_type === "expense" || a.code === "1180");

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("ap_bills").select("*").eq("project_id", PROJECT_ID).order("bill_date", { ascending: false }).limit(50);
    setBills((data ?? []) as ApBill[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const base = Number(form.base_amount) || 0;
  const vat = Math.round(base * TAX_CONFIG.VAT_RATE * 100) / 100;
  const whtAmt = Math.round(base * Number(form.wht_rate) / 100 * 100) / 100;
  const total = base + vat - whtAmt;

  const handleSave = async () => {
    if (!form.vendor_name || !form.base_amount || !form.due_date) return;
    setSaving(true);
    const d = new Date();
    const billNo = `PV-${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;
    const expAcc = accounts.find(a => a.code === form.expense_account);
    // ตั้งเจ้าหนี้ + ลง GL: Dr ค่าใช้จ่าย/WIP + ภาษีซื้อ / Cr เจ้าหนี้การค้า + ภาษีหัก ณ ที่จ่ายค้างจ่าย
    const lines = [
      { account_code: form.expense_account, account_name: expAcc?.name_th ?? "ค่าใช้จ่าย", debit: base, credit: 0, description: form.vendor_name },
      ...(vat > 0 ? [{ account_code: INPUT_VAT.code, account_name: INPUT_VAT.name, debit: vat, credit: 0, description: "ภาษีซื้อ 7%" }] : []),
      { account_code: ACC_AP.code, account_name: ACC_AP.name, debit: 0, credit: base + vat - whtAmt, description: form.vendor_name },
      ...(whtAmt > 0 ? [{ account_code: WHT_PAYABLE.code, account_name: WHT_PAYABLE.name, debit: 0, credit: whtAmt, description: `WHT ${form.wht_rate}%` }] : []),
    ];
    const jvId = await postJv({ project_id: PROJECT_ID, jv_date: form.bill_date, description: `ตั้งเจ้าหนี้ — ${form.vendor_name}`, ref_number: billNo, lines });
    await supabase.from("ap_bills").insert({
      bill_number: billNo, vendor_name: form.vendor_name, vendor_tax_id: form.vendor_tax_id || null,
      bill_date: form.bill_date, due_date: form.due_date, base_amount: base, vat_amount: vat,
      wht_rate: Number(form.wht_rate), wht_amount: whtAmt, total_amount: total,
      paid_amount: 0, status: "pending", description: form.description || null,
      expense_account: form.expense_account, jv_id: jvId, project_id: PROJECT_ID,
    });
    setSaving(false); setShowModal(false);
    setForm({ vendor_name: "", vendor_tax_id: "", bill_date: today(), due_date: "", base_amount: "", wht_rate: "0", description: "", expense_account: "5200" });
    fetch();
  };

  // จ่ายชำระเจ้าหนี้ + ลง GL (Dr เจ้าหนี้การค้า / Cr เงินฝากธนาคาร)
  const payBill = async (b: ApBill) => {
    const net = Number(b.total_amount) - Number(b.paid_amount);
    if (net <= 0) return;
    setPayingId(b.id);
    const jvId = await postJv({
      project_id: PROJECT_ID, jv_date: today(), description: `จ่ายชำระเจ้าหนี้ — ${b.vendor_name}`, ref_number: b.bill_number,
      lines: [
        { account_code: ACC_AP.code, account_name: ACC_AP.name, debit: net, credit: 0, description: b.vendor_name },
        { account_code: BANK.code, account_name: BANK.name, debit: 0, credit: net, description: b.bill_number },
      ],
    });
    await supabase.from("ap_bills").update({ paid_amount: Number(b.total_amount), status: "paid", pay_jv_id: jvId }).eq("id", b.id);
    setPayingId(null);
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="เจ้าหนี้ (AP)" subtitle="ใบแจ้งหนี้และการจ่ายชำระ" />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-4 py-2 rounded-xl text-sm font-bold">
          <Plus size={14} /> บันทึกใบแจ้งหนี้
        </button>
      </div>
      {loading ? [1,2,3].map(i=><div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse"/>) :
       bills.length===0 ? <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีใบแจ้งหนี้เจ้าหนี้</p></GlassCard> :
       bills.map(b=>(
        <GlassCard key={b.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5"><p className="text-xs font-mono text-aviva-gold">{b.bill_number}</p><StatusBadge status={b.status}/>{b.jv_id&&<span className="text-[9px] text-green-400">● ลง GL แล้ว</span>}</div>
              <p className="text-sm text-aviva-text">{b.vendor_name}</p>
              <p className="text-[11px] text-aviva-secondary mt-0.5">{b.bill_date} · WHT {b.wht_rate}% = ฿{fmt(Number(b.wht_amount))}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-red-400">฿{fmtM(Number(b.total_amount))}</p>
              <p className="text-[10px] text-aviva-secondary">ยอดสุทธิหลัก WHT</p>
            </div>
          </div>
          {b.status !== "paid" && (
            <div className="mt-2 pt-2 border-t border-aviva-gold/10 flex justify-end">
              <button onClick={() => payBill(b)} disabled={payingId === b.id}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/30 flex items-center gap-1 disabled:opacity-40">
                <Coins size={11} /> {payingId === b.id ? "กำลังจ่าย..." : "จ่ายชำระ + ลง GL"}
              </button>
            </div>
          )}
        </GlassCard>
      ))}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
          <div className="bg-aviva-card rounded-3xl w-full max-w-lg">
            <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10">
              <h2 className="font-bold text-aviva-text">บันทึกใบแจ้งหนี้เจ้าหนี้</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-aviva-secondary" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">ชื่อผู้ขาย / ผู้รับจ้าง *</label>
                <input type="text" value={form.vendor_name} onChange={e=>setForm(f=>({...f,vendor_name:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">เลขประจำตัวผู้เสียภาษี (13 หลัก)</label>
                <input type="text" maxLength={13} placeholder="0000000000000" value={form.vendor_tax_id} onChange={e=>setForm(f=>({...f,vendor_tax_id:e.target.value.replace(/\D/g,"")}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">บัญชีค่าใช้จ่าย (ลง GL)</label>
                <select value={form.expense_account} onChange={e=>setForm(f=>({...f,expense_account:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text">
                  {expenseAccounts.map(a=>(<option key={a.code} value={a.code}>{a.code} — {a.name_th}</option>))}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันที่บิล</label>
                  <input type="date" value={form.bill_date} onChange={e=>setForm(f=>({...f,bill_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
                <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันครบกำหนด *</label>
                  <input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
              </div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">ยอดก่อน VAT *</label>
                <input type="number" min="0" placeholder="0.00" value={form.base_amount} onChange={e=>setForm(f=>({...f,base_amount:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">อัตรา WHT (%)</label>
                <div className="flex gap-2 flex-wrap">
                  {TAX_CONFIG.WHT_RATES.map(r=>(
                    <button key={r} onClick={()=>setForm(f=>({...f,wht_rate:String(r)}))} className={clsx("px-3 py-1.5 rounded-lg text-xs border transition-all",form.wht_rate===String(r)?"bg-aviva-gold text-aviva-bg border-aviva-gold":"bg-aviva-bg border-aviva-gold/20 text-aviva-secondary")}>{r}%</button>
                  ))}
                </div>
              </div>
              {form.base_amount&&(
                <div className="p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-aviva-secondary">ยอดก่อน VAT</span><span className="text-aviva-text">฿{fmt(base)}</span></div>
                  <div className="flex justify-between"><span className="text-aviva-secondary">VAT 7%</span><span className="text-aviva-text">฿{fmt(vat)}</span></div>
                  <div className="flex justify-between"><span className="text-aviva-secondary">หัก WHT {form.wht_rate}%</span><span className="text-red-400">-฿{fmt(whtAmt)}</span></div>
                  <div className="flex justify-between font-bold border-t border-aviva-gold/10 pt-1 mt-1"><span className="text-aviva-text">ยอดสุทธิที่จ่าย</span><span className="text-aviva-gold">฿{fmt(total)}</span></div>
                </div>
              )}
              <button onClick={handleSave} disabled={!form.vendor_name||!form.base_amount||!form.due_date||saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving?"กำลังบันทึก...": "บันทึก"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaxTab() {
  const [sub, setSub] = useState<TaxSubTab>("transfer");
  const [vatEntries, setVatEntries] = useState<VatEntry[]>([]);
  const [whtCerts, setWhtCerts] = useState<WhtCert[]>([]);
  const [sbtEntries, setSbtEntries] = useState<SbtEntry[]>([]);
  const [lbtEntries, setLbtEntries] = useState<LbtEntry[]>([]);
  const [showVatModal, setShowVatModal] = useState(false);
  const [showWhtModal, setShowWhtModal] = useState(false);
  const [showSbtModal, setShowSbtModal] = useState(false);
  const [showLbtModal, setShowLbtModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vatForm, setVatForm] = useState({ vat_type: "output", invoice_no: "", invoice_date: today(), party_name: "", party_tax_id: "", base_amount: "" });
  const [whtForm, setWhtForm] = useState({ payee_name: "", payee_tax_id: "", cert_date: today(), base_amount: "", wht_rate: "3", tax_form: "3", income_type: "ค่าบริการ / ค่าจ้าง" });
  const [sbtForm, setSbtForm] = useState({ transfer_date: today(), base_amount: "" });
  const [lbtForm, setLbtForm] = useState({ tax_year: String(new Date().getFullYear() + 543), appraised_value: "", parcel_number: "", due_date: "" });
  // ข้อ 4 — โอนกรรมสิทธิ์: ปันส่วนที่ดิน/สิ่งปลูกสร้าง → ออก VAT + SBT อัตโนมัติ
  const [houses, setHouses] = useState<House[]>([]);
  const [tForm, setTForm] = useState({ house_id: "", house_number: "", transfer_date: today(), total_price: "", land_value: "", appraised_value: "" });
  const [tPosting, setTPosting] = useState(false);
  const [tDone, setTDone] = useState<string | null>(null);
  const period = yymm();

  const totalPrice = Number(tForm.total_price) || 0;
  const landValue = Number(tForm.land_value) || 0;
  const structureValue = Math.max(0, totalPrice - landValue);
  const sbtBase = Number(tForm.appraised_value) || totalPrice;  // ฐาน ภ.ธ./ค่าโอน ใช้ราคาประเมิน (ถ้าไม่กรอกใช้ราคาขาย)
  const tOutputVat = Math.round(structureValue * TAX_CONFIG.VAT_RATE * 100) / 100;
  const tSbt = Math.round(sbtBase * TAX_CONFIG.SBT_RATE * 100) / 100;
  const tTransferFee = Math.round(sbtBase * 0.02 * 100) / 100;  // ค่าธรรมเนียมโอน 2%
  const tWht1 = Math.round(sbtBase * 0.01 * 100) / 100;          // หัก ณ ที่จ่าย 1%

  const saveTransfer = async () => {
    if (!tForm.house_number || totalPrice <= 0) return;
    setTPosting(true);
    const ref = `TF-${period}-${Date.now().toString().slice(-4)}`;
    // 1) ออก output VAT (เฉพาะส่วนสิ่งปลูกสร้าง) เข้าทะเบียนภาษีขาย
    if (tOutputVat > 0) {
      await supabase.from("vat_register").insert({
        vat_type: "output", invoice_no: ref, invoice_date: tForm.transfer_date,
        party_name: tForm.house_number, base_amount: structureValue, vat_amount: tOutputVat,
        total_amount: structureValue + tOutputVat, period: yymm(new Date(tForm.transfer_date)),
        etax_status: "pending", house_id: tForm.house_id || null, project_id: PROJECT_ID,
      });
    }
    // 2) ตัดต้นทุนขาย (COGS) จากต้นทุนก่อสร้างที่จ่ายแล้ว (อยู่ใน WIP 1180)
    let cogs = 0;
    if (tForm.house_id) {
      const { data: ci } = await supabase.from("contractor_installments").select("amount,status").eq("house_id", tForm.house_id);
      cogs = Math.round((ci ?? []).filter(x => x.status === "paid").reduce((s, x) => s + Number(x.amount ?? 0), 0) * 100) / 100;
    }
    // 3) บันทึก ภ.ธ.40 (3.3%)
    const sbtAmt = Math.round(sbtBase * TAX_CONFIG.SBT_BASE_RATE * 100) / 100;
    const localSurtax = Math.round(sbtAmt * TAX_CONFIG.SBT_LOCAL_SURTAX * 100) / 100;
    // 4) ลง GL: Dr ลูกหนี้ (ราคาขาย + VAT) / Cr รายได้ + VAT ขาย · และ Dr ต้นทุนขาย / Cr งานระหว่างก่อสร้าง
    const jvId = await postJv({
      project_id: PROJECT_ID, jv_date: tForm.transfer_date,
      description: `โอนกรรมสิทธิ์ ${tForm.house_number} — รับรู้รายได้ + VAT ขาย + ตัดต้นทุนขาย`,
      ref_number: ref,
      lines: [
        { account_code: ACC_AR.code, account_name: ACC_AR.name, debit: totalPrice + tOutputVat, credit: 0, description: tForm.house_number },
        { account_code: SALES_REVENUE.code, account_name: SALES_REVENUE.name, debit: 0, credit: totalPrice, description: "ที่ดิน+สิ่งปลูกสร้าง" },
        ...(tOutputVat > 0 ? [{ account_code: OUTPUT_VAT.code, account_name: OUTPUT_VAT.name, debit: 0, credit: tOutputVat, description: "VAT 7% สิ่งปลูกสร้าง" }] : []),
        ...(cogs > 0 ? [
          { account_code: COGS.code, account_name: COGS.name, debit: cogs, credit: 0, description: "ตัดต้นทุนขายบ้าน" },
          { account_code: WIP.code, account_name: WIP.name, debit: 0, credit: cogs, description: "ตัดงานระหว่างก่อสร้าง" },
        ] : []),
      ],
    });
    await supabase.from("sbt_register").insert({
      period: yymm(new Date(tForm.transfer_date)), base_amount: sbtBase, sbt_rate: TAX_CONFIG.SBT_BASE_RATE * 100,
      sbt_amount: sbtAmt, local_surtax: localSurtax, total_tax: tSbt, transfer_date: tForm.transfer_date,
      status: "pending", jv_id: jvId, house_id: tForm.house_id || null, project_id: PROJECT_ID,
    });
    // 4b) ลง GL ภาษี/ค่าธรรมเนียมวันโอน (จ่ายที่กรมที่ดิน): Dr ภ.ธ.40 + ค่าโอน + ภาษีถูกหัก(เครดิต CIT) / Cr ธนาคาร
    const feeBank = Math.round((tSbt + tTransferFee + tWht1) * 100) / 100;
    if (feeBank > 0) {
      await postJv({
        project_id: PROJECT_ID, jv_date: tForm.transfer_date,
        description: `ภาษี/ค่าธรรมเนียมวันโอน ${tForm.house_number}`, ref_number: ref,
        lines: [
          { account_code: SBT_EXPENSE.code, account_name: SBT_EXPENSE.name, debit: tSbt, credit: 0, description: "ภ.ธ.40 3.3%" },
          { account_code: TRANSFER_FEE.code, account_name: TRANSFER_FEE.name, debit: tTransferFee, credit: 0, description: "ค่าธรรมเนียมโอน 2%" },
          { account_code: PREPAID_WHT.code, account_name: PREPAID_WHT.name, debit: tWht1, credit: 0, description: "หัก ณ ที่จ่าย 1%" },
          { account_code: BANK.code, account_name: BANK.name, debit: 0, credit: feeBank, description: "จ่ายกรมที่ดิน" },
        ],
      });
    }
    // 5) รับรู้รายได้ใน revenue_recognition (ให้กำไรรายหลังสะท้อนการโอน) — กันซ้ำต่อแปลง
    if (tForm.house_id) {
      const { data: existing } = await supabase.from("revenue_recognition").select("id").eq("house_id", tForm.house_id).limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from("revenue_recognition").insert({
          house_id: tForm.house_id, house_number: tForm.house_number, contract_date: tForm.transfer_date,
          contract_value: totalPrice, transfer_date: tForm.transfer_date, recognized_amount: totalPrice,
          deferred_amount: 0, received_total: 0, status: "recognized", project_id: PROJECT_ID,
        });
      } else {
        await supabase.from("revenue_recognition").update({ recognized_amount: totalPrice, deferred_amount: 0, status: "recognized", transfer_date: tForm.transfer_date }).eq("id", existing[0].id);
      }
    }
    setTPosting(false);
    setTDone(ref);
    setTForm({ house_id: "", house_number: "", transfer_date: today(), total_price: "", land_value: "", appraised_value: "" });
  };

  const loadWht = () => supabase.from("wht_certificates").select("*").eq("project_id", PROJECT_ID).order("cert_date",{ascending:false}).limit(50).then(({data})=>setWhtCerts((data??[]) as WhtCert[]));
  const loadSbt = () => supabase.from("sbt_register").select("*").eq("project_id", PROJECT_ID).order("created_at",{ascending:false}).limit(20).then(({data})=>setSbtEntries((data??[]) as SbtEntry[]));
  const loadLbt = () => supabase.from("land_building_tax").select("*").eq("project_id", PROJECT_ID).order("tax_year",{ascending:false}).limit(10).then(({data})=>setLbtEntries((data??[]) as LbtEntry[]));

  useEffect(() => {
    supabase.from("vat_register").select("*").eq("project_id", PROJECT_ID).order("invoice_date",{ascending:false}).limit(50).then(({data})=>setVatEntries((data??[]) as VatEntry[]));
    supabase.from("houses").select("id,house_number,plot_number,price").eq("project_id", PROJECT_ID).order("plot_number").limit(60).then(({data})=>setHouses((data??[]) as House[]));
    loadWht();
    loadSbt();
    loadLbt();
  }, []);

  const saveVat = async () => {
    if (!vatForm.invoice_no||!vatForm.party_name||!vatForm.base_amount) return;
    setSaving(true);
    const base=Number(vatForm.base_amount); const vat=Math.round(base*TAX_CONFIG.VAT_RATE*100)/100;
    await supabase.from("vat_register").insert({ vat_type:vatForm.vat_type, invoice_no:vatForm.invoice_no, invoice_date:vatForm.invoice_date, party_name:vatForm.party_name, party_tax_id:vatForm.party_tax_id||null, base_amount:base, vat_amount:vat, total_amount:base+vat, period, etax_status:"pending", project_id:PROJECT_ID });
    setSaving(false); setShowVatModal(false);
    setVatForm({vat_type:"output",invoice_no:"",invoice_date:today(),party_name:"",party_tax_id:"",base_amount:""});
    supabase.from("vat_register").select("*").eq("project_id", PROJECT_ID).order("invoice_date",{ascending:false}).limit(50).then(({data})=>setVatEntries((data??[]) as VatEntry[]));
  };

  // C2 — สร้างหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)
  const saveWht = async () => {
    if (!whtForm.payee_name||!whtForm.base_amount) return;
    setSaving(true);
    const base=Number(whtForm.base_amount); const rate=Number(whtForm.wht_rate);
    const whtAmt=Math.round(base*rate/100*100)/100;
    const certNumber=`WHT-${period}-${Date.now().toString().slice(-4)}`;
    await supabase.from("wht_certificates").insert({ cert_number:certNumber, cert_date:whtForm.cert_date, payee_name:whtForm.payee_name, payee_tax_id:whtForm.payee_tax_id||null, income_type:whtForm.income_type, tax_form:whtForm.tax_form, base_amount:base, wht_rate:rate, wht_amount:whtAmt, period, project_id:PROJECT_ID });
    setSaving(false); setShowWhtModal(false);
    setWhtForm({ payee_name:"", payee_tax_id:"", cert_date:today(), base_amount:"", wht_rate:"3", tax_form:"3", income_type:"ค่าบริการ / ค่าจ้าง" });
    loadWht();
  };

  // C1 — สร้างรายการภาษีธุรกิจเฉพาะ (ภ.ธ.40)
  const saveSbt = async () => {
    if (!sbtForm.base_amount) return;
    setSaving(true);
    const base=Number(sbtForm.base_amount);
    const sbtAmt=Math.round(base*TAX_CONFIG.SBT_BASE_RATE*100)/100;
    const localSurtax=Math.round(sbtAmt*TAX_CONFIG.SBT_LOCAL_SURTAX*100)/100;
    const totalTax=Math.round(base*TAX_CONFIG.SBT_RATE*100)/100;
    const sbtPeriod=yymm(new Date(sbtForm.transfer_date));
    await supabase.from("sbt_register").insert({ period:sbtPeriod, base_amount:base, sbt_rate:TAX_CONFIG.SBT_BASE_RATE*100, sbt_amount:sbtAmt, local_surtax:localSurtax, total_tax:totalTax, transfer_date:sbtForm.transfer_date, status:"pending", project_id:PROJECT_ID });
    setSaving(false); setShowSbtModal(false);
    setSbtForm({ transfer_date:today(), base_amount:"" });
    loadSbt();
  };

  // C1 — สร้างรายการภาษีที่ดินและสิ่งปลูกสร้าง
  const saveLbt = async () => {
    if (!lbtForm.tax_year||!lbtForm.appraised_value) return;
    setSaving(true);
    const appraised=Number(lbtForm.appraised_value);
    const taxAmt=Math.round(appraised*TAX_CONFIG.LBT_RATE*100)/100;
    await supabase.from("land_building_tax").insert({ tax_year:Number(lbtForm.tax_year), appraised_value:appraised, tax_rate:TAX_CONFIG.LBT_RATE*100, tax_amount:taxAmt, parcel_number:lbtForm.parcel_number||null, due_date:lbtForm.due_date||null, status:"pending", project_id:PROJECT_ID });
    setSaving(false); setShowLbtModal(false);
    setLbtForm({ tax_year:String(new Date().getFullYear()+543), appraised_value:"", parcel_number:"", due_date:"" });
    loadLbt();
  };

  const subTabs: { key: TaxSubTab; label: string }[] = [{key:"transfer",label:"โอน"},{key:"vat",label:"VAT"},{key:"wht",label:"WHT ภ.ง.ด."},{key:"sbt",label:"ภ.ธ.40"},{key:"lbt",label:"ภาษีที่ดิน"}];

  return (
    <div className="space-y-4">
      <SectionHeader title="ภาษี" subtitle="โอน · VAT · WHT · ภ.ธ.40 · ภาษีที่ดิน" />
      <div className="flex gap-1.5">
        {subTabs.map(t=>(<button key={t.key} onClick={()=>setSub(t.key)} className={clsx("flex-1 py-2 rounded-xl text-[11px] font-medium border transition-all",sub===t.key?"bg-aviva-gold text-aviva-bg border-aviva-gold":"bg-aviva-card text-aviva-secondary border-aviva-gold/10")}>{t.label}</button>))}
      </div>
      {sub==="transfer"&&(<div className="space-y-3">
        <GlassCard className="p-4"><p className="text-xs font-semibold text-aviva-gold mb-1">ภาษีขายตอนโอนกรรมสิทธิ์</p><p className="text-[11px] text-aviva-secondary">ปันส่วนราคา <b>ที่ดิน (ยกเว้น VAT)</b> กับ <b>สิ่งปลูกสร้าง (VAT 7%)</b> → ออก output VAT เข้าทะเบียนภาษีขาย + บันทึก ภ.ธ.40 3.3% และลง GL อัตโนมัติ</p></GlassCard>
        <GlassCard className="p-4 space-y-3">
          <div><label className="text-[11px] text-aviva-secondary mb-1 block">แปลงบ้าน *</label>
            <select value={tForm.house_id} onChange={e=>{ const h=houses.find(h=>h.id===e.target.value); setTForm(f=>({...f,house_id:e.target.value,house_number:h?.house_number??"",total_price:h?.price?String(h.price):f.total_price})); }} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text">
              <option value="">-- เลือกแปลง --</option>{houses.map(h=>(<option key={h.id} value={h.id}>{h.house_number}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันที่โอน</label><input type="date" value={tForm.transfer_date} onChange={e=>setTForm(f=>({...f,transfer_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">ราคาขายรวม *</label><input type="number" min="0" placeholder="0.00" value={tForm.total_price} onChange={e=>setTForm(f=>({...f,total_price:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">มูลค่าที่ดิน (ยกเว้น VAT) *</label><input type="number" min="0" placeholder="0.00" value={tForm.land_value} onChange={e=>setTForm(f=>({...f,land_value:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">ราคาประเมิน (ฐานค่าโอน)</label><input type="number" min="0" placeholder="= ราคาขาย" value={tForm.appraised_value} onChange={e=>setTForm(f=>({...f,appraised_value:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
          </div>
          {totalPrice>0&&(
            <div className="p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-aviva-secondary">มูลค่าสิ่งปลูกสร้าง (ฐาน VAT)</span><span className="text-aviva-text">฿{fmt(structureValue)}</span></div>
              <div className="flex justify-between"><span className="text-aviva-secondary">VAT ขาย 7% → ทะเบียนภาษีขาย</span><span className="text-green-400 font-bold">฿{fmt(tOutputVat)}</span></div>
              <div className="flex justify-between border-t border-aviva-gold/10 pt-1 mt-1"><span className="text-aviva-secondary">ภ.ธ.40 (3.3%)</span><span className="text-aviva-text">฿{fmt(tSbt)}</span></div>
              <div className="flex justify-between"><span className="text-aviva-secondary">ค่าธรรมเนียมโอน (2%)</span><span className="text-aviva-text">฿{fmt(tTransferFee)}</span></div>
              <div className="flex justify-between"><span className="text-aviva-secondary">หัก ณ ที่จ่าย (1%)</span><span className="text-aviva-text">฿{fmt(tWht1)}</span></div>
            </div>
          )}
          <button onClick={saveTransfer} disabled={!tForm.house_number||totalPrice<=0||tPosting} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{tPosting?"กำลังบันทึก...":"บันทึกการโอน + ออก VAT/ภ.ธ.40 + ลง GL"}</button>
          {tDone&&(<div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-[11px] text-green-300 flex items-center gap-2"><Check size={14}/> บันทึกแล้ว ({tDone}) — สร้าง VAT ขาย + ภ.ธ.40 + JV (รับรู้รายได้ + ตัดต้นทุนขาย) + รับรู้รายได้รายหลัง เรียบร้อย ดูได้ในแท็บ VAT / ภ.ธ.40 / สมุดรายวัน</div>)}
        </GlassCard>
      </div>)}
      {sub==="vat"&&(<div className="space-y-3"><div className="flex items-center justify-between"><p className="text-xs text-aviva-secondary">ทะเบียน VAT · Period {period}</p><button onClick={()=>setShowVatModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-3 py-1.5 rounded-xl text-xs font-bold"><Plus size={12}/> เพิ่ม</button></div>
        {vatEntries.length===0?<GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p></GlassCard>:vatEntries.map(v=>(
          <GlassCard key={v.id} className="p-3"><div className="flex items-start justify-between gap-2"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><span className={clsx("text-[10px] px-2 py-0.5 rounded-full",v.vat_type==="output"?"bg-green-500/20 text-green-300":"bg-blue-500/20 text-blue-300")}>{v.vat_type==="output"?"ขาออก":"ขาเข้า"}</span><p className="text-xs font-mono text-aviva-text">{v.invoice_no}</p></div><p className="text-xs text-aviva-secondary">{v.party_name} · {v.invoice_date}</p></div><div className="text-right flex-shrink-0"><p className="text-xs font-bold text-aviva-gold">฿{fmt(Number(v.vat_amount))}</p><p className="text-[10px] text-aviva-secondary">VAT</p></div></div></GlassCard>
        ))}
      </div>)}
      {sub==="wht"&&(<div className="space-y-3">
        <div className="flex items-center justify-between"><p className="text-xs text-aviva-secondary">หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)</p><button onClick={()=>setShowWhtModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-3 py-1.5 rounded-xl text-xs font-bold"><Plus size={12}/> เพิ่ม</button></div>
        {whtCerts.length===0?<GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีหนังสือรับรอง WHT</p></GlassCard>:whtCerts.map(w=>(
          <GlassCard key={w.id} className="p-3"><div className="flex items-start justify-between gap-2"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><p className="text-xs font-mono text-aviva-gold">{w.cert_number}</p><span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">ภ.ง.ด.{w.tax_form}</span></div><p className="text-xs text-aviva-text">{w.payee_name}</p><p className="text-[10px] text-aviva-secondary">{w.cert_date} · {w.wht_rate}%</p></div><div className="text-right flex-shrink-0"><p className="text-xs font-bold text-red-400">-฿{fmt(Number(w.wht_amount))}</p><p className="text-[10px] text-aviva-secondary">หัก ณ ที่จ่าย</p><button onClick={()=>printWht(w)} className="mt-1 text-[10px] bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/30 px-2 py-0.5 rounded">พิมพ์ 50 ทวิ</button></div></div></GlassCard>
        ))}
        <GlassCard className="p-4"><p className="text-xs font-semibold text-aviva-secondary mb-2">อัตรา WHT อ้างอิง</p><div className="grid grid-cols-2 gap-1.5 text-[11px]">{[["ค่าจ้าง (บุคคล)","3% — ภ.ง.ด.3"],["ค่าจ้าง (นิติ)","3% — ภ.ง.ด.53"],["ค่าเช่า","5% — ภ.ง.ด.3/53"],["ค่าโฆษณา","2% — ภ.ง.ด.3/53"],["เงินเดือน","ตามสูตร — ภ.ง.ด.1"],["ดอกเบี้ย","1% — ภ.ง.ด.3/53"]].map(([k,v])=>(<div key={k} className="flex justify-between"><span className="text-aviva-secondary">{k}</span><span className="text-aviva-gold">{v}</span></div>))}</div></GlassCard>
      </div>)}
      {sub==="sbt"&&(<div className="space-y-3"><GlassCard className="p-4"><p className="text-xs font-semibold text-aviva-gold mb-2">ภาษีธุรกิจเฉพาะ (ภ.ธ.40)</p><p className="text-[11px] text-aviva-secondary">อัตรา 3.3% (ภ.ธ.40 3% + ภาษีท้องถิ่น 10% ของ 3%) ต่อยอดขายบ้านทุกรายการโอน</p></GlassCard>
        <div className="flex items-center justify-between"><p className="text-xs text-aviva-secondary">ทะเบียน ภ.ธ.40</p><button onClick={()=>setShowSbtModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-3 py-1.5 rounded-xl text-xs font-bold"><Plus size={12}/> เพิ่ม</button></div>
        {sbtEntries.length===0?<GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ ภ.ธ.40</p></GlassCard>:sbtEntries.map(s=>(<GlassCard key={s.id} className="p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-medium text-aviva-text">Period {s.period}</p><p className="text-[10px] text-aviva-secondary">โอน: {s.transfer_date??"-"} · ฐาน: ฿{fmtM(Number(s.base_amount))}</p></div><div className="text-right"><p className="text-xs font-bold text-aviva-gold">฿{fmt(Number(s.total_tax))}</p><StatusBadge status={s.status}/></div></div></GlassCard>))}
      </div>)}
      {sub==="lbt"&&(<div className="space-y-3"><GlassCard className="p-4"><p className="text-xs font-semibold text-aviva-gold mb-2">ภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ.2562)</p><p className="text-[11px] text-aviva-secondary">อัตราที่ดินเพื่อการขาย 0.3% ต่อปี ของราคาประเมิน</p></GlassCard>
        <div className="flex items-center justify-between"><p className="text-xs text-aviva-secondary">ภาษีที่ดินรายปี</p><button onClick={()=>setShowLbtModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-3 py-1.5 rounded-xl text-xs font-bold"><Plus size={12}/> เพิ่ม</button></div>
        {lbtEntries.length===0?<GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการภาษีที่ดิน</p></GlassCard>:lbtEntries.map(l=>(<GlassCard key={l.id} className="p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-medium text-aviva-text">ปี {l.tax_year}</p><p className="text-[10px] text-aviva-secondary">ประเมิน: ฿{fmtM(Number(l.appraised_value))}</p></div><div className="text-right"><p className="text-xs font-bold text-aviva-gold">฿{fmt(Number(l.tax_amount))}</p><StatusBadge status={l.status}/></div></div></GlassCard>))}
      </div>)}
      {showVatModal&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
          <div className="bg-aviva-card rounded-3xl w-full max-w-lg">
            <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10"><h2 className="font-bold text-aviva-text">เพิ่มรายการ VAT</h2><button onClick={()=>setShowVatModal(false)}><X size={18} className="text-aviva-secondary"/></button></div>
            <div className="p-5 space-y-3">
              <div className="flex gap-2">{[{v:"output",l:"ขาออก (ขาย)"},{v:"input",l:"ขาเข้า (ซื้อ)"}].map(t=>(<button key={t.v} onClick={()=>setVatForm(f=>({...f,vat_type:t.v}))} className={clsx("flex-1 py-2 rounded-xl text-xs border font-medium transition-all",vatForm.vat_type===t.v?"bg-aviva-gold text-aviva-bg border-aviva-gold":"bg-aviva-bg border-aviva-gold/20 text-aviva-secondary")}>{t.l}</button>))}</div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">เลขที่ใบกำกับ *</label><input type="text" placeholder={vatForm.vat_type==="output"?"TINV-2601-001":"VINV-2601-001"} value={vatForm.invoice_no} onChange={e=>setVatForm(f=>({...f,invoice_no:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">ชื่อ บริษัท / บุคคล *</label><input type="text" value={vatForm.party_name} onChange={e=>setVatForm(f=>({...f,party_name:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">เลขประจำตัวผู้เสียภาษี</label><input type="text" maxLength={13} placeholder="0000000000000" value={vatForm.party_tax_id} onChange={e=>setVatForm(f=>({...f,party_tax_id:e.target.value.replace(/\D/g,"")}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">ยอดก่อน VAT *</label><input type="number" min="0" placeholder="0.00" value={vatForm.base_amount} onChange={e=>setVatForm(f=>({...f,base_amount:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/>{vatForm.base_amount&&(<p className="text-[10px] text-aviva-secondary mt-1">VAT 7%: ฿{fmt(Math.round(Number(vatForm.base_amount)*TAX_CONFIG.VAT_RATE*100)/100)}</p>)}</div>
              <button onClick={saveVat} disabled={!vatForm.invoice_no||!vatForm.party_name||!vatForm.base_amount||saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving?"กำลังบันทึก...":"บันทึก VAT"}</button>
            </div>
          </div>
        </div>
      )}
      {showWhtModal&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
          <div className="bg-aviva-card rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-aviva-card px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10"><h2 className="font-bold text-aviva-text">ออกหนังสือรับรอง 50 ทวิ</h2><button onClick={()=>setShowWhtModal(false)}><X size={18} className="text-aviva-secondary"/></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">ชื่อผู้ถูกหักภาษี *</label><input type="text" placeholder="ชื่อ บริษัท / บุคคล" value={whtForm.payee_name} onChange={e=>setWhtForm(f=>({...f,payee_name:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-aviva-secondary mb-1 block">เลขผู้เสียภาษี</label><input type="text" maxLength={13} placeholder="0000000000000" value={whtForm.payee_tax_id} onChange={e=>setWhtForm(f=>({...f,payee_tax_id:e.target.value.replace(/\D/g,"")}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
                <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันที่จ่าย</label><input type="date" value={whtForm.cert_date} onChange={e=>setWhtForm(f=>({...f,cert_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
              </div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">ประเภทเงินได้</label><input type="text" placeholder="เช่น ค่าบริการ / ค่าจ้าง" value={whtForm.income_type} onChange={e=>setWhtForm(f=>({...f,income_type:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">จำนวนเงินที่จ่าย *</label><input type="number" min="0" placeholder="0.00" value={whtForm.base_amount} onChange={e=>setWhtForm(f=>({...f,base_amount:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-aviva-secondary mb-1 block">อัตรา WHT (%)</label><div className="flex gap-1.5 flex-wrap">{TAX_CONFIG.WHT_RATES.filter(r=>r>0).map(r=>(<button key={r} onClick={()=>setWhtForm(f=>({...f,wht_rate:String(r)}))} className={clsx("px-2.5 py-1.5 rounded-lg text-xs border transition-all",whtForm.wht_rate===String(r)?"bg-aviva-gold text-aviva-bg border-aviva-gold":"bg-aviva-bg border-aviva-gold/20 text-aviva-secondary")}>{r}%</button>))}</div></div>
                <div><label className="text-[11px] text-aviva-secondary mb-1 block">แบบ ภ.ง.ด.</label><div className="flex gap-1.5 flex-wrap">{["1","3","53"].map(t=>(<button key={t} onClick={()=>setWhtForm(f=>({...f,tax_form:t}))} className={clsx("px-2.5 py-1.5 rounded-lg text-xs border transition-all",whtForm.tax_form===t?"bg-aviva-gold text-aviva-bg border-aviva-gold":"bg-aviva-bg border-aviva-gold/20 text-aviva-secondary")}>{t}</button>))}</div></div>
              </div>
              {whtForm.base_amount&&(<div className="p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10 text-xs flex justify-between"><span className="text-aviva-secondary">ภาษีหัก ณ ที่จ่าย {whtForm.wht_rate}%</span><span className="text-red-400 font-bold">฿{fmt(Math.round(Number(whtForm.base_amount)*Number(whtForm.wht_rate)/100*100)/100)}</span></div>)}
              <button onClick={saveWht} disabled={!whtForm.payee_name||!whtForm.base_amount||saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving?"กำลังบันทึก...":"ออกหนังสือรับรอง"}</button>
            </div>
          </div>
        </div>
      )}
      {showSbtModal&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
          <div className="bg-aviva-card rounded-3xl w-full max-w-lg">
            <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10"><h2 className="font-bold text-aviva-text">เพิ่มรายการ ภ.ธ.40</h2><button onClick={()=>setShowSbtModal(false)}><X size={18} className="text-aviva-secondary"/></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันที่โอนกรรมสิทธิ์</label><input type="date" value={sbtForm.transfer_date} onChange={e=>setSbtForm(f=>({...f,transfer_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">ฐานภาษี (ราคาขาย/ราคาประเมิน แล้วแต่สูงกว่า) *</label><input type="number" min="0" placeholder="0.00" value={sbtForm.base_amount} onChange={e=>setSbtForm(f=>({...f,base_amount:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              {sbtForm.base_amount&&(<div className="p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-aviva-secondary">ภ.ธ.40 (3%)</span><span className="text-aviva-text">฿{fmt(Math.round(Number(sbtForm.base_amount)*TAX_CONFIG.SBT_BASE_RATE*100)/100)}</span></div>
                <div className="flex justify-between"><span className="text-aviva-secondary">ภาษีท้องถิ่น (10% ของ ภ.ธ.)</span><span className="text-aviva-text">฿{fmt(Math.round(Number(sbtForm.base_amount)*TAX_CONFIG.SBT_BASE_RATE*TAX_CONFIG.SBT_LOCAL_SURTAX*100)/100)}</span></div>
                <div className="flex justify-between font-bold border-t border-aviva-gold/10 pt-1 mt-1"><span className="text-aviva-text">รวม (3.3%)</span><span className="text-aviva-gold">฿{fmt(Math.round(Number(sbtForm.base_amount)*TAX_CONFIG.SBT_RATE*100)/100)}</span></div>
              </div>)}
              <button onClick={saveSbt} disabled={!sbtForm.base_amount||saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving?"กำลังบันทึก...":"บันทึก ภ.ธ.40"}</button>
            </div>
          </div>
        </div>
      )}
      {showLbtModal&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
          <div className="bg-aviva-card rounded-3xl w-full max-w-lg">
            <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10"><h2 className="font-bold text-aviva-text">เพิ่มรายการภาษีที่ดิน</h2><button onClick={()=>setShowLbtModal(false)}><X size={18} className="text-aviva-secondary"/></button></div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-aviva-secondary mb-1 block">ปีภาษี (พ.ศ.) *</label><input type="number" value={lbtForm.tax_year} onChange={e=>setLbtForm(f=>({...f,tax_year:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
                <div><label className="text-[11px] text-aviva-secondary mb-1 block">เลขโฉนด/แปลง</label><input type="text" placeholder="เช่น 12345" value={lbtForm.parcel_number} onChange={e=>setLbtForm(f=>({...f,parcel_number:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              </div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">ราคาประเมิน (บาท) *</label><input type="number" min="0" placeholder="0.00" value={lbtForm.appraised_value} onChange={e=>setLbtForm(f=>({...f,appraised_value:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันครบกำหนดชำระ</label><input type="date" value={lbtForm.due_date} onChange={e=>setLbtForm(f=>({...f,due_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
              {lbtForm.appraised_value&&(<div className="p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10 text-xs flex justify-between"><span className="text-aviva-secondary">ภาษีที่ดิน (0.3%)</span><span className="text-aviva-gold font-bold">฿{fmt(Math.round(Number(lbtForm.appraised_value)*TAX_CONFIG.LBT_RATE*100)/100)}</span></div>)}
              <button onClick={saveLbt} disabled={!lbtForm.tax_year||!lbtForm.appraised_value||saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving?"กำลังบันทึก...":"บันทึกภาษีที่ดิน"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LotCostTab() {
  const [infra, setInfra] = useState<InfraCost[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ cost_type: "", total_cost: "", phase: "Phase 1", description: "" });
  // C-Land — ต้นทุนที่ดินรายแปลง (เข้ากำไรรายหลัง)
  const [landEdits, setLandEdits] = useState<Record<string, string>>({});
  const [savingLand, setSavingLand] = useState(false);

  const loadHouses = useCallback(() => {
    return supabase.from("houses").select("id,house_number,plot_number,house_model,price,land_cost").eq("project_id", PROJECT_ID).order("plot_number").limit(60)
      .then(({ data }) => setHouses((data ?? []) as House[]));
  }, []);

  useEffect(() => {
    Promise.all([
      supabase.from("infrastructure_costs").select("*").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }),
      loadHouses(),
    ]).then(([ic]) => { setInfra((ic.data??[]) as InfraCost[]); setLoading(false); });
  }, [loadHouses]);

  const totalInfra = infra.reduce((s, i) => s + Number(i.total_cost), 0);
  const perLot = houses.length > 0 ? totalInfra / houses.length : 0;
  const totalLand = houses.reduce((s, h) => s + Number(h.land_cost ?? 0), 0);

  const saveLand = async (h: House) => {
    const raw = landEdits[h.id];
    if (raw === undefined) return;
    setSavingLand(true);
    await supabase.from("houses").update({ land_cost: Number(raw) || 0 }).eq("id", h.id);
    setLandEdits(prev => { const c = { ...prev }; delete c[h.id]; return c; });
    await loadHouses();
    setSavingLand(false);
  };

  const saveInfra = async () => {
    if (!form.cost_type || !form.total_cost) return;
    setSaving(true);
    await supabase.from("infrastructure_costs").insert({ cost_type: form.cost_type, total_cost: Number(form.total_cost), phase: form.phase, description: form.description || null, allocation_method: "by_size", is_allocated: false, project_id: PROJECT_ID });
    setSaving(false); setShowModal(false);
    setForm({ cost_type: "", total_cost: "", phase: "Phase 1", description: "" });
    supabase.from("infrastructure_costs").select("*").eq("project_id", PROJECT_ID).order("created_at",{ascending:false}).then(({data})=>setInfra((data??[]) as InfraCost[]));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="ต้นทุนแปลง" subtitle="โครงสร้างพื้นฐาน + ปันส่วน" />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-3 py-2 rounded-xl text-sm font-bold"><Plus size={14} /> เพิ่มต้นทุน</button>
      </div>
      <GlassCard className="p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="text-lg font-bold text-aviva-gold">฿{fmtM(totalInfra)}</p><p className="text-[10px] text-aviva-secondary">ต้นทุนโครงสร้างรวม</p></div>
          <div><p className="text-lg font-bold text-blue-300">{houses.length}</p><p className="text-[10px] text-aviva-secondary">แปลงทั้งหมด</p></div>
          <div><p className="text-lg font-bold text-green-400">฿{fmtM(perLot)}</p><p className="text-[10px] text-aviva-secondary">เฉลี่ยต่อแปลง</p></div>
        </div>
      </GlassCard>

      {/* C-Land — ต้นทุนที่ดินรายแปลง → เข้ากำไรรายหลัง */}
      <SectionHeader title="ต้นทุนที่ดินรายแปลง" subtitle={`รวมเข้ากำไรรายหลังอัตโนมัติ · รวม ฿${fmtM(totalLand)}`} />
      <GlassCard className="p-3">
        {loading ? <p className="text-[11px] text-aviva-secondary/70 text-center py-2">กำลังโหลด…</p> :
         houses.length === 0 ? <p className="text-[11px] text-aviva-secondary/70 text-center py-2">ยังไม่มีข้อมูลแปลง</p> : (
          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-1 text-[9px] text-aviva-secondary/60 px-1 pb-1 border-b border-aviva-gold/10">
              <div className="col-span-4">แปลง</div>
              <div className="col-span-3 text-right">ราคาขาย</div>
              <div className="col-span-5 text-right">ต้นทุนที่ดิน (บาท)</div>
            </div>
            {houses.map(h => {
              const editing = landEdits[h.id] !== undefined;
              const val = editing ? landEdits[h.id] : String(Number(h.land_cost ?? 0) || "");
              return (
                <div key={h.id} className="grid grid-cols-12 gap-1 items-center px-1 py-0.5 text-[11px]">
                  <div className="col-span-4 truncate text-aviva-text">{h.house_number}</div>
                  <div className="col-span-3 text-right text-aviva-secondary">฿{fmtM(Number(h.price ?? 0))}</div>
                  <div className="col-span-5 flex items-center gap-1 justify-end">
                    <input type="number" min="0" placeholder="0" value={val}
                      onChange={e => setLandEdits(prev => ({ ...prev, [h.id]: e.target.value }))}
                      className="w-24 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-[11px] text-right text-aviva-text" />
                    {editing && (
                      <button onClick={() => saveLand(h)} disabled={savingLand}
                        className="text-[10px] px-2 py-1 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 disabled:opacity-40">
                        <Check size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <SectionHeader title="รายการต้นทุนโครงสร้างพื้นฐาน" />
      {loading?[1,2].map(i=><div key={i} className="h-14 rounded-2xl bg-aviva-card/50 animate-pulse"/>):
       infra.length===0?<GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการต้นทุน</p></GlassCard>:
       infra.map(ic=>(
        <GlassCard key={ic.id} className="p-3"><div className="flex items-start justify-between gap-2"><div className="flex-1 min-w-0"><p className="text-sm font-medium text-aviva-text">{ic.cost_type}</p><p className="text-[10px] text-aviva-secondary">{ic.phase??"-"} · {ic.description??""}</p></div><div className="text-right flex-shrink-0"><p className="text-sm font-bold text-aviva-gold">฿{fmtM(Number(ic.total_cost))}</p><span className={clsx("text-[10px] px-2 py-0.5 rounded-full",ic.is_allocated?"bg-green-500/20 text-green-300":"bg-yellow-500/20 text-yellow-300")}>{ic.is_allocated?"ปันส่วนแล้ว":"รอปันส่วน"}</span></div></div></GlassCard>
      ))}
      {showModal&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4"><div className="bg-aviva-card rounded-3xl w-full max-w-lg">
          <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10"><h2 className="font-bold text-aviva-text">เพิ่มต้นทุนโครงสร้างพื้นฐาน</h2><button onClick={()=>setShowModal(false)}><X size={18} className="text-aviva-secondary"/></button></div>
          <div className="p-5 space-y-3">
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">ประเภทต้นทุน *</label><input type="text" placeholder="เช่น ถนนและระบบไฟฟ้า Phase 1" value={form.cost_type} onChange={e=>setForm(f=>({...f,cost_type:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">มูลค่า (บาท) *</label><input type="number" min="0" placeholder="0.00" value={form.total_cost} onChange={e=>setForm(f=>({...f,total_cost:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">Phase</label><select value={form.phase} onChange={e=>setForm(f=>({...f,phase:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"><option>Phase 1</option><option>Phase 2</option><option>รวมทั้งโครงการ</option></select></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">หมายเหตุ</label><input type="text" placeholder="รายละเอียดเพิ่มเติม" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
            <button onClick={saveInfra} disabled={!form.cost_type||!form.total_cost||saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving?"กำลังบันทึก...":"บันทึก"}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

function TFRS15Tab() {
  const [rows, setRows] = useState<RevenueRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [form, setForm] = useState({ house_id: "", house_number: "", contract_date: today(), contract_value: "", transfer_date: "", notes: "" });
  const [recognizingId, setRecognizingId] = useState<string | null>(null);
  const [recognizeDate, setRecognizeDate] = useState(today());

  const fetch = useCallback(async () => {
    setLoading(true);
    const [rr, h] = await Promise.all([
      supabase.from("revenue_recognition").select("*").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }).limit(50),
      supabase.from("houses").select("id,house_number,plot_number,sale_price").eq("project_id", PROJECT_ID).order("plot_number").limit(31),
    ]);
    setRows((rr.data ?? []) as RevenueRec[]); setHouses((h.data ?? []) as House[]); setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const totalContract = rows.reduce((s, r) => s + Number(r.contract_value), 0);
  const totalRecognized = rows.reduce((s, r) => s + Number(r.recognized_amount), 0);
  const totalDeferred = rows.reduce((s, r) => s + Number(r.deferred_amount), 0);

  const recognize = async (id: string, contractValue: number, transferDate: string, houseId?: string) => {
    // ลง GL รับรู้รายได้ + ตัดต้นทุนขาย — กันซ้ำด้วย ref REV-{id} (ถ้าโอนผ่านแท็บภาษีแล้วจะไม่ลงซ้ำ)
    const ref = `REV-${id.slice(0, 8)}`;
    const { data: dup } = await supabase.from("jv_entries").select("id").eq("ref_number", ref).limit(1);
    if (!dup || dup.length === 0) {
      let cogs = 0;
      if (houseId) {
        const { data: ci } = await supabase.from("contractor_installments").select("amount,status").eq("house_id", houseId);
        cogs = Math.round((ci ?? []).filter(x => x.status === "paid").reduce((s, x) => s + Number(x.amount ?? 0), 0) * 100) / 100;
      }
      await postJv({
        project_id: PROJECT_ID, jv_date: transferDate, ref_number: ref,
        description: `รับรู้รายได้ TFRS15 — ${id.slice(0, 8)}`,
        lines: [
          { account_code: ACC_AR.code, account_name: ACC_AR.name, debit: contractValue, credit: 0 },
          { account_code: SALES_REVENUE.code, account_name: SALES_REVENUE.name, debit: 0, credit: contractValue },
          ...(cogs > 0 ? [
            { account_code: COGS.code, account_name: COGS.name, debit: cogs, credit: 0 },
            { account_code: WIP.code, account_name: WIP.name, debit: 0, credit: cogs },
          ] : []),
        ],
      });
    }
    await supabase.from("revenue_recognition").update({ recognized_amount: contractValue, deferred_amount: 0, status: "recognized", transfer_date: transferDate, updated_at: new Date().toISOString() }).eq("id", id);
    setRecognizingId(null);
    fetch();
  };

  const handleSave = async () => {
    if (!form.house_number || !form.contract_value) return;
    setSaving(true);
    const cv = Number(form.contract_value);
    await supabase.from("revenue_recognition").insert({ house_id: form.house_id || null, house_number: form.house_number, contract_date: form.contract_date, contract_value: cv, transfer_date: form.transfer_date || null, recognized_amount: form.transfer_date ? cv : 0, deferred_amount: form.transfer_date ? 0 : cv, received_total: 0, status: form.transfer_date ? "recognized" : "pending", project_id: PROJECT_ID, notes: form.notes || null });
    setSaving(false); setShowModal(false);
    setForm({ house_id: "", house_number: "", contract_date: today(), contract_value: "", transfer_date: "", notes: "" });
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="TFRS 15 — รับรู้รายได้" subtitle="รับรู้เมื่อโอน · ลง JV รายได้+ต้นทุนขาย (ใช้ทางเดียวกับ ภาษี→โอน ต่อแปลง)" />
        <button onClick={()=>setShowModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-3 py-2 rounded-xl text-sm font-bold"><Plus size={14}/> เพิ่ม</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center"><p className="text-base font-bold text-aviva-gold">฿{fmtM(totalContract)}</p><p className="text-[10px] text-aviva-secondary mt-0.5">มูลค่าสัญญา</p></GlassCard>
        <GlassCard className="p-3 text-center"><p className="text-base font-bold text-green-400">฿{fmtM(totalRecognized)}</p><p className="text-[10px] text-aviva-secondary mt-0.5">รับรู้รายได้แล้ว</p></GlassCard>
        <GlassCard className="p-3 text-center"><p className="text-base font-bold text-yellow-400">฿{fmtM(totalDeferred)}</p><p className="text-[10px] text-aviva-secondary mt-0.5">รอรับรู้</p></GlassCard>
      </div>
      {loading?[1,2,3].map(i=><div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse"/>):
       rows.length===0?<GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการรับรู้รายได้</p></GlassCard>:
       rows.map(r=>(
        <GlassCard key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5"><p className="text-sm font-medium text-aviva-text">{r.house_number}</p><StatusBadge status={r.status}/></div>
              <p className="text-[11px] text-aviva-secondary">สัญญา: {r.contract_date??"-"} · โอน: {r.transfer_date??"ยังไม่โอน"}</p>
              <p className="text-[11px] text-aviva-secondary">มูลค่า: ฿{fmtM(Number(r.contract_value))}</p>
            </div>
            {r.status==="pending"&&(recognizingId===r.id?(
              <div className="flex-shrink-0 flex items-center gap-1">
                <input type="date" value={recognizeDate} onChange={e=>setRecognizeDate(e.target.value)} className="bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-xs text-aviva-text w-32"/>
                <button onClick={()=>recognize(r.id,Number(r.contract_value),recognizeDate,r.house_id)} className="text-[11px] px-2 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1"><Check size={11}/> ยืนยัน</button>
                <button onClick={()=>setRecognizingId(null)} className="text-[11px] px-2 py-1.5 rounded-lg bg-gray-500/20 text-gray-400"><X size={11}/></button>
              </div>
            ):(
              <button onClick={()=>{setRecognizingId(r.id);setRecognizeDate(today());}} className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1"><Check size={11}/> รับรู้รายได้</button>
            ))}
          </div>
        </GlassCard>
      ))}
      {showModal&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4"><div className="bg-aviva-card rounded-3xl w-full max-w-lg">
          <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10"><h2 className="font-bold text-aviva-text">เพิ่มรายการรับรู้รายได้</h2><button onClick={()=>setShowModal(false)}><X size={18} className="text-aviva-secondary"/></button></div>
          <div className="p-5 space-y-3">
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">แปลงบ้าน *</label><select value={form.house_id} onChange={e=>{ const h=houses.find(h=>h.id===e.target.value); setForm(f=>({...f,house_id:e.target.value,house_number:h?.house_number??""})); }} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"><option value="">-- เลือกแปลง --</option>{houses.map(h=>(<option key={h.id} value={h.id}>{h.house_number}</option>))}</select></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">มูลค่าตามสัญญา (บาท) *</label><input type="number" min="0" placeholder="0.00" value={form.contract_value} onChange={e=>setForm(f=>({...f,contract_value:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันที่ทำสัญญา</label><input type="date" value={form.contract_date} onChange={e=>setForm(f=>({...f,contract_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันโอนกรรมสิทธิ์</label><input type="date" value={form.transfer_date} onChange={e=>setForm(f=>({...f,transfer_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/><p className="text-[10px] text-aviva-secondary mt-0.5">ถ้าระบุ = รับรู้รายได้ทันที</p></div>
            </div>
            <button onClick={handleSave} disabled={!form.house_number||!form.contract_value||saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving?"กำลังบันทึก...":"บันทึก"}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

function ScannerTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ doc_kind: string; vendor: string; amount: number; date: string; account_code: string; wht_amount: number; confidence: number; } | null>(null);
  const [saved, setSaved] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 10*1024*1024) { alert("ไฟล์ต้องไม่เกิน 10MB"); return; }
    setFile(f); setResult(null); setSaved(false);
    const reader = new FileReader(); reader.onload = ev => setPreview(ev.target?.result as string); reader.readAsDataURL(f);
  };

  const scan = async () => {
    if (!file) return; setScanning(true);
    await new Promise(r => setTimeout(r, 1500));
    setResult({ doc_kind: file.name.toLowerCase().includes("receipt") ? "receipt" : "slip", vendor: "บจก. ตัวอย่างผู้รับเหมา", amount: 150000, date: today(), account_code: "5200", wht_amount: 4500, confidence: 94 });
    setScanning(false);
  };

  const saveResult = async () => {
    if (!result) return;
    await supabase.from("vat_register").insert({ vat_type: "input", invoice_no: `SCAN-${Date.now().toString().slice(-6)}`, invoice_date: result.date, party_name: result.vendor, base_amount: result.amount, vat_amount: Math.round(result.amount*TAX_CONFIG.VAT_RATE*100)/100, total_amount: Math.round(result.amount*(1+TAX_CONFIG.VAT_RATE)*100)/100, period: yymm(), etax_status: "pending", project_id: PROJECT_ID });
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="สแกนใบเสร็จ / สลิป" subtitle="AI วิเคราะห์เอกสารอัตโนมัติ" />
        <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-medium">Demo</span>
      </div>
      <GlassCard className="p-5">
        <label className="flex flex-col items-center gap-3 cursor-pointer">
          <div className="w-16 h-16 rounded-2xl bg-aviva-gold/10 flex items-center justify-center"><Scan size={28} className="text-aviva-gold"/></div>
          <p className="text-sm text-aviva-text font-medium">แตะเพื่ออัปโหลดรูป</p>
          <p className="text-xs text-aviva-secondary">JPG / PNG / PDF · ไม่เกิน 10MB</p>
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} capture="environment" />
        </label>
      </GlassCard>
      {preview&&(<GlassCard className="p-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={preview} alt="preview" className="w-full max-h-48 object-contain rounded-xl"/></GlassCard>)}
      {file&&!result&&(<button onClick={scan} disabled={scanning} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">{scanning?(<><RefreshCw size={16} className="animate-spin"/> AI กำลังวิเคราะห์...</>):(<><Scan size={16}/> วิเคราะห์ด้วย AI</>)}</button>)}
      {result&&(<GlassCard className="p-4 space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-bold text-aviva-gold">ผลการวิเคราะห์</p><span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">ความมั่นใจ {result.confidence}%</span></div><div className="space-y-2 text-sm">{[["ประเภทเอกสาร",result.doc_kind==="receipt"?"ใบเสร็จ":"สลิป"],["ผู้ขาย / ผู้รับเหมา",result.vendor],["จำนวนเงิน",`฿${fmt(result.amount)}`],["วันที่",result.date],["รหัสบัญชี",result.account_code],["WHT หัก ณ ที่จ่าย",`฿${fmt(result.wht_amount)}`]].map(([k,v])=>(<div key={k} className="flex justify-between"><span className="text-aviva-secondary">{k}</span><span className="text-aviva-text font-medium">{v}</span></div>))}</div><button onClick={saveResult} disabled={saved} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">{saved?(<><Check size={16}/> บันทึกแล้ว</>):(<><Download size={16}/> บันทึกเข้าระบบ</>)}</button></GlassCard>)}
      <GlassCard className="p-4"><p className="text-xs font-semibold text-aviva-gold mb-2">วิธีใช้งาน</p><div className="space-y-1.5 text-[11px] text-aviva-secondary"><p>1. กดเลือกรูปจากกล้องหรือแกลเลอรี่</p><p>2. กด "วิเคราะห์ด้วย AI" — ระบบอ่านข้อมูล</p><p>3. ตรวจสอบผลลัพธ์ แล้วกด "บันทึกเข้าระบบ"</p><p>4. ระบบสร้างรายการ VAT ขาเข้าให้อัตโนมัติ</p></div></GlassCard>
    </div>
  );
}

function MatchingTab() {
  const [items, setItems] = useState<{ id: string; payment_date: string; amount: number; payment_method: string; reference_number: string; note: string; match_status?: string; }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ payment_date: today(), amount: "", payment_method: "โอน", reference_number: "", note: "" });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("payments").select("*").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }).limit(30);
    setItems((data ?? []) as typeof items); setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const pending = items.filter(i => !i.match_status || i.match_status === "slip_only").length;
  const matched = items.filter(i => i.match_status === "matched").length;
  const complete = items.filter(i => i.match_status === "complete").length;

  const handleSave = async () => {
    if (!form.amount) return; setSaving(true);
    await supabase.from("payments").insert({ payment_date: form.payment_date, amount: Number(form.amount), payment_method: form.payment_method, reference_number: form.reference_number || null, note: form.note || null, project_id: PROJECT_ID });
    setSaving(false); setShowModal(false);
    setForm({ payment_date: today(), amount: "", payment_method: "โอน", reference_number: "", note: "" });
    fetch();
  };

  const matchStatusLabel: Record<string, string> = { slip_only: "มีสลิป รอใบเสร็จ", matched: "จับคู่แล้ว", complete: "ครบถ้วน" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="จับคู่สลิป + ใบเสร็จ" subtitle="Payment Matching" />
        <button onClick={()=>setShowModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-3 py-2 rounded-xl text-sm font-bold"><Plus size={14}/> บันทึกสลิป</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center"><p className="text-lg font-bold text-yellow-400">{pending}</p><p className="text-[10px] text-aviva-secondary mt-0.5">รอใบเสร็จ</p></GlassCard>
        <GlassCard className="p-3 text-center"><p className="text-lg font-bold text-blue-400">{matched}</p><p className="text-[10px] text-aviva-secondary mt-0.5">จับคู่แล้ว</p></GlassCard>
        <GlassCard className="p-3 text-center"><p className="text-lg font-bold text-green-400">{complete}</p><p className="text-[10px] text-aviva-secondary mt-0.5">ครบถ้วน</p></GlassCard>
      </div>
      {loading?[1,2,3].map(i=><div key={i} className="h-14 rounded-2xl bg-aviva-card/50 animate-pulse"/>):
       items.length===0?<GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p></GlassCard>:
       items.map(it=>(
        <GlassCard key={it.id} className="p-3"><div className="flex items-start justify-between gap-2"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><GitMerge size={12} className="text-aviva-gold flex-shrink-0"/><p className="text-xs text-aviva-text">{it.payment_date} · {it.payment_method}</p>{it.match_status&&(<span className={clsx("text-[10px] px-2 py-0.5 rounded-full",it.match_status==="complete"?"bg-green-500/20 text-green-300":it.match_status==="matched"?"bg-blue-500/20 text-blue-300":"bg-yellow-500/20 text-yellow-300")}>{matchStatusLabel[it.match_status]??it.match_status}</span>)}</div>{it.reference_number&&(<p className="text-[10px] text-aviva-secondary">Ref: {it.reference_number}</p>)}{it.note&&<p className="text-[10px] text-aviva-secondary">{it.note}</p>}</div><p className="text-sm font-bold text-aviva-gold flex-shrink-0">฿{fmtM(Number(it.amount))}</p></div></GlassCard>
      ))}
      {showModal&&(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4"><div className="bg-aviva-card rounded-3xl w-full max-w-lg">
          <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10"><h2 className="font-bold text-aviva-text">บันทึกสลิปการโอน</h2><button onClick={()=>setShowModal(false)}><X size={18} className="text-aviva-secondary"/></button></div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันที่โอน</label><input type="date" value={form.payment_date} onChange={e=>setForm(f=>({...f,payment_date:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text"/></div>
              <div><label className="text-[11px] text-aviva-secondary mb-1 block">จำนวนเงิน *</label><input type="number" min="0" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
            </div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">ช่องทางการโอน</label><div className="flex gap-2 flex-wrap">{["โอน","เช็ค","เงินสด","บัตรเครดิต"].map(m=>(<button key={m} onClick={()=>setForm(f=>({...f,payment_method:m}))} className={clsx("px-3 py-1.5 rounded-lg text-xs border transition-all",form.payment_method===m?"bg-aviva-gold text-aviva-bg border-aviva-gold":"bg-aviva-bg border-aviva-gold/20 text-aviva-secondary")}>{m}</button>))}</div></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">เลขที่อ้างอิง</label><input type="text" placeholder="เลขที่โอน / เลขเช็ค" value={form.reference_number} onChange={e=>setForm(f=>({...f,reference_number:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">หมายเหตุ</label><input type="text" placeholder="รายละเอียดการโอน" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40"/></div>
            <button onClick={handleSave} disabled={!form.amount||saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving?"กำลังบันทึก...":"บันทึกสลิป"}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

// ข้อ 3 — กระทบยอดธนาคาร (Bank Reconciliation)
interface BankStmt { id: string; statement_date: string; description: string; amount: number; is_reconciled: boolean; matched_journal_id?: string; }
function BankRecTab() {
  const [stmts, setStmts] = useState<BankStmt[]>([]);
  const [bookBalance, setBookBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRecon, setSavingRecon] = useState(false);
  const [form, setForm] = useState({ statement_date: today(), description: "", amount: "" });
  const [recon, setRecon] = useState({ bank_name: "", account_no: "", statement_balance: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [st, gl] = await Promise.all([
      supabase.from("bank_statements").select("id,statement_date,description,amount,is_reconciled,matched_journal_id").order("statement_date", { ascending: false }).limit(100),
      supabase.from("jv_lines").select("debit,credit").eq("account_code", BANK.code),
    ]);
    setStmts((st.data ?? []) as BankStmt[]);
    setBookBalance((gl.data ?? []).reduce((s, l) => s + Number(l.debit ?? 0) - Number(l.credit ?? 0), 0));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const unreconciled = stmts.filter(s => !s.is_reconciled);
  const unreconciledTotal = unreconciled.reduce((s, x) => s + Number(x.amount), 0);
  const reconciledTotal = stmts.filter(s => s.is_reconciled).reduce((s, x) => s + Number(x.amount), 0);
  const stmtBalance = Number(recon.statement_balance) || 0;
  const diff = Math.round((stmtBalance - bookBalance) * 100) / 100;

  const addStmt = async () => {
    if (!form.amount) return;
    setSaving(true);
    await supabase.from("bank_statements").insert({
      statement_date: form.statement_date, description: form.description || null,
      amount: Number(form.amount), is_reconciled: false,
    });
    setSaving(false); setShowModal(false);
    setForm({ statement_date: today(), description: "", amount: "" });
    load();
  };

  const toggleReconcile = async (s: BankStmt) => {
    await supabase.from("bank_statements").update({ is_reconciled: !s.is_reconciled }).eq("id", s.id);
    load();
  };

  const saveRecon = async () => {
    if (!recon.bank_name || !recon.statement_balance) return;
    setSavingRecon(true);
    await supabase.from("bank_reconciliation").insert({
      reconcile_date: today(), bank_name: recon.bank_name, account_no: recon.account_no || null,
      statement_balance: stmtBalance, book_balance: bookBalance,
      status: Math.abs(diff) < 0.01 ? "reconciled" : "discrepancy",
      notes: `ผลต่าง ฿${fmt(diff)} · รายการรอกระทบ ${unreconciled.length}`,
    });
    setSavingRecon(false);
    alert(Math.abs(diff) < 0.01 ? "กระทบยอดสมดุล — บันทึกแล้ว" : `บันทึกแล้ว · ยังมีผลต่าง ฿${fmt(diff)}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="กระทบยอดธนาคาร" subtitle="เทียบสมุดบัญชี (GL 1120) กับ Statement จริง" />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg px-3 py-2 rounded-xl text-sm font-bold"><Plus size={14} /> เพิ่มรายการ</button>
      </div>

      <GlassCard gold className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] text-aviva-secondary mb-1 block">ธนาคาร</label>
            <input type="text" placeholder="เช่น KBANK" value={recon.bank_name} onChange={e => setRecon(r => ({ ...r, bank_name: e.target.value }))}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
          </div>
          <div>
            <label className="text-[11px] text-aviva-secondary mb-1 block">ยอดตาม Statement</label>
            <input type="number" placeholder="0.00" value={recon.statement_balance} onChange={e => setRecon(r => ({ ...r, statement_balance: e.target.value }))}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
          </div>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-aviva-secondary">ยอดตามสมุดบัญชี (Book/GL)</span><span className="text-aviva-text font-mono">฿{fmt(bookBalance)}</span></div>
          <div className="flex justify-between"><span className="text-aviva-secondary">ยอดตาม Statement</span><span className="text-aviva-text font-mono">฿{fmt(stmtBalance)}</span></div>
          <div className="flex justify-between"><span className="text-aviva-secondary">รายการรอกระทบ ({unreconciled.length})</span><span className="text-yellow-400 font-mono">฿{fmt(unreconciledTotal)}</span></div>
          <div className="flex justify-between font-bold border-t border-aviva-gold/10 pt-1.5 mt-1">
            <span className="text-aviva-text flex items-center gap-1"><ArrowLeftRight size={12} /> ผลต่าง</span>
            <span className={clsx("font-mono", Math.abs(diff) < 0.01 ? "text-green-400" : "text-red-400")}>฿{fmt(diff)}</span>
          </div>
          {Math.abs(diff) < 0.01 ? <p className="text-[10px] text-green-400">✓ สมดุล — ยอดตรงกัน</p> : <p className="text-[10px] text-red-400">⚠ ยังไม่สมดุล — ตรวจเช็คค้าง/เงินระหว่างทาง/ค่าธรรมเนียม</p>}
        </div>
        <button onClick={saveRecon} disabled={!recon.bank_name || !recon.statement_balance || savingRecon}
          className="w-full mt-3 py-2.5 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">
          {savingRecon ? "กำลังบันทึก..." : "บันทึกผลการกระทบยอด"}
        </button>
      </GlassCard>

      <SectionHeader title="รายการเดินบัญชี (Statement)" subtitle={`กระทบแล้ว ฿${fmtM(reconciledTotal)}`} />
      {loading ? [1, 2, 3].map(i => <div key={i} className="h-14 rounded-2xl bg-aviva-card/50 animate-pulse" />) :
       stmts.length === 0 ? <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการเดินบัญชี</p></GlassCard> :
       stmts.map(s => (
        <GlassCard key={s.id} className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-aviva-text truncate">{s.description || "(ไม่มีคำอธิบาย)"}</p>
              <p className="text-[10px] text-aviva-secondary">{s.statement_date}</p>
            </div>
            <p className={clsx("text-sm font-bold font-mono flex-shrink-0", Number(s.amount) >= 0 ? "text-green-400" : "text-red-400")}>฿{fmt(Number(s.amount))}</p>
            <button onClick={() => toggleReconcile(s)}
              className={clsx("text-[10px] px-2 py-1 rounded-lg border flex-shrink-0 flex items-center gap-1",
                s.is_reconciled ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30")}>
              {s.is_reconciled ? <><Check size={11} /> กระทบแล้ว</> : "รอกระทบ"}
            </button>
          </div>
        </GlassCard>
      ))}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4"><div className="bg-aviva-card rounded-3xl w-full max-w-lg">
          <div className="px-5 py-4 flex items-center justify-between border-b border-aviva-gold/10"><h2 className="font-bold text-aviva-text">เพิ่มรายการเดินบัญชี</h2><button onClick={() => setShowModal(false)}><X size={18} className="text-aviva-secondary" /></button></div>
          <div className="p-5 space-y-3">
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">วันที่</label><input type="date" value={form.statement_date} onChange={e => setForm(f => ({ ...f, statement_date: e.target.value }))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text" /></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">คำอธิบาย</label><input type="text" placeholder="เช่น รับโอนจากลูกค้า / ค่าธรรมเนียม" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" /></div>
            <div><label className="text-[11px] text-aviva-secondary mb-1 block">จำนวนเงิน (+ เงินเข้า / − เงินออก) *</label><input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" /></div>
            <button onClick={addStmt} disabled={!form.amount || saving} className="w-full py-3 rounded-2xl bg-aviva-gold text-aviva-bg font-bold text-sm disabled:opacity-40">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

// งบทดลอง + งบกำไรขาดทุน + งบดุล — ดึงจาก GL จริง (jv_lines ที่ posted)
interface TBRow { code: string; name: string; type: string; debit: number; credit: number; }
function ReportsTab({ accounts }: { accounts: ChartAccount[] }) {
  const [rows, setRows] = useState<TBRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const typeOf = new Map(accounts.map(a => [a.code, a.account_type]));
    const nameOf = new Map(accounts.map(a => [a.code, a.name_th]));
    Promise.all([
      supabase.from("jv_lines").select("jv_id,account_code,account_name,debit,credit"),
      supabase.from("jv_entries").select("id,status").eq("project_id", PROJECT_ID),
    ]).then(([le, en]) => {
      const posted = new Set((en.data ?? []).filter(e => e.status === "posted").map(e => e.id));
      const agg = new Map<string, TBRow>();
      for (const l of (le.data ?? []) as { jv_id: string; account_code: string; account_name: string; debit: number; credit: number }[]) {
        if (!posted.has(l.jv_id)) continue;
        const r = agg.get(l.account_code) ?? { code: l.account_code, name: nameOf.get(l.account_code) ?? l.account_name, type: typeOf.get(l.account_code) ?? "?", debit: 0, credit: 0 };
        r.debit += Number(l.debit ?? 0); r.credit += Number(l.credit ?? 0);
        agg.set(l.account_code, r);
      }
      setRows([...agg.values()].sort((a, b) => a.code.localeCompare(b.code)));
      setLoading(false);
    });
  }, [accounts]);

  const totalDr = rows.reduce((s, r) => s + r.debit, 0);
  const totalCr = rows.reduce((s, r) => s + r.credit, 0);
  const bal = (r: TBRow) => r.debit - r.credit;
  const sumType = (t: string, sign: 1 | -1) => rows.filter(r => r.type === t).reduce((s, r) => s + sign * bal(r), 0);
  const revenue = sumType("revenue", -1);
  const expense = sumType("expense", 1);
  const netProfit = revenue - expense;
  const assets = sumType("asset", 1);
  const liabilities = sumType("liability", -1);
  const equity = sumType("equity", -1);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  const typeLabel: Record<string, string> = { asset: "สินทรัพย์", liability: "หนี้สิน", equity: "ทุน", revenue: "รายได้", expense: "ค่าใช้จ่าย" };

  return (
    <div className="space-y-4">
      <SectionHeader title="งบการเงินจาก GL จริง" subtitle="คำนวณจากสมุดรายวันที่ posted แล้วเท่านั้น" />
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center"><p className="text-base font-bold text-green-400">฿{fmtM(revenue)}</p><p className="text-[10px] text-aviva-secondary mt-0.5">รายได้รวม</p></GlassCard>
        <GlassCard className="p-3 text-center"><p className="text-base font-bold text-red-400">฿{fmtM(expense)}</p><p className="text-[10px] text-aviva-secondary mt-0.5">ค่าใช้จ่ายรวม</p></GlassCard>
        <GlassCard gold className="p-3 text-center"><p className={clsx("text-base font-bold", netProfit >= 0 ? "text-aviva-gold" : "text-red-400")}>฿{fmtM(netProfit)}</p><p className="text-[10px] text-aviva-secondary mt-0.5">กำไร(ขาดทุน)สุทธิ</p></GlassCard>
      </div>
      <GlassCard className="p-4">
        <p className="text-xs font-semibold text-aviva-gold mb-2">สมการบัญชี (งบดุล)</p>
        <div className="text-[11px] space-y-1">
          <div className="flex justify-between"><span className="text-aviva-secondary">สินทรัพย์</span><span className="text-aviva-text font-mono">฿{fmt(assets)}</span></div>
          <div className="flex justify-between"><span className="text-aviva-secondary">หนี้สิน + ทุน + กำไรสะสมงวด</span><span className="text-aviva-text font-mono">฿{fmt(liabilities + equity + netProfit)}</span></div>
          <div className="flex justify-between border-t border-aviva-gold/10 pt-1"><span className="text-aviva-secondary">ผลต่าง</span><span className={clsx("font-mono", Math.abs(assets - (liabilities + equity + netProfit)) < 0.01 ? "text-green-400" : "text-red-400")}>฿{fmt(assets - (liabilities + equity + netProfit))}</span></div>
        </div>
      </GlassCard>
      <SectionHeader title="งบทดลอง (Trial Balance)" subtitle={balanced ? "✓ Dr = Cr สมดุล" : "⚠ ไม่สมดุล"} />
      {loading ? [1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl bg-aviva-card/50 animate-pulse" />) :
       rows.length === 0 ? <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการบัญชีที่ posted</p></GlassCard> : (
        <GlassCard className="p-3">
          <div className="grid grid-cols-12 gap-1 text-[9px] text-aviva-secondary/60 px-1 pb-1 border-b border-aviva-gold/10">
            <div className="col-span-6">บัญชี</div><div className="col-span-3 text-right">เดบิต</div><div className="col-span-3 text-right">เครดิต</div>
          </div>
          {rows.map(r => (
            <div key={r.code} className="grid grid-cols-12 gap-1 text-[10px] items-center px-1 py-0.5">
              <div className="col-span-6 min-w-0 truncate"><span className="font-mono text-aviva-secondary">{r.code}</span> <span className="text-aviva-text">{r.name}</span> <span className="text-[8px] text-aviva-secondary/50">{typeLabel[r.type] ?? r.type}</span></div>
              <div className="col-span-3 text-right text-blue-300 font-mono">{r.debit > 0 ? fmt(r.debit) : "-"}</div>
              <div className="col-span-3 text-right text-purple-300 font-mono">{r.credit > 0 ? fmt(r.credit) : "-"}</div>
            </div>
          ))}
          <div className="grid grid-cols-12 gap-1 text-[10px] font-bold items-center px-1 py-1 mt-1 border-t border-aviva-gold/20">
            <div className="col-span-6 text-aviva-text">รวม</div>
            <div className={clsx("col-span-3 text-right font-mono", balanced ? "text-green-400" : "text-red-400")}>{fmt(totalDr)}</div>
            <div className={clsx("col-span-3 text-right font-mono", balanced ? "text-green-400" : "text-red-400")}>{fmt(totalCr)}</div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

export default function AccountingPage() {
  const [tab, setTab] = useState<AccTab>("dashboard");
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);

  useEffect(() => {
    supabase.from("chart_of_accounts").select("code,name_th,account_type").eq("is_active", true).order("code")
      .then(({ data }) => setAccounts((data ?? []) as ChartAccount[]));
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-30 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Link href="/office" className="text-aviva-gold hover:text-aviva-gold/80 transition-colors"><ArrowLeft size={20}/></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-aviva-text">ฝ่ายบัญชี</h1>
            <p className="text-[11px] text-aviva-secondary">ระบบบัญชีเต็มรูปแบบ — AVIVA Private</p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-aviva-gold/15 text-aviva-gold font-mono">v5.20</span>
        </div>
        <div className="px-4 pb-3 max-w-2xl mx-auto space-y-1.5">
          <div className="grid grid-cols-5 gap-1">
            {TABS.slice(0, 5).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={clsx("flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-xl text-[10px] font-medium border transition-all",
                  tab === t.key ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10 hover:border-aviva-gold/30"
                )}>
                <t.icon size={11}/>
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {TABS.slice(5).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={clsx("flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-xl text-[10px] font-medium border transition-all",
                  tab === t.key ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10 hover:border-aviva-gold/30"
                )}>
                <t.icon size={11}/>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {tab === "dashboard"  && <DashboardTab />}
        {tab === "journal"    && <JournalTab accounts={accounts} />}
        {tab === "ar"         && <ARTab />}
        {tab === "ap"         && <APTab accounts={accounts} />}
        {tab === "tax"        && <TaxTab />}
        {tab === "lot-cost"   && <LotCostTab />}
        {tab === "tfrs15"     && <TFRS15Tab />}
        {tab === "scanner"    && <ScannerTab />}
        {tab === "matching"   && <MatchingTab />}
        {tab === "bankrec"    && <BankRecTab />}
        {tab === "reports"    && <ReportsTab accounts={accounts} />}
      </div>
    </div>
  );
}
