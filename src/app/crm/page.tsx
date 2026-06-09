"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Star, Phone, Plus, X, Pencil, MessageCircle, PhoneCall, TrendingUp, Download, Bot, Send, MapPin, Printer, FileText, Camera, Loader2 } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import AIInsightPanel from "@/components/AIInsightPanel";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import Toast, { type ToastType } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { pipelineStages, type LeadStatus } from "@/lib/mock-data";
import { createNotification, notifyMilestone } from "@/lib/notify";
import { useCurrentUser } from "@/lib/user-context";
import { generateDocNumber } from "@/lib/doc-numbers";
import { calcSlaDueAt } from "@/lib/approval-matrix";
import AttachDocButton from "@/components/AttachDocButton";
import CelebrationModal from "@/components/CelebrationModal";
import { COMPANY } from "@/lib/company-info";
import ReportSubmitModal, { type AutoReportItem } from "@/components/ReportSubmitModal";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const BOOKING_STATUSES: LeadStatus[] = ["Booking", "Loan Process", "Closed Deal"];
// "Transfer" ถูกรวมเป็น "โอนแล้ว" เดียวกับ "Closed Deal" จึงซ่อนออกจากตัวเลือกใน CRM
const crmStages = pipelineStages.filter(s => s !== "Transfer");
const PLOT_COUNT = 31;

function numberToThai(n: number): string {
  if (n === 0) return "ศูนย์บาทถ้วน";
  const u = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const p = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const parts: number[] = [];
  let m = Math.round(n);
  while (m > 0) { parts.push(m % 10); m = Math.floor(m / 10); }
  let s = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i] !== 0) s += u[parts[i]] + p[i];
  }
  return s + "บาทถ้วน";
}

interface Lead {
  id: string;
  lead_code?: string;
  customer_name: string;
  phone: string;
  email?: string | null;
  budget: number;
  status: LeadStatus;
  source: string;
  ai_score: number;
  notes: string;
  created_at?: string | null;
  created_at_default: string;
  assigned_to?: string | null;
  plot_number?: number | null;
  next_follow_up_date?: string | null;
  last_contact_date?: string | null;
  financing_type?: string | null;
  urgency?: string | null;
  delivery_date?: string | null;
  contract_price?: number | null;
  contract_signed_date?: string | null;
  loan_approved_date?: string | null;
  contact_address?: string | null;
  marital_status?: string | null;
  age_range?: string | null;
  occupation?: string | null;
  current_residence?: string | null;
  product_interest?: string | null;
  room_requirement?: string | null;
  visit_reason?: string | null;
  competitor_projects?: string | null;
  budget_range?: string | null;
  monthly_payment_range?: string | null;
  probability?: string | null;
  addr_detail?: string | null;
  addr_province?: string | null;
  addr_amphoe?: string | null;
  addr_tambon?: string | null;
  addr_zipcode?: string | null;
  booking_date?: string | null;
  transfer_date?: string | null;
  booking_by?: string | null;
  transfer_by?: string | null;
}

interface CustomerInstallment {
  id: string;
  lead_id: string;
  installment_no: number;
  name: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: 'pending' | 'paid' | 'overdue';
  notes: string | null;
}

interface HouseSlot {
  plot_number: number;
  status: string;
  house_model: string;
  land_size?: number | null;
}

interface AiMsg { role: "user" | "assistant"; text: string; }

interface CrmLog {
  id: string;
  contact_channel: string;
  call_status: string;
  call_note: string | null;
  created_at: string;
  photo_url: string | null;
}

interface ApprovalLog {
  id: string;
  workflow_type: string;
  source_doc_index: string;
  action_taken: string;
  created_at: string;
  amount: number | null;
}

const sourceColor: Record<string, string> = {
  Facebook: "bg-blue-500/20 text-blue-400",
  TikTok: "bg-pink-500/20 text-pink-400",
  Google: "bg-green-500/20 text-green-400",
  Referral: "bg-purple-500/20 text-purple-400",
};

const SOURCES = ["Facebook", "TikTok", "Google", "Instagram", "LINE OA", "Call in", "Referral", "Walk-in", "อื่นๆ"];
const CALL_STATUSES = ["โทรติด-สนใจ", "โทรติด-ไม่สนใจ", "โทรไม่ติด", "นัดหมายแล้ว", "ส่ง LINE แล้ว"];

function scoreColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function formatBudget(n: number) {
  return `฿${(n / 1_000_000).toFixed(1)}M`;
}

function getChatLink(lead: Lead): string {
  if (lead.source === "TikTok") return `tiktok://user?username=${encodeURIComponent(lead.customer_name)}`;
  if (lead.source === "Instagram") return `instagram://user?username=${encodeURIComponent(lead.customer_name)}`;
  return `https://line.me/R/oaMessage/@`;
}

// จัดรูปแบบเบอร์โทรเป็น xxx-xxx-xxxx (รับเฉพาะตัวเลข สูงสุด 10 หลัก)
function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join("-");
}

// คำนวณ AI Score จากความคืบหน้าใน pipeline + งบ + การมีนัดติดตาม (แทน hardcode เดิม)
const AI_STAGE_SCORE: Record<string, number> = {
  "New Lead": 20, Contacted: 35, "Site Visit": 50, Booking: 75,
  "Loan Process": 88, Transfer: 96, "Closed Deal": 100,
};
function computeAiScore(status: string, budget: number, hasFollowUp: boolean): number {
  let s = AI_STAGE_SCORE[status] ?? 20;
  if (budget >= 5_000_000) s += 4;
  if (hasFollowUp) s += 4;
  return Math.min(100, s);
}

const emptyForm = {
  customer_name: "",
  phone: "",
  email: "",
  budget: "",
  source: "Facebook",
  status: "New Lead" as LeadStatus,
  notes: "",
  plot_number: "",
  next_follow_up_date: "",
  financing_type: "ไม่ระบุ",
  urgency: "ปกติ",
  delivery_date: "",
  contract_price: "",
  contract_signed_date: "",
  loan_approved_date: "",
  contact_address: "",
  marital_status: "",
  age_range: "",
  occupation: "",
  current_residence: "",
  product_interest: "",
  room_requirement: "",
  visit_reason: "",
  competitor_projects: "",
  budget_range: "",
  monthly_payment_range: "",
  probability: "",
  addr_detail: "",
  addr_province: "",
  addr_amphoe: "",
  addr_tambon: "",
  addr_zipcode: "",
};

type GeoData = Record<string, Record<string, Record<string, string>>>;

// Dropdown option sets (จากไฟล์ Excel รายงานการติดตามลูกค้า)
const OPT_MARITAL   = ["โสด", "สมรสไม่มีบุตร", "สมรสมีบุตร"];
const OPT_AGE       = ["ต่ำกว่า 26 ปี", "26-30 ปี", "31-35 ปี", "36-40 ปี", "41-45 ปี", "46-50 ปี", "51 ปีขึ้นไป"];
const OPT_OCCUP     = ["รับราชการ", "พนักงานบริษัทเอกชน", "บุคลากรทางการแพทย์", "เจ้าของธุรกิจ"];
const OPT_RESIDENCE = ["บ้านเดี่ยว", "บ้านแฝด", "ทาวน์เฮาส์", "คอนโด", "อพาร์ตเมนต์/หอพัก"];
const OPT_PRODUCT   = ["บ้านเดี่ยว AVA", "บ้านแฝด VIVA"];
const OPT_ROOM      = ["3 นอน 3 น้ำ 2 จอด", "4 นอน 3 น้ำ 2 จอด", "4 นอน 3 น้ำ 3 จอด", "4 นอน 4 น้ำ 3 จอด"];
const OPT_REASON    = ["ต้องการที่อยู่อาศัยกว้างขึ้น", "ต้องการอยู่อาศัยเป็นของตนเอง", "ต้องการสภาพแวดล้อมที่ดีขึ้น", "ต้องการความสะดวกในการเดินทาง"];
const OPT_BUDGET    = ["ต่ำกว่า 3 ล้านบาท", "3-3.99 ล้านบาท", "4-4.99 ล้านบาท", "5-5.99 ล้านบาท", "6-6.99 ล้านบาท", "7 ล้านบาทขึ้นไป"];
const OPT_PAYMENT   = ["ต่ำกว่า 10,000", "10,001-20,000", "20,001-30,000", "30,001-40,000", "40,001-50,000", "มากกว่า 50,000", "จ่ายสด"];
const OPT_PROB      = ["Low", "Medium", "High"];

// Select ที่มีตัวเลือก "อื่นๆ" → เผยช่องพิมพ์ข้อความเอง (เก็บค่าจริงลง field เดียว)
function SelectWithOther({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const selectVal = value === "" ? "" : (options.includes(value) ? value : "อื่นๆ");
  const inputCls = "w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50";
  return (
    <div>
      <label className="text-xs text-aviva-secondary mb-1 block">{label}</label>
      <select value={selectVal} onChange={e => onChange(e.target.value === "อื่นๆ" ? "อื่นๆ" : e.target.value)} className={inputCls}>
        <option value="">— เลือก —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="อื่นๆ">อื่นๆ (พิมพ์เอง)</option>
      </select>
      {selectVal === "อื่นๆ" && (
        <input type="text" autoFocus value={value === "อื่นๆ" ? "" : value} onChange={e => onChange(e.target.value)}
          placeholder="ระบุข้อมูล..." className={inputCls + " mt-2"} />
      )}
    </div>
  );
}

const emptyCrmLog = { channel: "Phone", callStatus: "", note: "", photo: null as File | null, photoPreview: "" };

type MainTab = "pipeline" | "team" | "map";

export default function CRMPage() {
  const user = useCurrentUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("pipeline");
  const [activeStage, setActiveStage] = useState<LeadStatus>("New Lead");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [leadsLimit, setLeadsLimit] = useState(10000);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formSnapshotRef = useRef("");
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [crmLogLead, setCrmLogLead] = useState<Lead | null>(null);
  const [crmLogForm, setCrmLogForm] = useState(emptyCrmLog);
  const [savingLog, setSavingLog] = useState(false);
  const [kpiModal, setKpiModal] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [aiMsgs, setAiMsgs] = useState<AiMsg[]>([{ role: "assistant", text: "สวัสดีค่ะ ฉัน AVIVA AI ช่วยวิเคราะห์ CRM และแนะนำการขายได้ค่ะ" }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const [houses, setHouses] = useState<HouseSlot[]>([]);
  const [salesActs, setSalesActs] = useState<{ id: string; activity_type: string; note: string | null; activity_date: string; photo_url: string | null; created_by_name: string | null }[]>([]);
  const [showActModal, setShowActModal] = useState(false);
  const [actForm, setActForm] = useState({ activity_type: "รับลูกค้า Walk-in", note: "", activity_date: new Date().toISOString().split("T")[0], photo: null as File | null, photoPreview: "", onBehalfOf: "" });
  const [savingAct, setSavingAct] = useState(false);
  const [uploadingActPhoto, setUploadingActPhoto] = useState(false);
  const [uploadingLogPhoto, setUploadingLogPhoto] = useState(false);
  const [leadLogs, setLeadLogs] = useState<CrmLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [leadApprovals, setLeadApprovals] = useState<ApprovalLog[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [custInsts, setCustInsts] = useState<CustomerInstallment[]>([]);
  const [loadingCustInsts, setLoadingCustInsts] = useState(false);
  const [payRef, setPayRef] = useState<Record<string, { ref: string; date: string }>>({});
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportAutoItems, setReportAutoItems] = useState<AutoReportItem[]>([]);
  const [celebration, setCelebration] = useState<{ event: "booking" | "contract" | "loan" | "transfer"; customerName: string; plotNumber: number | null; amount: number | null; salesPerson?: string | null } | null>(null);
  const [mapPlotModal, setMapPlotModal] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("houses").select("plot_number,status,house_model,land_size")
      .eq("project_id", PROJECT_ID).order("plot_number")
      .then(({ data }) => setHouses((data ?? []) as HouseSlot[]));
    fetchSalesActs();
  }, []);

  useEffect(() => {
    if (!selectedLead) { setLeadLogs([]); setLeadApprovals([]); setCustInsts([]); return; }
    setLoadingLogs(true);
    setLoadingApprovals(true);
    supabase.from("crm_logs")
      .select("id,contact_channel,call_status,call_note,created_at,photo_url")
      .eq("lead_id", selectedLead.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => { setLeadLogs((data ?? []) as CrmLog[]); setLoadingLogs(false); });
    supabase.from("approval_logs")
      .select("id,workflow_type,source_doc_index,action_taken,created_at,amount")
      .eq("source_record_id", selectedLead.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setLeadApprovals((data ?? []) as ApprovalLog[]); setLoadingApprovals(false); });
    // Load customer installments
    setLoadingCustInsts(true);
    supabase.from("customer_installments")
      .select("*")
      .eq("lead_id", selectedLead.id)
      .order("installment_no")
      .then(({ data }) => { setCustInsts((data ?? []) as CustomerInstallment[]); setLoadingCustInsts(false); });
  }, [selectedLead]);

  const fetchSalesActs = () => {
    supabase.from("sales_activities").select("id,activity_type,note,activity_date,photo_url,created_by_name")
      .order("activity_date", { ascending: false }).limit(30)
      .then(({ data }) => setSalesActs((data ?? []) as { id: string; activity_type: string; note: string | null; activity_date: string; photo_url: string | null; created_by_name: string | null }[]));
  };

  const handleAddActivity = async () => {
    if (!actForm.activity_type) return;
    setSavingAct(true);
    let photoUrl: string | null = null;
    if (actForm.photo) {
      setUploadingActPhoto(true);
      const ext = actForm.photo.name.split(".").pop() ?? "jpg";
      const path = `activities/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("activity-photos").upload(path, actForm.photo, { upsert: true });
      if (!error) {
        photoUrl = supabase.storage.from("activity-photos").getPublicUrl(path).data.publicUrl;
      }
      setUploadingActPhoto(false);
    }
    const byName = actForm.onBehalfOf.trim() || user?.full_name || user?.email || null;
    await supabase.from("sales_activities").insert({
      activity_type: actForm.activity_type,
      note: actForm.note || null,
      activity_date: actForm.activity_date,
      photo_url: photoUrl,
      created_by_name: byName,
    });
    await createNotification({
      type: "info",
      title: `กิจกรรมฝ่ายขาย: ${actForm.activity_type}`,
      message: `${byName ?? "ทีมขาย"} · ${new Date(actForm.activity_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}${actForm.note ? ` — ${actForm.note}` : ""}`,
      from_dept: "ฝ่ายขาย",
      to_dept: "ผู้บริหาร",
    });
    if (actForm.photoPreview) URL.revokeObjectURL(actForm.photoPreview);
    setSavingAct(false);
    setShowActModal(false);
    setActForm({ activity_type: "รับลูกค้า Walk-in", note: "", activity_date: new Date().toISOString().split("T")[0], photo: null, photoPreview: "", onBehalfOf: "" });
    fetchSalesActs();
  };

  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMsgs]);

  const sendAiMsg = async () => {
    const msg = aiInput.trim();
    if (!msg || aiLoading) return;
    setAiInput("");
    setAiMsgs(p => [...p, { role: "user", text: msg }]);
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ message: msg }) });
      const data = await res.json();
      setAiMsgs(p => [...p, { role: "assistant", text: data.response ?? "ขออภัย ไม่สามารถตอบได้ค่ะ" }]);
    } catch {
      setAiMsgs(p => [...p, { role: "assistant", text: "ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ" }]);
    }
    setAiLoading(false);
  };

  const printQuote = (lead: Lead) => {
    const dateStr = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
    const plotStr = lead.plot_number ? `แปลงที่ ${lead.plot_number}` : "ยังไม่ระบุแปลง";
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
      <title>ใบเสนอราคา — ${escapeHtml(lead.customer_name)}</title>
      <style>
        body{font-family:'IBM Plex Sans Thai','Noto Sans Thai',Arial,sans-serif;margin:0;padding:40px;color:#222;font-size:14px}
        .header{text-align:center;margin-bottom:24px}
        .logo{font-size:28px;font-weight:bold;letter-spacing:4px;color:#1E4A35}
        .sub{font-size:12px;color:#666;margin-top:4px}
        .title{font-size:18px;font-weight:bold;margin:20px 0 16px;border-bottom:2px solid #D4AF37;padding-bottom:8px;color:#1E4A35}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        td{padding:8px 12px;border:1px solid #eee}
        td:first-child{background:#f9f7f0;font-weight:600;width:35%}
        .total-row td{background:#1E4A35;color:#D4AF37;font-size:16px;font-weight:bold}
        .footer{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
        .sign-block{text-align:center}
        .sign-line{border-top:1px solid #999;margin-top:48px;padding-top:8px;font-size:12px;color:#666}
        .badge{display:inline-block;background:#D4AF37;color:#1E4A35;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;margin-top:4px}
        .btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 18px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}
        @media print{body{padding:20px}.no-print{display:none}.btns{display:none!important}}
      </style></head><body>
      <div class="header">
        <div class="logo">AVIVA Private</div>
        <div class="sub">หมู่บ้านจัดสรร AVIVA Private · ใบเสนอราคา</div>
      </div>
      <div class="title">ใบเสนอราคา</div>
      <table>
        <tr><td>วันที่</td><td>${dateStr}</td></tr>
        <tr><td>รหัสลูกค้า</td><td>${escapeHtml(lead.lead_code ?? "-")}</td></tr>
        <tr><td>ชื่อ-นามสกุล</td><td>${escapeHtml(lead.customer_name)}</td></tr>
        <tr><td>เบอร์โทรศัพท์</td><td>${escapeHtml(lead.phone)}</td></tr>
        <tr><td>แหล่งที่มา</td><td>${escapeHtml(lead.source)}</td></tr>
        <tr><td>สถานะ</td><td><span class="badge">${escapeHtml(lead.status)}</span></td></tr>
      </table>
      <div class="title">รายละเอียดสินค้า</div>
      <table>
        <tr><td>โครงการ</td><td>AVIVA Private</td></tr>
        <tr><td>แปลงที่สนใจ</td><td>${escapeHtml(plotStr)}</td></tr>
        <tr><td>งบประมาณลูกค้า</td><td>฿${Number(lead.budget).toLocaleString()}</td></tr>
        <tr class="total-row"><td>ราคาเสนอขาย</td><td>฿${Number(lead.budget).toLocaleString()}</td></tr>
      </table>
      ${lead.notes ? `<div class="title">หมายเหตุ</div><p style="padding:8px 12px;background:#f9f7f0;border-radius:4px">${escapeHtml(lead.notes)}</p>` : ""}
      <div class="footer">
        <div class="sign-block"><div class="sign-line">ลงชื่อ พนักงานขาย<br>(_________________________)</div></div>
        <div class="sign-block"><div class="sign-line">ลงชื่อ ลูกค้า<br>(_________________________)<br>${escapeHtml(lead.customer_name)}</div></div>
      </div>
      <div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div>
      </body></html>`;
    const w = window.open("", "_blank", "width=800,height=700");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const printBookingLetter = (lead: Lead) => {
    const dateStr = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
    const plotStr = lead.plot_number ? `แปลงที่ ${lead.plot_number}` : "..........";
    const bookingDeposit = Math.round(Number(lead.budget) * 0.01);
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
      <title>ใบจอง — ${escapeHtml(lead.customer_name)}</title>
      <style>
        body{font-family:'IBM Plex Sans Thai','Noto Sans Thai',Arial,sans-serif;margin:0;padding:40px;color:#222;font-size:14px;line-height:1.8}
        .header{text-align:center;margin-bottom:24px}
        .logo{font-size:28px;font-weight:bold;letter-spacing:4px;color:#1E4A35}
        .doc-title{font-size:18px;font-weight:bold;text-align:center;margin:16px 0;color:#1E4A35;border:2px solid #D4AF37;display:inline-block;padding:4px 24px;border-radius:4px}
        .field{display:inline-block;border-bottom:1px solid #333;min-width:150px;text-align:center;padding:0 4px}
        p{margin:8px 0}
        .clause{margin:12px 0;padding-left:20px}
        .sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px}
        .sign-box{text-align:center}
        .sign-line{border-top:1px solid #999;margin-top:48px;padding-top:8px;font-size:12px;color:#666}
        .footer{margin-top:32px;font-size:11px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:8px}
        .highlight{background:#fff9e6;border:1px solid #D4AF37;border-radius:4px;padding:8px 12px;margin:12px 0}
        .btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 18px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}
        @media print{body{padding:20px}.btns{display:none!important}}
      </style></head><body>
      <div class="header">
        <div class="logo">AVIVA Private</div>
        <div style="font-size:12px;color:#666;margin-top:4px">หมู่บ้านจัดสรร AVIVA Private</div>
      </div>
      <div style="text-align:center"><span class="doc-title">ใบจองซื้อบ้าน</span></div>
      <p style="text-align:right">วันที่ <span class="field">${dateStr}</span></p>
      <p>ข้าพเจ้า <span class="field" style="min-width:200px">${escapeHtml(lead.customer_name)}</span></p>
      <p>เบอร์โทรศัพท์ <span class="field">${escapeHtml(lead.phone)}</span></p>
      <p>ขอจองซื้อบ้านหมู่บ้านจัดสรร <strong>AVIVA Private</strong> หมายเลขแปลง <span class="field">${escapeHtml(plotStr)}</span></p>
      <div class="highlight">
        <p><strong>ราคาขาย:</strong> ฿<span class="field" style="min-width:120px">${Number(lead.budget).toLocaleString()}</span> (${numberToThai(Number(lead.budget))})</p>
        <p><strong>เงินจอง:</strong> ฿<span class="field" style="min-width:120px">${bookingDeposit.toLocaleString()}</span> (${numberToThai(bookingDeposit)})</p>
      </div>
      <div class="clause">
        <p><strong>เงื่อนไขการจอง:</strong></p>
        <p>1. เงินจองนี้เป็นส่วนหนึ่งของราคาขายและจะนำไปหักจากราคาบ้าน</p>
        <p>2. หากผู้จองยกเลิก บริษัทขอสงวนสิทธิ์ในการคืนเงินจองตามระเบียบ</p>
        <p>3. บริษัทจะดำเนินการจัดทำสัญญาจะซื้อจะขายภายใน 30 วัน</p>
        <p>4. ผู้จองต้องจัดเตรียมเอกสารสำหรับขอสินเชื่อตามที่บริษัทแจ้ง</p>
      </div>
      <div class="sign">
        <div class="sign-box"><div class="sign-line">ลงชื่อผู้จอง<br>(_________________________)<br>${escapeHtml(lead.customer_name)}</div></div>
        <div class="sign-box"><div class="sign-line">ลงชื่อตัวแทนบริษัท<br>(_________________________)<br>บริษัท อลิสา พร็อพเพอร์ตี้ ดีเวลลอปเม้นท์ จำกัด</div></div>
      </div>
      <div class="footer">${COMPANY.name} · เลขทะเบียน ${COMPANY.tax_id} · โทร ${COMPANY.phone} · ${COMPANY.estate} · ${new Date().toLocaleDateString("th-TH")} · รหัส: ${escapeHtml(lead.lead_code ?? lead.id.slice(0,8))}</div>
      <div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div>
      </body></html>`;
    const w = window.open("", "_blank", "width=800,height=700");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const printContract = (lead: Lead) => {
    const dateStr = lead.contract_signed_date
      ? new Date(lead.contract_signed_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
    const plotStr = lead.plot_number ? `แปลงที่ ${lead.plot_number}` : "..........";
    const price = Number(lead.contract_price ?? lead.budget ?? 0);
    const deposit = Math.round(price * 0.05);
    const remaining = price - deposit;
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
      <title>สัญญาจะซื้อจะขาย — ${escapeHtml(lead.customer_name)}</title>
      <style>
        body{font-family:'IBM Plex Sans Thai','Noto Sans Thai',Arial,sans-serif;margin:0;padding:40px;color:#222;font-size:14px;line-height:2}
        .header{text-align:center;margin-bottom:24px}
        .logo{font-size:26px;font-weight:bold;letter-spacing:4px;color:#1E4A35}
        .doc-title{font-size:16px;font-weight:bold;text-align:center;margin:16px 0;color:#1E4A35;border:2px solid #D4AF37;display:inline-block;padding:4px 24px;border-radius:4px}
        .field{display:inline-block;border-bottom:1px solid #333;min-width:160px;text-align:center;padding:0 4px}
        p{margin:6px 0}
        .clause{margin:10px 0;padding-left:20px}
        .clause-num{font-weight:bold;margin-top:14px}
        .sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:50px}
        .sign-box{text-align:center}
        .sign-line{border-top:1px solid #999;margin-top:56px;padding-top:8px;font-size:12px;color:#666}
        .highlight{background:#fff9e6;border:1px solid #D4AF37;border-radius:4px;padding:10px 14px;margin:14px 0}
        .footer{margin-top:32px;font-size:11px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:8px}
        .btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 18px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}
        @media print{body{padding:20px}.btns{display:none!important}}
      </style></head><body>
      <div class="header">
        <div class="logo">AVIVA Private</div>
        <div style="font-size:12px;color:#666;margin-top:4px">หมู่บ้านจัดสรร AVIVA Private</div>
      </div>
      <div style="text-align:center"><span class="doc-title">สัญญาจะซื้อจะขาย</span></div>
      <p style="text-align:right">ทำ ณ วันที่ <span class="field">${dateStr}</span></p>
      <p>สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>บริษัท อลิสา พร็อพเพอร์ตี้ ดีเวลลอปเม้นท์ จำกัด</strong> เลขทะเบียน ${COMPANY.tax_id} โทร ${COMPANY.phone} ซึ่งต่อไปในสัญญานี้จะเรียกว่า <strong>"ผู้จะขาย"</strong></p>
      <p>กับ <span class="field" style="min-width:200px">${escapeHtml(lead.customer_name)}</span> เบอร์โทรศัพท์ <span class="field">${escapeHtml(lead.phone)}</span> ซึ่งต่อไปในสัญญานี้จะเรียกว่า <strong>"ผู้จะซื้อ"</strong></p>
      <div class="highlight">
        <p><strong>ทรัพย์สินที่ซื้อขาย:</strong> บ้านพร้อมที่ดิน โครงการ AVIVA Private ${escapeHtml(COMPANY.estate)} หมายเลขแปลง <strong>${escapeHtml(plotStr)}</strong></p>
        <p><strong>ราคาซื้อขาย:</strong> ฿${price.toLocaleString()} (${numberToThai(price)})</p>
        <p><strong>เงินมัดจำ (5%):</strong> ฿${deposit.toLocaleString()} ชำระในวันทำสัญญา</p>
        <p><strong>ส่วนที่เหลือ:</strong> ฿${remaining.toLocaleString()} ชำระตามงวดงานก่อสร้างหรือตามที่ตกลง</p>
        ${lead.delivery_date ? `<p><strong>กำหนดส่งมอบ:</strong> ${new Date(lead.delivery_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>` : ""}
        ${lead.financing_type && lead.financing_type !== "ไม่ระบุ" ? `<p><strong>รูปแบบการชำระ:</strong> ${escapeHtml(lead.financing_type)}</p>` : ""}
      </div>
      <div class="clause">
        <p class="clause-num">ข้อ 1. การโอนกรรมสิทธิ์</p>
        <p>ผู้จะขายตกลงจะโอนกรรมสิทธิ์ในทรัพย์สินที่ระบุข้างต้นให้แก่ผู้จะซื้อ เมื่อผู้จะซื้อชำระราคาครบถ้วนแล้ว</p>
        <p class="clause-num">ข้อ 2. การชำระราคา</p>
        <p>ผู้จะซื้อตกลงชำระราคาซื้อขายตามงวดงานก่อสร้าง หรือตามตารางชำระที่บริษัทกำหนด</p>
        <p class="clause-num">ข้อ 3. ความรับผิดชอบของผู้จะขาย</p>
        <p>ผู้จะขายรับประกันว่าทรัพย์สินที่ขายปลอดจากภาระผูกพัน และจะดำเนินการให้ครบถ้วนตามแบบมาตรฐาน</p>
        <p class="clause-num">ข้อ 4. การผิดสัญญา</p>
        <p>หากฝ่ายใดผิดสัญญา ฝ่ายที่เสียหายมีสิทธิ์บอกเลิกสัญญาและเรียกค่าเสียหายได้ตามกฎหมาย</p>
        <p class="clause-num">ข้อ 5. การประกัน</p>
        <p>ผู้จะขายรับประกันงานก่อสร้างเป็นเวลา 1 ปี นับแต่วันที่ส่งมอบ สำหรับโครงสร้าง 5 ปี</p>
      </div>
      <div class="sign">
        <div class="sign-box"><div class="sign-line">ลงชื่อผู้จะซื้อ<br>(_________________________)<br>${escapeHtml(lead.customer_name)}</div></div>
        <div class="sign-box"><div class="sign-line">ลงชื่อผู้จะขาย<br>(_________________________)<br>บริษัท อลิสา พร็อพเพอร์ตี้ ดีเวลลอปเม้นท์ จำกัด</div></div>
      </div>
      <div class="footer">${COMPANY.name} · เลขทะเบียน ${COMPANY.tax_id} · โทร ${COMPANY.phone} · ${COMPANY.estate} · รหัส: ${escapeHtml(lead.lead_code ?? lead.id.slice(0,8))}</div>
      <div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div>
      </body></html>`;
    const w = window.open("", "_blank", "width=800,height=750");
    if (w) { w.document.write(html); w.document.close(); }
  };

  // พิมพ์ใบแจ้งหนี้ลูกค้า (ตามตารางผ่อนชำระงวด)
  const printInvoice = (lead: Lead, insts: CustomerInstallment[]) => {
    const total = insts.reduce((s, i) => s + Number(i.amount), 0);
    const paid = insts.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const remaining = total - paid;
    const baht = (n: number) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rows = insts.map((i, idx) => `<tr><td class="c">${idx + 1}</td><td>${escapeHtml(i.name)}</td><td class="c">${i.due_date ? new Date(i.due_date).toLocaleDateString("th-TH") : "-"}</td><td class="r">${baht(i.amount)}</td><td class="c">${i.status === "paid" ? "ชำระแล้ว" : "ค้างชำระ"}</td></tr>`).join("");
    const docNo = `INV-${(lead.lead_code ?? lead.id.slice(0, 6)).replace(/[^A-Za-z0-9]/g, "")}`;
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบแจ้งหนี้ ${escapeHtml(lead.customer_name)}</title>
    <style>
      body{font-family:'Sarabun','TH Sarabun New',sans-serif;color:#1a1a1a;max-width:780px;margin:24px auto;padding:0 24px;font-size:14px}
      .hd{text-align:center;border-bottom:2px solid #1E4A35;padding-bottom:8px;margin-bottom:6px}
      .hd h1{margin:2px 0;font-size:20px;color:#1E4A35}
      .meta{display:flex;justify-content:space-between;margin:10px 0;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #999;padding:6px 8px;font-size:13px}
      th{background:#f0ece1}
      .r{text-align:right}.c{text-align:center}
      .sum{margin-top:10px;display:flex;justify-content:flex-end}
      .sum table{width:auto}
      .btns{position:fixed;top:10px;right:10px}
      button{padding:8px 14px;margin-left:6px;border:0;border-radius:6px;cursor:pointer}
      .p{background:#1E4A35;color:#fff}.cc{background:#ccc}
      @media print{.btns{display:none}}
    </style></head><body>
    <div class="btns"><button class="p" onclick="window.print()">พิมพ์</button><button class="cc" onclick="window.close()">ปิด</button></div>
    <div class="hd"><h1>ใบแจ้งหนี้ / Invoice</h1><p>${escapeHtml(COMPANY.name)}</p><p style="font-size:12px;color:#555">เลขประจำตัวผู้เสียภาษี ${escapeHtml(COMPANY.tax_id)} · โทร ${escapeHtml(COMPANY.phone)}</p></div>
    <div class="meta"><div><b>ลูกค้า:</b> ${escapeHtml(lead.customer_name)}<br><b>โทร:</b> ${escapeHtml(lead.phone)}${lead.plot_number ? `<br><b>แปลงที่:</b> ${lead.plot_number}` : ""}</div><div class="r"><b>เลขที่:</b> ${docNo}<br><b>วันที่:</b> ${new Date().toLocaleDateString("th-TH")}</div></div>
    <table><thead><tr><th class="c">งวด</th><th>รายการ</th><th class="c">ครบกำหนด</th><th class="r">จำนวนเงิน (บาท)</th><th class="c">สถานะ</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="sum"><table>
      <tr><td>รวมทั้งสิ้น</td><td class="r">${baht(total)}</td></tr>
      <tr><td>ชำระแล้ว</td><td class="r">${baht(paid)}</td></tr>
      <tr><td><b>คงเหลือ</b></td><td class="r"><b>${baht(remaining)}</b></td></tr>
    </table></div>
    <p style="text-align:center;color:#888;font-size:11px;margin-top:28px">ออกโดยระบบ AVIVA ONE · ${new Date().toLocaleDateString("th-TH")}</p>
    </body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const fetchLeads = async (start: string, end: string, limit = 10000) => {
    setLoading(true);
    try {
      let q = supabase.from("leads").select("*").eq("project_id", PROJECT_ID);
      if (start) q = q.gte("created_at_default", start);
      if (end) q = q.lte("created_at_default", end + "T23:59:59");
      const { data } = await q.order("created_at_default", { ascending: false }).limit(limit);
      setLeads((data as Lead[]) ?? []);
    } catch {
      // silently fail, leave existing list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLeadsLimit(10000);
    fetchLeads(dateStart, dateEnd, 10000);
  }, [dateStart, dateEnd]);

  const handlePeriodChange = (p: Period, start: string, end: string) => {
    setPeriod(p);
    setDateStart(start);
    setDateEnd(end);
  };

  const stageCounts = useMemo(() => Object.fromEntries(
    crmStages.map((s) => [s, leads.filter((l) => l.status === s).length])
  ) as Record<LeadStatus, number>, [leads]);

  const filtered = useMemo(() => leads.filter(
    (l) => l.status === activeStage && (search === "" || l.customer_name.includes(search))
  ), [leads, activeStage, search]);

  const teamStats = useMemo(() => {
    const groups = new Map<string, Lead[]>();
    leads.forEach((lead) => {
      const key = lead.assigned_to || lead.source || "ไม่ระบุ";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(lead);
    });
    return Array.from(groups.entries())
      .map(([name, ml]) => ({
        name,
        total: ml.length,
        siteVisit: ml.filter((l) => l.status === "Site Visit").length,
        booking: ml.filter((l) => l.status === "Booking").length,
        closed: ml.filter((l) => l.status === "Closed Deal").length,
        revenue: ml.filter((l) => l.status === "Closed Deal").reduce((s, l) => s + Number(l.budget), 0),
        closeRate: ml.length > 0 ? Math.round((ml.filter((l) => l.status === "Closed Deal").length / ml.length) * 100) : 0,
      }))
      .sort((a, b) => b.closed - a.closed);
  }, [leads]);

  const closedCount = stageCounts["Closed Deal"] ?? 0;
  const closeRate = leads.length > 0 ? Math.round((closedCount / leads.length) * 100) : 0;

  const openEdit = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.status === "Closed Deal" && !(user?.isManager)) {
      setToast({ msg: "ลูกค้าที่โอนแล้ว แก้ไขได้เฉพาะฝ่ายบริหาร", type: "error" });
      return;
    }
    setEditingLead(lead);
    setForm({ customer_name: lead.customer_name, phone: lead.phone, email: lead.email ?? "", budget: String(lead.budget), source: lead.source, status: lead.status, notes: lead.notes ?? "", plot_number: lead.plot_number ? String(lead.plot_number) : "", next_follow_up_date: lead.next_follow_up_date ?? "", financing_type: lead.financing_type ?? "ไม่ระบุ", urgency: lead.urgency ?? "ปกติ", delivery_date: lead.delivery_date ?? "", contract_price: lead.contract_price ? String(lead.contract_price) : "", contract_signed_date: lead.contract_signed_date ?? "", loan_approved_date: lead.loan_approved_date ?? "", contact_address: lead.contact_address ?? "", marital_status: lead.marital_status ?? "", age_range: lead.age_range ?? "", occupation: lead.occupation ?? "", current_residence: lead.current_residence ?? "", product_interest: lead.product_interest ?? "", room_requirement: lead.room_requirement ?? "", visit_reason: lead.visit_reason ?? "", competitor_projects: lead.competitor_projects ?? "", budget_range: lead.budget_range ?? "", monthly_payment_range: lead.monthly_payment_range ?? "", probability: lead.probability ?? "", addr_detail: lead.addr_detail ?? "", addr_province: lead.addr_province ?? "", addr_amphoe: lead.addr_amphoe ?? "", addr_tambon: lead.addr_tambon ?? "", addr_zipcode: lead.addr_zipcode ?? "" });
    setShowModal(true);
  };

  const openCall = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setCrmLogLead(lead);
    setCrmLogForm({ channel: "Phone", callStatus: "", note: "", photo: null, photoPreview: "" });
  };

  const openChat = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    const channel = ["TikTok", "Instagram"].includes(lead.source) ? lead.source : "LINE";
    setCrmLogLead(lead);
    setCrmLogForm({ channel, callStatus: "", note: "", photo: null, photoPreview: "" });
  };

  const saveCrmLog = async () => {
    if (!crmLogLead || !crmLogForm.callStatus) return;
    setSavingLog(true);
    let photoUrl: string | null = null;
    if (crmLogForm.photo) {
      setUploadingLogPhoto(true);
      const ext = crmLogForm.photo.name.split(".").pop() ?? "jpg";
      const path = `logs/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("crm-photos").upload(path, crmLogForm.photo, { upsert: true });
      if (!error) {
        photoUrl = supabase.storage.from("crm-photos").getPublicUrl(path).data.publicUrl;
      }
      setUploadingLogPhoto(false);
    }
    await supabase.from("crm_logs").insert({ lead_id: crmLogLead.id, contact_channel: crmLogForm.channel, call_status: crmLogForm.callStatus, call_note: crmLogForm.note, photo_url: photoUrl });
    await supabase.from("leads").update({ last_contact_date: new Date().toISOString().split("T")[0] }).eq("id", crmLogLead.id);
    await createNotification({
      type: "info",
      title: `ติดต่อลูกค้า: ${crmLogLead.customer_name}`,
      message: `${crmLogForm.channel} · ${crmLogForm.callStatus}${crmLogForm.note ? ` — ${crmLogForm.note}` : ""} โดย ${user?.full_name ?? user?.email ?? "ทีมขาย"}`,
      from_dept: "ฝ่ายขาย",
      to_dept: "ผู้บริหาร",
    });
    if (crmLogForm.photoPreview) URL.revokeObjectURL(crmLogForm.photoPreview);
    setSavingLog(false);
    setCrmLogLead(null);
    setCrmLogForm(emptyCrmLog);
    fetchLeads(dateStart, dateEnd, leadsLimit);
  };

  const openAdd = () => { setEditingLead(null); setForm(emptyForm); setShowModal(true); };

  // จับ snapshot ของฟอร์มตอนเปิด modal เพื่อตรวจว่ามีการแก้ไขที่ยังไม่บันทึกหรือไม่
  useEffect(() => {
    if (showModal) formSnapshotRef.current = JSON.stringify(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  // โหลดชุดข้อมูลที่อยู่ไทย (จังหวัด/อำเภอ/ตำบล/ZIP) ครั้งเดียวเมื่อเปิดฟอร์ม
  useEffect(() => {
    if (showModal && !geo) {
      fetch("/thai-geo.json").then(r => r.json()).then(setGeo).catch(() => {});
    }
  }, [showModal, geo]);

  // Deep-link จากแจ้งเตือน: /crm?lead=<id> → เปิดรายละเอียดลูกค้านั้น
  useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get("lead");
    if (!leadId) return;
    window.history.replaceState(null, "", "/crm");
    supabase.from("leads").select("*").eq("id", leadId).maybeSingle().then(({ data }) => {
      if (data) setSelectedLead(data as Lead);
    });
  }, []);

  // ขอปิดฟอร์ม — ถ้ามีข้อมูลที่ยังไม่บันทึก ให้ถามยืนยันก่อน
  const requestCloseModal = () => {
    if (JSON.stringify(form) !== formSnapshotRef.current) setConfirmDiscard(true);
    else setShowModal(false);
  };

  const DEFAULT_CUST_INST = (price: number) => [
    { installment_no: 1, name: "งวดจอง", amount: Math.round(price * 0.02), due_date: null },
    { installment_no: 2, name: "งวดทำสัญญา", amount: Math.round(price * 0.08), due_date: null },
    { installment_no: 3, name: "งวดระหว่างก่อสร้าง", amount: Math.round(price * 0.10), due_date: null },
    { installment_no: 4, name: "งวดโอนกรรมสิทธิ์", amount: Math.round(price * 0.80), due_date: null },
  ];

  const createDefaultCustInsts = async (lead: Lead) => {
    if (custInsts.length > 0) return;
    const price = lead.contract_price ?? lead.budget ?? 0;
    const rows = DEFAULT_CUST_INST(price).map(r => ({ ...r, lead_id: lead.id, house_id: null, status: 'pending' as const }));
    const { data } = await supabase.from("customer_installments").insert(rows).select();
    setCustInsts((data ?? []) as CustomerInstallment[]);
    setToast({ msg: "สร้างตารางชำระเงินลูกค้าแล้ว", type: "success" });
  };

  const markCustInstPaid = async (inst: CustomerInstallment) => {
    const today = new Date().toISOString().split("T")[0];
    const ref = payRef[inst.id]?.ref ?? "";
    const date = payRef[inst.id]?.date ?? today;
    await supabase.from("customer_installments").update({ status: 'paid', paid_date: today, transfer_ref: ref || null, transfer_date: date || null }).eq("id", inst.id);
    setCustInsts(prev => prev.map(i => i.id === inst.id ? { ...i, status: 'paid', paid_date: today } : i));
    setPayRef(prev => { const next = { ...prev }; delete next[inst.id]; return next; });
    setToast({ msg: `${inst.name} — บันทึกรับเงินแล้ว`, type: "success" });
  };

  const STATUS_TH: Record<string, string> = {
    "New Lead": "ลูกค้าใหม่", Contacted: "ติดต่อแล้ว", "Site Visit": "เข้าชมสถานที่",
    Booking: "จอง", "Loan Process": "ทำสัญญา", Transfer: "โอนแล้ว", "Closed Deal": "โอนแล้ว",
  };

  const handleSave = async () => {
    if (!form.customer_name || !form.phone) return;
    if (editingLead?.status === "Closed Deal" && !(user?.isManager)) {
      setToast({ msg: "ลูกค้าที่โอนแล้ว แก้ไขได้เฉพาะฝ่ายบริหาร", type: "error" });
      return;
    }
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const byName = user?.full_name ?? user?.email ?? "ทีมขาย";
    const plotNum = form.plot_number ? Number(form.plot_number) : null;
    const statusDates: Record<string, unknown> = {};
    if (editingLead && form.status !== editingLead.status) {
      if (form.status === "Booking") { statusDates.booking_date = editingLead.booking_date ?? today; statusDates.booking_by = byName; }
      if (form.status === "Closed Deal") { statusDates.transfer_date = editingLead.transfer_date ?? today; statusDates.transfer_by = byName; }
      if (form.status === "Loan Process") { statusDates.contract_signed_date = editingLead.contract_signed_date ?? today; }
    }
    const addrParts = [form.addr_detail, form.addr_tambon && `ต.${form.addr_tambon}`, form.addr_amphoe && `อ.${form.addr_amphoe}`, form.addr_province && `จ.${form.addr_province}`, form.addr_zipcode].filter(Boolean).join(" ").trim();
    const addrFields = {
      contact_address: addrParts || form.contact_address || null,
      addr_detail: form.addr_detail || null,
      addr_province: form.addr_province || null,
      addr_amphoe: form.addr_amphoe || null,
      addr_tambon: form.addr_tambon || null,
      addr_zipcode: form.addr_zipcode || null,
    };
    if (editingLead) {
      const prevLoanDate = editingLead.loan_approved_date;
      const { error: updateErr } = await supabase.from("leads").update({ customer_name: form.customer_name, phone: form.phone, email: form.email || null, budget: Number(form.budget) || 0, source: form.source, status: form.status, ai_score: computeAiScore(form.status, Number(form.budget) || 0, !!form.next_follow_up_date), notes: form.notes, plot_number: plotNum, next_follow_up_date: form.next_follow_up_date || null, financing_type: form.financing_type || null, urgency: form.urgency || null, delivery_date: form.delivery_date || null, contract_price: form.contract_price ? Number(form.contract_price) : null, contract_signed_date: form.contract_signed_date || null, loan_approved_date: form.loan_approved_date || null, ...addrFields, marital_status: form.marital_status || null, age_range: form.age_range || null, occupation: form.occupation || null, current_residence: form.current_residence || null, product_interest: form.product_interest || null, room_requirement: form.room_requirement || null, visit_reason: form.visit_reason || null, competitor_projects: form.competitor_projects || null, budget_range: form.budget_range || null, monthly_payment_range: form.monthly_payment_range || null, probability: form.probability || null, ...statusDates, updated_at: new Date().toISOString() }).eq("id", editingLead.id);
      if (updateErr) { setSaving(false); setToast({ msg: "บันทึกไม่สำเร็จ: " + updateErr.message, type: "error" }); return; }
      if (form.status !== editingLead.status) {
        const effectivePlot = plotNum ?? editingLead.plot_number;
        if (effectivePlot) {
          if (form.status === "Booking") {
            const { data: existingBook } = await supabase.from("leads").select("id,customer_name").eq("project_id", PROJECT_ID).eq("plot_number", effectivePlot).in("status", ["Booking", "Loan Process", "Closed Deal"]).neq("id", editingLead.id).maybeSingle();
            if (existingBook) { setSaving(false); setToast({ msg: `แปลง ${effectivePlot} ถูกจองโดย ${existingBook.customer_name} แล้ว ไม่สามารถจองซ้ำได้`, type: "error" }); return; }
            await supabase.from("houses").update({ status: "reserved" }).eq("project_id", PROJECT_ID).eq("plot_number", effectivePlot);
            setCelebration({ event: "booking", customerName: form.customer_name, plotNumber: effectivePlot, amount: Number(form.budget) || null, salesPerson: byName });
            const docNum = await generateDocNumber("BOOK");
            await supabase.from("approval_logs").insert({
              workflow_type: "Booking_Deposit",
              source_doc_index: `${docNum} | จองแปลง ${effectivePlot} — ${form.customer_name} | โดย ${user?.full_name ?? user?.email ?? "Unknown"}`,
              source_record_id: editingLead.id,
              current_approver_role: "manager",
              action_taken: "Pending",
              amount: form.budget ? Number(form.budget) : null,
              sla_due_at: calcSlaDueAt("Booking_Deposit"),
              assigned_to_name: "ผู้จัดการ",
            });
          } else if (editingLead.status === "Booking" && !["Booking", "Loan Process"].includes(form.status)) {
            await supabase.from("houses").update({ status: "available" }).eq("project_id", PROJECT_ID).eq("plot_number", effectivePlot);
          }
        }
        const amt = form.contract_price ? Number(form.contract_price) : (Number(form.budget) || null);
        const cInfo = [plotNum ? `แปลง ${plotNum}` : "", amt ? `฿${Number(amt).toLocaleString("th-TH")}` : "", `โดย ${byName}`].filter(Boolean).join(" · ");
        const mTitle: Record<string, string> = {
          Booking: `🎉 จองสำเร็จ! — ${form.customer_name}`,
          "Loan Process": `📝 ทำสัญญาสำเร็จ! — ${form.customer_name}`,
          "Closed Deal": `🏆 โอนกรรมสิทธิ์สำเร็จ! — ${form.customer_name}`,
        };
        if (mTitle[form.status]) {
          await notifyMilestone({ title: mTitle[form.status], message: cInfo, record_id: editingLead.id });
        } else {
          await createNotification({ type: "info", title: `${form.customer_name} — ${STATUS_TH[form.status] ?? form.status}`, message: `เปลี่ยนสถานะจาก "${STATUS_TH[editingLead.status] ?? editingLead.status}" โดย ${byName}`, from_dept: "ฝ่ายขาย", to_dept: "ฝ่ายขาย", record_id: editingLead.id });
        }
        if (form.status === "Loan Process") {
          setCelebration({ event: "contract", customerName: form.customer_name, plotNumber: plotNum, amount: Number(form.budget) || null, salesPerson: byName });
        }
        if (form.status === "Closed Deal") {
          setCelebration({ event: "transfer", customerName: form.customer_name, plotNumber: plotNum, amount: Number(form.contract_price) || Number(form.budget) || null, salesPerson: byName });
        }
      }
      // Notify + celebrate when loan is newly approved
      if (form.loan_approved_date && !prevLoanDate) {
        await notifyMilestone({
          title: `🏦 อนุมัติสินเชื่อแล้ว! — ${form.customer_name}`,
          message: [plotNum ? `แปลง ${plotNum}` : "", `อนุมัติ ${new Date(form.loan_approved_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`, `โดย ${byName}`].filter(Boolean).join(" · "),
          record_id: editingLead.id,
        });
        setCelebration({ event: "loan", customerName: form.customer_name, plotNumber: plotNum, amount: Number(form.contract_price) || Number(form.budget) || null, salesPerson: byName });
        setToast({ msg: `🏦 บันทึกวันกู้ผ่านแล้ว — ${form.customer_name}`, type: "success" });
      }
    } else {
      const { error: insertErr } = await supabase.from("leads").insert({ customer_name: form.customer_name, phone: form.phone, email: form.email || null, budget: Number(form.budget) || 0, source: form.source, status: form.status, notes: form.notes, plot_number: plotNum, project_id: PROJECT_ID, ai_score: computeAiScore(form.status, Number(form.budget) || 0, !!form.next_follow_up_date), next_follow_up_date: form.next_follow_up_date || null, financing_type: form.financing_type || null, urgency: form.urgency || null, delivery_date: form.delivery_date || null, contract_price: form.contract_price ? Number(form.contract_price) : null, contract_signed_date: form.contract_signed_date || null, loan_approved_date: form.loan_approved_date || null, ...addrFields, marital_status: form.marital_status || null, age_range: form.age_range || null, occupation: form.occupation || null, current_residence: form.current_residence || null, product_interest: form.product_interest || null, room_requirement: form.room_requirement || null, visit_reason: form.visit_reason || null, competitor_projects: form.competitor_projects || null, budget_range: form.budget_range || null, monthly_payment_range: form.monthly_payment_range || null, probability: form.probability || null });
      if (insertErr) { setSaving(false); setToast({ msg: "บันทึกไม่สำเร็จ: " + insertErr.message, type: "error" }); return; }
      await createNotification({
        type: "info",
        title: `ลูกค้าใหม่ — ${form.customer_name}`,
        message: `${form.source} · งบ ฿${Number(form.budget || 0).toLocaleString()}`,
        from_dept: "ฝ่ายขาย",
        to_dept: "ฝ่ายขาย",
      });
    }
    setSaving(false);
    setShowModal(false);
    setEditingLead(null);
    setForm(emptyForm);
    fetchLeads(dateStart, dateEnd, leadsLimit);
  };

  const handleUpdateStatus = async (lead: Lead, newStatus: LeadStatus) => {
    if (lead.status === "Closed Deal" && !(user?.isManager)) {
      setToast({ msg: "ลูกค้าที่โอนแล้ว แก้ไข/เปลี่ยนสถานะได้เฉพาะฝ่ายบริหาร", type: "error" });
      return;
    }
    if (lead.plot_number && newStatus === "Booking") {
      const { data: existingBook } = await supabase.from("leads").select("id,customer_name").eq("project_id", PROJECT_ID).eq("plot_number", lead.plot_number).in("status", ["Booking", "Loan Process", "Closed Deal"]).neq("id", lead.id).maybeSingle();
      if (existingBook) { setToast({ msg: `แปลง ${lead.plot_number} ถูกจองโดย ${existingBook.customer_name} แล้ว`, type: "error" }); return; }
    }
    const today = new Date().toISOString().split("T")[0];
    const byName = user?.full_name ?? user?.email ?? "ทีมขาย";
    const upd: Record<string, unknown> = { status: newStatus, ai_score: computeAiScore(newStatus, lead.budget ?? 0, !!lead.next_follow_up_date), updated_at: new Date().toISOString() };
    if (newStatus === "Booking" && lead.status !== "Booking") { upd.booking_date = lead.booking_date ?? today; upd.booking_by = byName; }
    if (newStatus === "Closed Deal" && lead.status !== "Closed Deal") { upd.transfer_date = lead.transfer_date ?? today; upd.transfer_by = byName; }
    if (newStatus === "Loan Process" && lead.status !== "Loan Process") { upd.contract_signed_date = lead.contract_signed_date ?? today; }
    await supabase.from("leads").update(upd).eq("id", lead.id);
    if (lead.plot_number) {
      if (newStatus === "Booking") {
        await supabase.from("houses").update({ status: "reserved" }).eq("project_id", PROJECT_ID).eq("plot_number", lead.plot_number);
      } else if (BOOKING_STATUSES.includes(lead.status as LeadStatus) && !BOOKING_STATUSES.includes(newStatus)) {
        await supabase.from("houses").update({ status: "available" }).eq("project_id", PROJECT_ID).eq("plot_number", lead.plot_number);
      }
    }
    if (newStatus !== lead.status) {
      const amount = lead.contract_price ?? lead.budget ?? null;
      const info = [lead.plot_number ? `แปลง ${lead.plot_number}` : "", amount ? `฿${Number(amount).toLocaleString("th-TH")}` : "", `โดย ${byName}`].filter(Boolean).join(" · ");
      const mTitle: Record<string, string> = {
        Booking: `🎉 จองสำเร็จ! — ${lead.customer_name}`,
        "Loan Process": `📝 ทำสัญญาสำเร็จ! — ${lead.customer_name}`,
        "Closed Deal": `🏆 โอนกรรมสิทธิ์สำเร็จ! — ${lead.customer_name}`,
      };
      if (mTitle[newStatus]) {
        await notifyMilestone({ title: mTitle[newStatus], message: info, record_id: lead.id });
      } else {
        await createNotification({
          type: "info",
          title: `${lead.customer_name} — ${STATUS_TH[newStatus] ?? newStatus}`,
          message: `เปลี่ยนสถานะจาก "${STATUS_TH[lead.status] ?? lead.status}" โดย ${byName}`,
          from_dept: "ฝ่ายขาย",
          to_dept: "ฝ่ายขาย",
          record_id: lead.id,
        });
      }
      if (newStatus === "Booking") {
        setCelebration({ event: "booking", customerName: lead.customer_name, plotNumber: lead.plot_number ?? null, amount: lead.budget ?? null, salesPerson: byName });
      }
      if (newStatus === "Loan Process") {
        setCelebration({ event: "contract", customerName: lead.customer_name, plotNumber: lead.plot_number ?? null, amount: lead.budget ?? null, salesPerson: byName });
      }
      if (newStatus === "Closed Deal") {
        setCelebration({ event: "transfer", customerName: lead.customer_name, plotNumber: lead.plot_number ?? null, amount: lead.contract_price ?? lead.budget ?? null, salesPerson: byName });
        const docNum = await generateDocNumber("CONTRACT");
        await supabase.from("approval_logs").insert({
          workflow_type: "Contract_Approval",
          source_doc_index: `${docNum} | ${lead.customer_name}${lead.plot_number ? ` แปลง ${lead.plot_number}` : ""} | โดย ${user?.full_name ?? user?.email ?? "Unknown"}`,
          source_record_id: lead.id,
          current_approver_role: "manager",
          action_taken: "Pending",
          amount: lead.budget ?? null,
          sla_due_at: calcSlaDueAt("Contract_Approval"),
          assigned_to_name: "ผู้จัดการ",
        });
      }
    }
    setSelectedLead(null);
    fetchLeads(dateStart, dateEnd, leadsLimit);
  };

  const exportCSV = () => {
    const headers = ["ชื่อลูกค้า", "เบอร์โทร", "งบประมาณ", "แหล่งที่มา", "สถานะ", "AI Score", "หมายเหตุ"];
    const rows = leads.map((l) =>
      [l.customer_name, l.phone, l.budget, l.source, l.status, l.ai_score ?? "", (l.notes ?? "").replace(/,/g, " ")].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-leads-${dateStart}-${dateEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">CRM · ฝ่ายขาย</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${leads.length} ราย · ปิดการขาย ${closeRate}%`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAI(a => !a)} className={clsx("flex items-center gap-1.5 border text-xs font-bold px-3 py-2 rounded-xl transition-all", showAI ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card border-aviva-gold/20 text-aviva-secondary")}>
                <Bot size={13} /> AI
              </button>
              <button onClick={exportCSV} className="flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-xs font-bold px-3 py-2 rounded-xl">
                <Download size={13} /> CSV
              </button>
              <button onClick={openAdd} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
                <Plus size={14} /> เพิ่ม Lead
              </button>
            </div>
          </div>
          <PeriodFilter period={period} onChange={handlePeriodChange} />
        </div>
      </div>

      {showAI && (
        <div className="max-w-lg mx-auto px-4 py-3 border-t border-aviva-gold/10 bg-aviva-bg/80">
          <div className="bg-aviva-card rounded-2xl border border-aviva-gold/20 overflow-hidden">
            <div className="px-3 py-2 border-b border-aviva-gold/10 flex items-center gap-2">
              <Bot size={12} className="text-aviva-gold" />
              <span className="text-xs font-semibold text-aviva-gold">AVIVA AI — ฝ่ายขาย</span>
            </div>
            <div className="h-44 overflow-y-auto p-3 space-y-2">
              {aiMsgs.map((m, i) => (
                <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={clsx("max-w-[85%] rounded-xl px-3 py-1.5 text-xs", m.role === "user" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-bg text-aviva-text border border-aviva-gold/10")}>
                    {m.text}
                  </div>
                </div>
              ))}
              {aiLoading && <div className="flex justify-start"><div className="bg-aviva-bg border border-aviva-gold/10 rounded-xl px-3 py-1.5 text-xs text-aviva-secondary">กำลังคิด...</div></div>}
              <div ref={aiEndRef} />
            </div>
            <div className="flex items-center gap-2 p-2 border-t border-aviva-gold/10">
              <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendAiMsg()}
                placeholder="ถามเกี่ยวกับ CRM..." className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-1.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50 placeholder:text-aviva-secondary/40" />
              <button onClick={sendAiMsg} disabled={!aiInput.trim() || aiLoading} className="p-1.5 rounded-xl bg-aviva-gold text-aviva-bg disabled:opacity-40">
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "ทั้งหมด", value: leads.length, color: "text-aviva-text", filter: "all" },
            { label: "Booking", value: stageCounts["Booking"] ?? 0, color: "text-aviva-gold", filter: "Booking" },
            { label: "ทำสัญญา", value: stageCounts["Loan Process"] ?? 0, color: "text-blue-400", filter: "Loan Process" },
            { label: "โอนแล้ว", value: closedCount, color: "text-green-400", filter: "Closed Deal" },
          ].map(({ label, value, color, filter }) => (
            <button key={label} onClick={() => setKpiModal(filter)} className="active:scale-[0.96] transition-transform w-full">
              <GlassCard className="p-3 text-center">
                <p className={clsx("text-xl font-bold", color)}>{value}</p>
                <p className="text-[10px] text-aviva-secondary mt-0.5">{label}</p>
              </GlassCard>
            </button>
          ))}
        </div>

        {/* AI Insight */}
        {leads.length > 0 && closeRate < 20 && (
          <AIInsightPanel type="warning" priority="medium"
            title={`อัตราปิดการขายต่ำ (${closeRate}%)`}
            message="ควรเพิ่มการ follow-up ลูกค้าที่อยู่ในขั้น Site Visit และ Booking เพื่อเร่งปิดการขาย" />
        )}
        {closedCount > 0 && (
          <AIInsightPanel type="success" priority="low"
            title={`ปิดการขายแล้ว ${closedCount} ราย`}
            message={`ยอดขายรวมประมาณ ฿${(leads.filter(l => l.status === "Closed Deal").reduce((s, l) => s + Number(l.budget), 0) / 1_000_000).toFixed(1)}M ในช่วงที่เลือก`} />
        )}

        {/* Main tabs */}
        <div className="flex gap-2">
          {([[ "pipeline", "Pipeline"], ["map", "แผนผัง"], ["team", "ผลงานทีม"]] as [MainTab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setMainTab(k)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1",
                mainTab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              {k === "map" && <MapPin size={11} />}{l}
            </button>
          ))}
        </div>

        {mainTab === "pipeline" && (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
              <input type="text" placeholder="ค้นหาลูกค้า..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40" />
            </div>

            <div>
              <SectionHeader title="Sales Pipeline" subtitle="แตะเพื่อกรอง" />
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {crmStages.map((stage) => (
                  <button key={stage} onClick={() => setActiveStage(stage)}
                    className={clsx("flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      activeStage === stage ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                    )}>
                    {stage}
                    <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      activeStage === stage ? "bg-aviva-bg/20 text-aviva-bg" : "bg-aviva-gold/10 text-aviva-gold"
                    )}>
                      {stageCounts[stage] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {loading ? [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />) :
                filtered.length === 0 ? (
                  <GlassCard className="p-8 text-center">
                    <p className="text-aviva-secondary text-sm">ยังไม่มี Lead ในขั้นนี้</p>
                  </GlassCard>
                ) : (
                  filtered.map((lead) => (
                    <GlassCard key={lead.id} className="p-4 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => setSelectedLead(lead)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {lead.lead_code && (
                              <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-md border border-aviva-gold/20 flex-shrink-0">{lead.lead_code}</span>
                            )}
                            <h3 className="text-sm font-semibold text-aviva-text">{lead.customer_name}</h3>
                            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", sourceColor[lead.source] ?? "bg-gray-500/20 text-gray-400")}>{lead.source}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-aviva-secondary"><Phone size={10} />{lead.phone}</span>
                            <span className="text-xs text-aviva-gold font-medium">{formatBudget(lead.budget)}</span>
                            {lead.created_at && (
                              <span className="text-[10px] text-aviva-secondary/70">📅 {new Date(lead.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
                            )}
                          </div>
                          {lead.notes && <p className="text-[10px] text-aviva-secondary/70 mt-1 truncate">{lead.notes}</p>}
                          {lead.plot_number && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/20 px-1.5 py-0.5 rounded-md">
                              <MapPin size={8} /> แปลง {lead.plot_number}
                            </span>
                          )}
                          {lead.next_follow_up_date && (() => {
                            const due = new Date(lead.next_follow_up_date);
                            const today = new Date(); today.setHours(0,0,0,0);
                            const overdue = due < today;
                            const isToday = due.toDateString() === today.toDateString();
                            return (
                              <span className={clsx("inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                                overdue ? "bg-red-500/20 text-red-400 border border-red-500/30" : isToday ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-aviva-bg text-aviva-secondary border border-aviva-gold/10"
                              )}>
                                {overdue ? "⚠ เลยนัด" : isToday ? "🔔 วันนี้"  : "📅"} ติดตาม {due.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                              </span>
                            );
                          })()}
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={(e) => openCall(lead, e)} className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-[10px] font-medium">
                              <PhoneCall size={10} /> โทร
                            </button>
                            <button onClick={(e) => openChat(lead, e)} className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-[10px] font-medium">
                              <MessageCircle size={10} />{["TikTok", "Instagram"].includes(lead.source) ? lead.source : "LINE"}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); printQuote(lead); }} className="flex items-center gap-1 px-2 py-1 bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 rounded-lg text-[10px] font-medium">
                              <Printer size={10} /> ใบเสนอ
                            </button>
                            {BOOKING_STATUSES.includes(lead.status) && (
                              <button onClick={(e) => { e.stopPropagation(); printBookingLetter(lead); }} className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-[10px] font-medium">
                                <Printer size={10} /> ใบจอง
                              </button>
                            )}
                            {(lead.status === "Booking" || lead.status === "Closed Deal") && (
                              <button onClick={(e) => { e.stopPropagation(); printContract(lead); }} className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-[10px] font-medium">
                                <Printer size={10} /> สัญญา
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => openEdit(lead, e)} className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/10 hover:border-aviva-gold/40 transition-all">
                            <Pencil size={12} className="text-aviva-secondary" />
                          </button>
                          <div className="flex flex-col items-center gap-0.5">
                            <Star size={12} className="text-aviva-gold" />
                            <span className={clsx("text-lg font-bold", scoreColor(lead.ai_score ?? 0))}>{lead.ai_score ?? "—"}</span>
                            <span className="text-[9px] text-aviva-secondary">AI Score</span>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  ))
                )}
              {!loading && filtered.length > 0 && (
                <p className="text-center text-[11px] text-aviva-secondary/60 py-2">
                  แสดงทั้งหมด {filtered.length} รายการ
                </p>
              )}
            </div>
          </>
        )}

        {mainTab === "map" && (
          <div className="space-y-4">
            <SectionHeader title="แผนผังโครงการ" subtitle="สถานะแต่ละแปลง AVIVA ONE 31 หลัง" />
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {[["bg-orange-500/20 border-orange-500/30 text-orange-400","ว่าง"],["bg-yellow-500/20 border-yellow-500/30 text-yellow-400","จอง"],["bg-green-500/20 border-green-500/30 text-green-400","โอนแล้ว"]].map(([cls,lbl])=>(
                <span key={lbl} className={clsx("px-2 py-0.5 rounded-full border",cls)}>{lbl}</span>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: PLOT_COUNT }, (_, i) => i + 1).map((n) => {
                const house = houses.find(h => h.plot_number === n);
                const bookedLead = leads.find(l => l.plot_number === n && BOOKING_STATUSES.includes(l.status));
                const soldLead = leads.find(l => l.plot_number === n && l.status === "Closed Deal");
                const st = house?.status ?? "available";
                const isSold = st === "sold" || st === "completed" || !!soldLead;
                const isBooked = !!bookedLead && !isSold;
                const cellCls = isSold
                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                  : isBooked
                  ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                  : "bg-orange-500/20 border-orange-500/30 text-orange-400";
                const interestedCount = !isBooked && !isSold ? leads.filter(l => l.plot_number === n && !BOOKING_STATUSES.includes(l.status)).length : 0;
                return (
                  <button key={n} onClick={() => setMapPlotModal(n)}
                    className={clsx("border rounded-xl p-2 text-center cursor-pointer active:scale-95 transition-all", cellCls)}>
                    <p className="text-base font-black leading-none">{house?.house_model ? `${house.house_model.charAt(0)}${n}` : String(n)}</p>
                    <p className="text-[10px] leading-tight opacity-80 mt-0.5">{house ? `${house.land_size ?? "—"}ตร.ว.` : "—"}</p>
                    {isBooked && <p className="text-[9px] mt-0.5 truncate font-medium">{bookedLead!.customer_name.split(" ")[0]}</p>}
                    {isSold && <p className="text-[9px] mt-0.5 font-medium">{soldLead ? soldLead.customer_name.split(" ")[0] : "โอนแล้ว"}</p>}
                    {interestedCount > 0 && <p className="text-[9px] mt-0.5 opacity-70">{interestedCount} สนใจ</p>}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: "ว่าง", count: Array.from({length:PLOT_COUNT},(_,i)=>i+1).filter(n => { const h=houses.find(x=>x.plot_number===n); const sold=h?.status==="sold"||h?.status==="completed"||leads.some(l=>l.plot_number===n&&l.status==="Closed Deal"); const b=!sold&&leads.some(l=>l.plot_number===n&&BOOKING_STATUSES.includes(l.status)); return !sold&&!b; }).length, color: "text-orange-400" },
                { label: "จอง/Booking", count: leads.filter(l=>BOOKING_STATUSES.slice(0,2).includes(l.status)&&l.plot_number).length, color: "text-yellow-400" },
                { label: "โอนแล้ว", count: leads.filter(l=>l.status==="Closed Deal"&&l.plot_number).length, color: "text-green-400" },
              ].map(({label,count,color}) => (
                <GlassCard key={label} className="p-3 text-center">
                  <p className={clsx("text-lg font-bold", color)}>{count}</p>
                  <p className="text-[10px] text-aviva-secondary">{label}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {mainTab === "team" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionHeader title="ผลงานทีมขาย" subtitle={`ช่วงที่เลือก · ${leads.length} Leads รวม`} />
              <button onClick={() => setShowActModal(true)}
                className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">
                <Plus size={13} /> บันทึกกิจกรรม
              </button>
            </div>
            {salesActs.length > 0 && (
              <GlassCard className="p-4">
                <p className="text-xs font-semibold text-aviva-gold mb-2">กิจกรรมล่าสุด</p>
                <div className="space-y-1.5">
                  {salesActs.slice(0, 10).map((a) => (
                    <div key={a.id} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-aviva-text">{a.activity_type}</span>
                          {a.note && <span className="text-[10px] text-aviva-secondary truncate">— {a.note}</span>}
                          <span className="text-[10px] text-aviva-secondary/50 ml-auto flex-shrink-0">
                            {new Date(a.activity_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        {a.created_by_name && (
                          <span className="text-[9px] text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-full">โดย {a.created_by_name}</span>
                        )}
                        {a.photo_url && (
                          <a href={a.photo_url} target="_blank" rel="noreferrer">
                            <img src={a.photo_url} alt="รูปกิจกรรม" className="w-16 h-16 rounded-lg object-cover mt-1 border border-aviva-gold/20" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
            {teamStats.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <TrendingUp size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีข้อมูลในช่วงนี้</p>
              </GlassCard>
            ) : (
              teamStats.map((s) => (
                <GlassCard key={s.name} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-bold text-aviva-text">{s.name}</p>
                      <p className="text-xs text-aviva-secondary">{s.total} Leads ทั้งหมด</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-aviva-gold">{s.closeRate}%</p>
                      <p className="text-[10px] text-aviva-secondary">อัตราปิด</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Site Visit", value: s.siteVisit, color: "text-blue-400" },
                      { label: "Booking", value: s.booking, color: "text-aviva-gold" },
                      { label: "โอนแล้ว", value: s.closed, color: "text-green-400" },
                      { label: "ยอดขาย", value: `฿${(s.revenue / 1_000_000).toFixed(1)}M`, color: "text-aviva-text" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center bg-aviva-bg rounded-xl p-2">
                        <p className={clsx("text-sm font-bold", color)}>{value}</p>
                        <p className="text-[9px] text-aviva-secondary mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Activity Modal */}
      {showActModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">บันทึกกิจกรรมรายวัน</h2>
              <button onClick={() => setShowActModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ประเภทกิจกรรม</label>
                <div className="grid grid-cols-2 gap-2">
                  {["รับลูกค้า Walk-in", "โทรออก", "นัดหมาย", "โอนกรรมสิทธิ์", "Site Visit", "อื่นๆ"].map(t => (
                    <button key={t} onClick={() => setActForm(f => ({ ...f, activity_type: t }))}
                      className={clsx("py-2.5 rounded-xl text-xs font-medium border transition-all",
                        actForm.activity_type === t
                          ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                          : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                      )}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่กิจกรรม</label>
                <input type="date" value={actForm.activity_date} onChange={e => setActForm(f => ({ ...f, activity_date: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">บันทึกในนามของ (ไม่บังคับ)</label>
                <input type="text" placeholder={user?.full_name ?? "ชื่อพนักงาน"} value={actForm.onBehalfOf} onChange={e => setActForm(f => ({ ...f, onBehalfOf: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={actForm.note} onChange={e => setActForm(f => ({ ...f, note: e.target.value }))} rows={2}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รูปภาพ (ไม่บังคับ)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 bg-aviva-bg border border-aviva-gold/20 rounded-xl text-xs text-aviva-secondary cursor-pointer hover:border-aviva-gold/40">
                    <Camera size={12} /> เลือกรูป
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (actForm.photoPreview) URL.revokeObjectURL(actForm.photoPreview);
                        setActForm(f => ({ ...f, photo: file, photoPreview: URL.createObjectURL(file) }));
                      }
                    }} />
                  </label>
                  {actForm.photoPreview && <img src={actForm.photoPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-aviva-gold/20" />}
                </div>
              </div>
              <button onClick={handleAddActivity} disabled={savingAct || !actForm.activity_type}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {savingAct ? (uploadingActPhoto ? "กำลังอัพโหลดรูป..." : "กำลังบันทึก...") : "บันทึกกิจกรรม"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRM Log Modal */}
      {crmLogLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">บันทึกการติดต่อ</h2>
                <p className="text-xs text-aviva-secondary mt-0.5">{crmLogLead.customer_name}</p>
              </div>
              <button onClick={() => setCrmLogLead(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ช่องทาง</label>
                <div className="flex gap-2 flex-wrap">
                  {["Phone", "LINE", "TikTok", "Instagram", "Email", "Walk-in"].map(ch => (
                    <button key={ch} onClick={() => setCrmLogForm(f => ({ ...f, channel: ch }))}
                      className={clsx("px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        crmLogForm.channel === ch ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                      )}>{ch}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผลการติดต่อ</label>
                <div className="grid grid-cols-2 gap-2">
                  {CALL_STATUSES.map(s => (
                    <button key={s} onClick={() => setCrmLogForm(f => ({ ...f, callStatus: s }))}
                      className={clsx("py-2 rounded-xl text-xs font-medium border transition-all",
                        crmLogForm.callStatus === s ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                      )}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={crmLogForm.note} onChange={e => setCrmLogForm(f => ({ ...f, note: e.target.value }))} rows={2}
                  placeholder="บันทึกรายละเอียด..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รูปภาพ (ไม่บังคับ)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 bg-aviva-bg border border-aviva-gold/20 rounded-xl text-xs text-aviva-secondary cursor-pointer hover:border-aviva-gold/40">
                    <Camera size={12} /> เลือกรูป
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (crmLogForm.photoPreview) URL.revokeObjectURL(crmLogForm.photoPreview);
                        setCrmLogForm(f => ({ ...f, photo: file, photoPreview: URL.createObjectURL(file) }));
                      }
                    }} />
                  </label>
                  {crmLogForm.photoPreview && <img src={crmLogForm.photoPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-aviva-gold/20" />}
                </div>
              </div>
              <button onClick={saveCrmLog} disabled={savingLog || !crmLogForm.callStatus}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {savingLog ? (uploadingLogPhoto ? "กำลังอัพโหลดรูป..." : "กำลังบันทึก...") : "บันทึกการติดต่อ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLead(null)}>
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto mb-14 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {selectedLead.lead_code && (
                    <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-2 py-0.5 rounded-md border border-aviva-gold/20">{selectedLead.lead_code}</span>
                  )}
                  <h2 className="text-lg font-bold text-aviva-text">{selectedLead.customer_name}</h2>
                </div>
                <p className="text-xs text-aviva-secondary mt-0.5">{selectedLead.phone} · {selectedLead.source}</p>
              </div>
              <button onClick={() => setSelectedLead(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {selectedLead.created_at && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 col-span-2">
                  <p className="text-blue-400 text-[10px] font-semibold">📅 วันที่เยี่ยมชม</p>
                  <p className="text-aviva-text font-semibold mt-0.5">{new Date(selectedLead.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}
              <div className="bg-aviva-bg rounded-xl p-3">
                <p className="text-aviva-secondary">สถานะ</p>
                <p className="text-aviva-text font-semibold mt-0.5">{STATUS_TH[selectedLead.status] ?? selectedLead.status}</p>
              </div>
              <div className="bg-aviva-bg rounded-xl p-3">
                <p className="text-aviva-secondary">งบประมาณ</p>
                <p className="text-aviva-gold font-semibold mt-0.5">{formatBudget(selectedLead.budget)}</p>
              </div>
              {selectedLead.plot_number && (
                <div className="bg-aviva-bg rounded-xl p-3">
                  <p className="text-aviva-secondary">แปลงที่</p>
                  <p className="text-aviva-text font-semibold mt-0.5">{selectedLead.plot_number}</p>
                </div>
              )}
              {selectedLead.financing_type && selectedLead.financing_type !== "ไม่ระบุ" && (
                <div className="bg-aviva-bg rounded-xl p-3">
                  <p className="text-aviva-secondary">รูปแบบชำระ</p>
                  <p className="text-aviva-text font-semibold mt-0.5">{selectedLead.financing_type}</p>
                </div>
              )}
              {selectedLead.next_follow_up_date && (
                <div className="bg-aviva-bg rounded-xl p-3 col-span-2">
                  <p className="text-aviva-secondary">นัดติดตาม</p>
                  <p className="text-aviva-text font-semibold mt-0.5">{new Date(selectedLead.next_follow_up_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}
              {selectedLead.loan_approved_date && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 col-span-2">
                  <p className="text-green-400 text-[10px] font-semibold">🏦 กู้ผ่านแล้ว</p>
                  <p className="text-aviva-text font-semibold mt-0.5">{new Date(selectedLead.loan_approved_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}
              {selectedLead.booking_date && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                  <p className="text-yellow-400 text-[10px] font-semibold">📌 จองเมื่อ</p>
                  <p className="text-aviva-text font-semibold mt-0.5">{new Date(selectedLead.booking_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                  {selectedLead.booking_by && <p className="text-[9px] text-aviva-secondary mt-0.5">โดย {selectedLead.booking_by}</p>}
                </div>
              )}
              {selectedLead.contract_signed_date && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <p className="text-blue-400 text-[10px] font-semibold">📝 ทำสัญญาเมื่อ</p>
                  <p className="text-aviva-text font-semibold mt-0.5">{new Date(selectedLead.contract_signed_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {selectedLead.transfer_date && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                  <p className="text-green-400 text-[10px] font-semibold">🏆 โอนเมื่อ</p>
                  <p className="text-aviva-text font-semibold mt-0.5">{new Date(selectedLead.transfer_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                  {selectedLead.transfer_by && <p className="text-[9px] text-aviva-secondary mt-0.5">โดย {selectedLead.transfer_by}</p>}
                </div>
              )}
              {selectedLead.notes && (
                <div className="bg-aviva-bg rounded-xl p-3 col-span-2">
                  <p className="text-aviva-secondary">หมายเหตุ</p>
                  <p className="text-aviva-text mt-0.5 leading-relaxed">{selectedLead.notes}</p>
                </div>
              )}
              {(selectedLead.contact_address || selectedLead.marital_status || selectedLead.age_range || selectedLead.occupation || selectedLead.current_residence || selectedLead.product_interest || selectedLead.room_requirement || selectedLead.visit_reason || selectedLead.competitor_projects || selectedLead.budget_range || selectedLead.monthly_payment_range || selectedLead.probability) && (
                <div className="bg-aviva-bg rounded-xl p-3 col-span-2 space-y-2">
                  <p className="text-aviva-secondary text-[11px] font-semibold">ข้อมูลโปรไฟล์ลูกค้า</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {([
                      ["ที่อยู่ติดต่อ", selectedLead.contact_address],
                      ["สถานภาพ", selectedLead.marital_status],
                      ["อายุ", selectedLead.age_range],
                      ["อาชีพ", selectedLead.occupation],
                      ["ที่อยู่ปัจจุบัน", selectedLead.current_residence],
                      ["สินค้าที่สนใจ", selectedLead.product_interest],
                      ["จำนวนฟังก์ชัน", selectedLead.room_requirement],
                      ["เหตุผลที่เข้าชม", selectedLead.visit_reason],
                      ["โครงการเปรียบเทียบ", selectedLead.competitor_projects],
                      ["งบ (ช่วง)", selectedLead.budget_range],
                      ["ผ่อน/เดือน", selectedLead.monthly_payment_range],
                      ["Probability", selectedLead.probability],
                    ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([label, v]) => (
                      <div key={label} className="min-w-0">
                        <span className="text-[10px] text-aviva-secondary/70">{label}: </span>
                        <span className="text-[11px] text-aviva-text font-medium break-words">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Customer Installment Section */}
            {BOOKING_STATUSES.includes(selectedLead.status) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-aviva-gold">ตารางชำระเงินลูกค้า</p>
                  {custInsts.length === 0 && !loadingCustInsts ? (
                    <button onClick={() => createDefaultCustInsts(selectedLead)}
                      className="text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-0.5 rounded-lg">
                      สร้างตาราง
                    </button>
                  ) : custInsts.length > 0 ? (
                    <button onClick={() => printInvoice(selectedLead, custInsts)}
                      className="text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-0.5 rounded-lg">
                      🧾 พิมพ์ใบแจ้งหนี้
                    </button>
                  ) : null}
                </div>
                {loadingCustInsts ? (
                  <div className="h-8 rounded-xl bg-aviva-bg animate-pulse" />
                ) : custInsts.length > 0 ? (
                  <div className="space-y-2">
                    {custInsts.map(inst => (
                      <div key={inst.id} className={clsx("rounded-xl p-3 border", inst.status === 'paid' ? "bg-green-500/10 border-green-500/20" : "bg-aviva-bg border-aviva-gold/10")}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-aviva-text">{inst.name}</p>
                            <p className="text-[10px] text-aviva-secondary">฿{inst.amount.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            {inst.status === 'paid' ? (
                              <span className="text-[10px] text-green-400 font-semibold">รับแล้ว {inst.paid_date ? new Date(inst.paid_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : ""}</span>
                            ) : (
                              <span className={clsx("text-[10px] font-medium", inst.status === 'overdue' ? "text-red-400" : "text-aviva-secondary")}>
                                {inst.due_date ? new Date(inst.due_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "ยังไม่กำหนด"}
                              </span>
                            )}
                          </div>
                        </div>
                        {inst.status !== 'paid' && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <input
                              type="text"
                              placeholder="เลขอ้างอิง..."
                              value={payRef[inst.id]?.ref ?? ""}
                              onChange={e => setPayRef(prev => ({ ...prev, [inst.id]: { ref: e.target.value, date: prev[inst.id]?.date ?? "" } }))}
                              className="w-28 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-0.5 text-[10px] text-aviva-text placeholder:text-aviva-secondary/40 outline-none"
                            />
                            <input
                              type="date"
                              value={payRef[inst.id]?.date ?? ""}
                              onChange={e => setPayRef(prev => ({ ...prev, [inst.id]: { ref: prev[inst.id]?.ref ?? "", date: e.target.value } }))}
                              className="w-28 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-0.5 text-[10px] text-aviva-text outline-none"
                            />
                            <button onClick={() => markCustInstPaid(inst)}
                              className="text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-0.5 rounded-lg whitespace-nowrap">
                              ยืนยันชำระ
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* เอกสารแนบ Lead */}
            <div>
              <AttachDocButton entityType="lead" entityId={selectedLead.id} attachedBy={user?.full_name ?? ""} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setCrmLogLead(selectedLead); setSelectedLead(null); }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium border bg-aviva-bg text-aviva-secondary border-aviva-gold/20 hover:border-aviva-gold/50">
                <PhoneCall size={12} /> บันทึกการติดต่อ
              </button>
              <button onClick={() => { setEditingLead(selectedLead); setForm({ customer_name: selectedLead.customer_name, phone: selectedLead.phone, email: selectedLead.email ?? "", budget: String(selectedLead.budget), source: selectedLead.source, status: selectedLead.status, notes: selectedLead.notes, plot_number: selectedLead.plot_number ? String(selectedLead.plot_number) : "", next_follow_up_date: selectedLead.next_follow_up_date ?? "", financing_type: selectedLead.financing_type ?? "ไม่ระบุ", urgency: selectedLead.urgency ?? "ปกติ", delivery_date: selectedLead.delivery_date ?? "", contract_price: selectedLead.contract_price ? String(selectedLead.contract_price) : "", contract_signed_date: selectedLead.contract_signed_date ?? "", loan_approved_date: selectedLead.loan_approved_date ?? "", contact_address: selectedLead.contact_address ?? "", marital_status: selectedLead.marital_status ?? "", age_range: selectedLead.age_range ?? "", occupation: selectedLead.occupation ?? "", current_residence: selectedLead.current_residence ?? "", product_interest: selectedLead.product_interest ?? "", room_requirement: selectedLead.room_requirement ?? "", visit_reason: selectedLead.visit_reason ?? "", competitor_projects: selectedLead.competitor_projects ?? "", budget_range: selectedLead.budget_range ?? "", monthly_payment_range: selectedLead.monthly_payment_range ?? "", probability: selectedLead.probability ?? "", addr_detail: selectedLead.addr_detail ?? "", addr_province: selectedLead.addr_province ?? "", addr_amphoe: selectedLead.addr_amphoe ?? "", addr_tambon: selectedLead.addr_tambon ?? "", addr_zipcode: selectedLead.addr_zipcode ?? "" }); setShowModal(true); setSelectedLead(null); }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium border bg-aviva-bg text-aviva-secondary border-aviva-gold/20 hover:border-aviva-gold/50">
                <Pencil size={12} /> แก้ไข
              </button>
              <button onClick={() => { printQuote(selectedLead); }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium border bg-aviva-gold/10 text-aviva-gold border-aviva-gold/30">
                <Printer size={12} /> ใบเสนอราคา
              </button>
              {BOOKING_STATUSES.includes(selectedLead.status) && (
                <button onClick={() => { printBookingLetter(selectedLead); }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium border bg-orange-500/10 text-orange-400 border-orange-500/20">
                  <FileText size={12} /> ใบจอง
                </button>
              )}
              {(selectedLead.status === "Booking" || selectedLead.status === "Closed Deal") && (
                <button onClick={() => { printContract(selectedLead); }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium border bg-purple-500/10 text-purple-400 border-purple-500/20">
                  <FileText size={12} /> สัญญาซื้อขาย
                </button>
              )}
            </div>

            <p className="text-xs text-aviva-secondary">เปลี่ยนสถานะ:</p>
            <div className="grid grid-cols-2 gap-2">
              {crmStages.map((stage) => (
                <button key={stage} onClick={() => handleUpdateStatus(selectedLead, stage)}
                  className={clsx("py-2.5 px-3 rounded-xl text-xs font-medium border transition-all",
                    selectedLead.status === stage ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                  )}>
                  {stage}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Add / Edit Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={requestCloseModal}>
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 max-h-[88vh] overflow-y-auto mb-14" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-aviva-text">{editingLead ? "แก้ไขข้อมูลลูกค้า" : "เพิ่ม Lead ใหม่"}</h2>
              <button onClick={requestCloseModal}><X size={20} className="text-aviva-secondary" /></button>
            </div>

            <div className="space-y-5">
              {/* หมวด 1 — ข้อมูลลูกค้า */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-aviva-gold uppercase tracking-wide">1 · ข้อมูลลูกค้า</p>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ชื่อ-นามสกุล <span className="text-red-400">*</span></label>
                  <input type="text" value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                    placeholder="เช่น น.ส.ศิริภัสสร ศรีกลาง"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร <span className="text-red-400">*</span></label>
                    <input type="tel" inputMode="numeric" maxLength={12} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                      placeholder="08x-xxx-xxxx"
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">อีเมล</label>
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ที่อยู่ที่ติดต่อได้ (บ้านเลขที่ / หมู่ / ซอย / ถนน)</label>
                  <input type="text" value={form.addr_detail} onChange={e => setForm(p => ({ ...p, addr_detail: e.target.value }))}
                    placeholder="เช่น 21/3 ม.7 ถ.มิตรภาพ"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  {form.contact_address && !form.addr_province && (
                    <p className="text-[10px] text-aviva-secondary/70 mt-1">ที่อยู่เดิม: {form.contact_address}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">จังหวัด</label>
                    <select value={form.addr_province} onChange={e => setForm(p => ({ ...p, addr_province: e.target.value, addr_amphoe: "", addr_tambon: "", addr_zipcode: "" }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50">
                      <option value="">{geo ? "— เลือกจังหวัด —" : "กำลังโหลด..."}</option>
                      {geo && Object.keys(geo).sort((a, b) => a.localeCompare(b, "th")).map(pv => <option key={pv} value={pv}>{pv}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">อำเภอ/เขต</label>
                    <select value={form.addr_amphoe} disabled={!form.addr_province}
                      onChange={e => setForm(p => ({ ...p, addr_amphoe: e.target.value, addr_tambon: "", addr_zipcode: "" }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50 disabled:opacity-50">
                      <option value="">— เลือกอำเภอ —</option>
                      {geo && form.addr_province && geo[form.addr_province] && Object.keys(geo[form.addr_province]).sort((a, b) => a.localeCompare(b, "th")).map(am => <option key={am} value={am}>{am}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">ตำบล/แขวง</label>
                    <select value={form.addr_tambon} disabled={!form.addr_amphoe}
                      onChange={e => { const tb = e.target.value; const zip = (geo && form.addr_province && form.addr_amphoe) ? (geo[form.addr_province]?.[form.addr_amphoe]?.[tb] ?? "") : ""; setForm(p => ({ ...p, addr_tambon: tb, addr_zipcode: zip })); }}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50 disabled:opacity-50">
                      <option value="">— เลือกตำบล —</option>
                      {geo && form.addr_province && form.addr_amphoe && geo[form.addr_province]?.[form.addr_amphoe] && Object.keys(geo[form.addr_province][form.addr_amphoe]).sort((a, b) => a.localeCompare(b, "th")).map(tb => <option key={tb} value={tb}>{tb}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">รหัสไปรษณีย์</label>
                    <input type="tel" inputMode="numeric" maxLength={5} value={form.addr_zipcode}
                      onChange={e => setForm(p => ({ ...p, addr_zipcode: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                      placeholder="อัตโนมัติ"
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-start">
                  <SelectWithOther label="สถานภาพ" value={form.marital_status} options={OPT_MARITAL} onChange={v => setForm(p => ({ ...p, marital_status: v }))} />
                  <SelectWithOther label="อายุ" value={form.age_range} options={OPT_AGE} onChange={v => setForm(p => ({ ...p, age_range: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-3 items-start">
                  <SelectWithOther label="อาชีพ" value={form.occupation} options={OPT_OCCUP} onChange={v => setForm(p => ({ ...p, occupation: v }))} />
                  <SelectWithOther label="ที่อยู่ปัจจุบัน" value={form.current_residence} options={OPT_RESIDENCE} onChange={v => setForm(p => ({ ...p, current_residence: v }))} />
                </div>
              </div>

              {/* หมวด 2 — ความสนใจ / ที่มา */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-aviva-gold uppercase tracking-wide">2 · ความสนใจ / ที่มา</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">ช่องทางที่มา</label>
                    <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50">
                      {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">แปลงที่สนใจ</label>
                    <select value={form.plot_number} onChange={e => setForm(p => ({ ...p, plot_number: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50">
                      <option value="">— ยังไม่ระบุ —</option>
                      {Array.from({ length: PLOT_COUNT }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>แปลง {n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <SelectWithOther label="งบประมาณ (ช่วงราคา)" value={form.budget_range} options={OPT_BUDGET} onChange={v => setForm(p => ({ ...p, budget_range: v }))} />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ — ระบุราคาที่แน่นอน (บาท, ถ้าทราบ)</label>
                  <input type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))}
                    placeholder="เช่น 4500000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                </div>
                <div className="grid grid-cols-2 gap-3 items-start">
                  <SelectWithOther label="สินค้าที่สนใจ" value={form.product_interest} options={OPT_PRODUCT} onChange={v => setForm(p => ({ ...p, product_interest: v }))} />
                  <SelectWithOther label="จำนวนฟังก์ชัน" value={form.room_requirement} options={OPT_ROOM} onChange={v => setForm(p => ({ ...p, room_requirement: v }))} />
                </div>
                <SelectWithOther label="เหตุผลที่เข้าชม" value={form.visit_reason} options={OPT_REASON} onChange={v => setForm(p => ({ ...p, visit_reason: v }))} />
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">โครงการที่เปรียบเทียบ (คู่แข่ง)</label>
                  <input type="text" value={form.competitor_projects} onChange={e => setForm(p => ({ ...p, competitor_projects: e.target.value }))}
                    placeholder="เช่น Golden Neo, ศุภาลัย ฯลฯ"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                </div>
              </div>

              {/* หมวด 3 — สถานะ / การเงิน */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-aviva-gold uppercase tracking-wide">3 · สถานะ / การเงิน</p>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as LeadStatus }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50">
                    {crmStages.map(s => <option key={s} value={s}>{STATUS_TH[s] ?? s}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">รูปแบบการชำระ</label>
                    <select value={form.financing_type} onChange={e => setForm(p => ({ ...p, financing_type: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50">
                      {["ไม่ระบุ", "เงินสด", "สินเชื่อธนาคาร"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">ความเร่งด่วน</label>
                    <select value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50">
                      {["ปกติ", "เร่งด่วน", "สูงมาก"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <SelectWithOther label="ผ่อน/เดือน" value={form.monthly_payment_range} options={OPT_PAYMENT} onChange={v => setForm(p => ({ ...p, monthly_payment_range: v }))} />
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">โอกาสปิดการขาย (Probability)</label>
                  <select value={form.probability} onChange={e => setForm(p => ({ ...p, probability: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50">
                    <option value="">— ไม่ระบุ —</option>
                    {OPT_PROB.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* หมวด 4 — วันที่สำคัญ / สัญญา */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-aviva-gold uppercase tracking-wide">4 · วันที่สำคัญ / สัญญา</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">นัดติดตามครั้งถัดไป</label>
                    <input type="date" value={form.next_follow_up_date} onChange={e => setForm(p => ({ ...p, next_follow_up_date: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">นัดส่งมอบ</label>
                    <input type="date" value={form.delivery_date} onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">ราคาสัญญา (บาท)</label>
                    <input type="number" value={form.contract_price} onChange={e => setForm(p => ({ ...p, contract_price: e.target.value }))}
                      placeholder="เช่น 5170000"
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">วันเซ็นสัญญา</label>
                    <input type="date" value={form.contract_signed_date} onChange={e => setForm(p => ({ ...p, contract_signed_date: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">วันกู้ผ่าน</label>
                    <input type="date" value={form.loan_approved_date} onChange={e => setForm(p => ({ ...p, loan_approved_date: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                  </div>
                </div>
              </div>

              {/* หมวด 5 — หมายเหตุ */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-aviva-gold uppercase tracking-wide">5 · หมายเหตุ</p>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                  placeholder="รายละเอียดความสนใจ / เหตุผลที่เข้าชม / โครงการที่เปรียบเทียบ ฯลฯ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50 resize-none" />
              </div>

              <button onClick={handleSave} disabled={saving || !form.customer_name || !form.phone}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก..." : editingLead ? "บันทึกการแก้ไข" : "เพิ่ม Lead"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ยืนยันออกโดยไม่บันทึก */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6" onClick={() => setConfirmDiscard(false)}>
          <div className="w-full max-w-xs bg-aviva-card rounded-2xl p-5 border border-aviva-gold/20" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-aviva-text mb-1">ออกโดยไม่บันทึก?</p>
            <p className="text-xs text-aviva-secondary leading-relaxed mb-4">มีข้อมูลที่ยังไม่ได้บันทึก หากออกตอนนี้ ข้อมูลที่กรอกไว้จะหายไป</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDiscard(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-aviva-gold/30 text-aviva-text">
                กรอกต่อ
              </button>
              <button onClick={() => { setConfirmDiscard(false); setShowModal(false); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-500/90 text-white">
                ออกไม่บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Plot Detail Modal */}
      {mapPlotModal !== null && (() => {
        const n = mapPlotModal;
        const house = houses.find(h => h.plot_number === n);
        const bookedLead = leads.find(l => l.plot_number === n && BOOKING_STATUSES.includes(l.status));
        const isSold = house?.status === "sold" || house?.status === "completed" || leads.some(l => l.plot_number === n && l.status === "Closed Deal");
        const isBooked = !!bookedLead && !isSold;
        const interestedLeads = leads.filter(l => l.plot_number === n && !BOOKING_STATUSES.includes(l.status)).sort((a, b) => b.ai_score - a.ai_score);
        const displayLead = isSold ? leads.find(l => l.plot_number === n && l.status === "Closed Deal") : bookedLead;
        const STATUS_TH_MAP: Record<string, string> = { "New Lead": "ลีดใหม่", Contacted: "ติดต่อแล้ว", Interested: "สนใจ", Booking: "จอง", "Loan Process": "ทำสัญญา", Transfer: "โอนแล้ว", "Closed Deal": "โอนแล้ว" };
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setMapPlotModal(null)}>
            <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 max-h-[80vh] overflow-y-auto mb-14" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-aviva-text">แปลงที่ {n}</h2>
                  <p className="text-xs text-aviva-secondary">{house?.house_model ?? "—"} · {house?.land_size ?? "—"} ตร.วา</p>
                </div>
                <button onClick={() => setMapPlotModal(null)}><X size={20} className="text-aviva-secondary" /></button>
              </div>
              {(isBooked || isSold) && displayLead ? (
                <div className="space-y-3">
                  <div className={`rounded-2xl p-4 border ${isSold ? "bg-green-500/10 border-green-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                    <p className="text-[10px] text-aviva-secondary mb-1">{isSold ? "โอนกรรมสิทธิ์แล้ว" : "จองแล้ว"}</p>
                    <p className="text-base font-bold text-aviva-text">{displayLead.customer_name}</p>
                    <p className="text-sm text-aviva-gold font-medium mt-0.5">{displayLead.phone}</p>
                    {displayLead.created_at && (
                      <p className="text-[10px] text-blue-400 mt-1">📅 เยี่ยมชม {new Date(displayLead.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] bg-aviva-bg px-2 py-0.5 rounded-full text-aviva-secondary">{STATUS_TH_MAP[displayLead.status] ?? displayLead.status}</span>
                      <span className="text-[10px] bg-aviva-bg px-2 py-0.5 rounded-full text-aviva-secondary">{displayLead.source}</span>
                      {displayLead.financing_type && displayLead.financing_type !== "ไม่ระบุ" && (
                        <span className="text-[10px] bg-aviva-bg px-2 py-0.5 rounded-full text-aviva-secondary">{displayLead.financing_type}</span>
                      )}
                    </div>
                    {displayLead.loan_approved_date && (
                      <p className="text-[10px] text-green-400 mt-2">🏦 กู้ผ่านแล้ว {new Date(displayLead.loan_approved_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                    )}
                    {displayLead.delivery_date && (
                      <p className="text-[10px] text-aviva-gold mt-1">🏠 นัดส่งมอบ {new Date(displayLead.delivery_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                    )}
                    {displayLead.notes && <p className="text-[10px] text-aviva-secondary/70 mt-2 leading-relaxed">{displayLead.notes}</p>}
                  </div>
                  <button onClick={() => { setSelectedLead(displayLead); setMapPlotModal(null); }}
                    className="w-full py-2.5 bg-aviva-gold/10 border border-aviva-gold/30 rounded-xl text-xs text-aviva-gold font-medium">
                    ดูข้อมูลเต็ม / เปลี่ยนสถานะ &rarr;
                  </button>
                  <button onClick={() => {
                    setEditingLead(displayLead);
                    setForm({
                      customer_name: displayLead.customer_name,
                      phone: displayLead.phone,
                      email: displayLead.email ?? "",
                      budget: String(displayLead.budget),
                      source: displayLead.source,
                      status: displayLead.status,
                      notes: displayLead.notes ?? "",
                      plot_number: displayLead.plot_number ? String(displayLead.plot_number) : "",
                      next_follow_up_date: displayLead.next_follow_up_date ?? "",
                      financing_type: displayLead.financing_type ?? "ไม่ระบุ",
                      urgency: displayLead.urgency ?? "ปกติ",
                      delivery_date: displayLead.delivery_date ?? "",
                      contract_price: displayLead.contract_price ? String(displayLead.contract_price) : "",
                      contract_signed_date: displayLead.contract_signed_date ?? "",
                      loan_approved_date: displayLead.loan_approved_date ?? "",
                      contact_address: displayLead.contact_address ?? "",
                      marital_status: displayLead.marital_status ?? "",
                      age_range: displayLead.age_range ?? "",
                      occupation: displayLead.occupation ?? "",
                      current_residence: displayLead.current_residence ?? "",
                      product_interest: displayLead.product_interest ?? "",
                      room_requirement: displayLead.room_requirement ?? "",
                      visit_reason: displayLead.visit_reason ?? "",
                      competitor_projects: displayLead.competitor_projects ?? "",
                      budget_range: displayLead.budget_range ?? "",
                      monthly_payment_range: displayLead.monthly_payment_range ?? "",
                      probability: displayLead.probability ?? "",
                      addr_detail: displayLead.addr_detail ?? "",
                      addr_province: displayLead.addr_province ?? "",
                      addr_amphoe: displayLead.addr_amphoe ?? "",
                      addr_tambon: displayLead.addr_tambon ?? "",
                      addr_zipcode: displayLead.addr_zipcode ?? "",
                    });
                    setShowModal(true);
                    setMapPlotModal(null);
                  }}
                    className="w-full py-2.5 bg-aviva-bg border border-aviva-gold/20 rounded-xl text-xs text-aviva-secondary font-medium flex items-center justify-center gap-1.5">
                    <Pencil size={11} /> แก้ไขข้อมูลลูกค้า
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 text-center">
                    <p className="text-sm font-bold text-orange-400">ว่าง — พร้อมขาย</p>
                  </div>
                  <button onClick={() => {
                    setEditingLead(null);
                    setForm({ ...emptyForm, plot_number: String(n) });
                    setShowModal(true);
                    setMapPlotModal(null);
                  }}
                    className="w-full py-2.5 bg-aviva-gold text-aviva-bg rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                    <Plus size={11} /> เพิ่มลูกค้าใหม่ / จองแปลงนี้
                  </button>
                  {(() => {
                    const unassigned = leads.filter(l => !l.plot_number && l.status !== "Closed Deal");
                    if (unassigned.length === 0) return null;
                    return (
                      <div className="pt-1">
                        <p className="text-xs font-semibold text-aviva-secondary mb-1.5">หรือเพิ่มจาก Lead ที่มีอยู่</p>
                        <select defaultValue=""
                          onChange={(e) => {
                            const l = leads.find(x => x.id === e.target.value);
                            if (!l) return;
                            setEditingLead(l);
                            setForm({
                              customer_name: l.customer_name,
                              phone: l.phone,
                              email: l.email ?? "",
                              budget: String(l.budget),
                              source: l.source,
                              status: l.status,
                              notes: l.notes ?? "",
                              plot_number: String(n),
                              next_follow_up_date: l.next_follow_up_date ?? "",
                              financing_type: l.financing_type ?? "ไม่ระบุ",
                              urgency: l.urgency ?? "ปกติ",
                              delivery_date: l.delivery_date ?? "",
                              contract_price: l.contract_price ? String(l.contract_price) : "",
                              contract_signed_date: l.contract_signed_date ?? "",
                              loan_approved_date: l.loan_approved_date ?? "",
                              contact_address: l.contact_address ?? "",
                              marital_status: l.marital_status ?? "",
                              age_range: l.age_range ?? "",
                              occupation: l.occupation ?? "",
                              current_residence: l.current_residence ?? "",
                              product_interest: l.product_interest ?? "",
                              room_requirement: l.room_requirement ?? "",
                              visit_reason: l.visit_reason ?? "",
                              competitor_projects: l.competitor_projects ?? "",
                              budget_range: l.budget_range ?? "",
                              monthly_payment_range: l.monthly_payment_range ?? "",
                              probability: l.probability ?? "",
                              addr_detail: l.addr_detail ?? "",
                              addr_province: l.addr_province ?? "",
                              addr_amphoe: l.addr_amphoe ?? "",
                              addr_tambon: l.addr_tambon ?? "",
                              addr_zipcode: l.addr_zipcode ?? "",
                            });
                            setShowModal(true);
                            setMapPlotModal(null);
                          }}
                          className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50">
                          <option value="">— เลือกลูกค้าจากรายชื่อ Lead —</option>
                          {unassigned.map(l => (
                            <option key={l.id} value={l.id}>{l.customer_name} · {l.phone}{l.lead_code ? ` (${l.lead_code})` : ""}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-aviva-secondary/60 mt-1">เลือกแล้วจะเปิดฟอร์มพร้อมผูกแปลง {n} ให้อัตโนมัติ — แก้สถานะเป็น &quot;จอง&quot; แล้วกดบันทึก</p>
                      </div>
                    );
                  })()}
                  {interestedLeads.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-aviva-secondary mb-2">ผู้สนใจแปลงนี้ ({interestedLeads.length} ราย)</p>
                      <div className="space-y-1.5">
                        {interestedLeads.slice(0, 5).map((l, idx) => (
                          <button key={l.id} onClick={() => { setSelectedLead(l); setMapPlotModal(null); }}
                            className="w-full flex items-center justify-between bg-aviva-bg rounded-xl px-3 py-2 text-left hover:bg-aviva-gold/5">
                            <div>
                              <div>
                                <span className="text-[10px] text-aviva-secondary/50 mr-1.5">#{idx + 1}</span>
                                <span className="text-xs font-medium text-aviva-text">{l.customer_name}</span>
                              </div>
                              {l.created_at && (
                                <span className="block text-[9px] text-blue-400/80 mt-0.5">📅 เยี่ยมชม {new Date(l.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold ${l.ai_score >= 70 ? "text-green-400" : l.ai_score >= 40 ? "text-yellow-400" : "text-red-400"}`}>AI {l.ai_score}%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-aviva-secondary/50 text-center py-4">ยังไม่มีผู้สนใจแปลงนี้</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {celebration && (
        <CelebrationModal
          event={celebration.event}
          customerName={celebration.customerName}
          plotNumber={celebration.plotNumber}
          amount={celebration.amount}
          salesPerson={celebration.salesPerson}
          onClose={() => setCelebration(null)}
        />
      )}

      {/* Floating report button */}
      <button
        onClick={async () => {
          const today = new Date().toISOString().split("T")[0];
          const items: AutoReportItem[] = [];
          const { data: logs } = await supabase
            .from("crm_logs")
            .select("contact_channel,call_status,call_note,created_at")
            .gte("created_at", today + "T00:00:00");
          (logs ?? []).forEach((l: { contact_channel: string; call_status: string; call_note: string | null }) => {
            items.push({ category: "activity", description: `${l.contact_channel}: ${l.call_status}${l.call_note ? ` — ${l.call_note}` : ""}` });
          });
          const { data: acts } = await supabase
            .from("sales_activities")
            .select("activity_type,note,activity_date,created_by_name")
            .eq("project_id", PROJECT_ID)
            .gte("created_at", today + "T00:00:00");
          (acts ?? []).forEach((a: { activity_type: string; note: string | null; created_by_name: string | null }) => {
            items.push({ category: "activity", description: `${a.activity_type}${a.created_by_name ? ` (${a.created_by_name})` : ""}${a.note ? `: ${a.note}` : ""}` });
          });
          setReportAutoItems(items);
          setShowReportModal(true);
        }}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 bg-aviva-gold text-aviva-bg font-bold text-xs px-4 py-2.5 rounded-2xl shadow-lg shadow-aviva-gold/20 hover:bg-aviva-gold/90 active:scale-95 transition-all"
      >
        <Send size={14} /> ส่งรายงานวัน
      </button>

      <ReportSubmitModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        department={user?.department ?? "ฝ่ายขาย"}
        autoItems={reportAutoItems}
        onSubmitted={() => setToast({ msg: "ส่งรายงานประจำวันเรียบร้อยแล้ว", type: "success" })}
      />
    </div>
  );
}
