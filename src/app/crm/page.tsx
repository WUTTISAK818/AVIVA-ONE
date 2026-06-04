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
import { createNotification } from "@/lib/notify";
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
};

const emptyCrmLog = { channel: "Phone", callStatus: "", note: "", photo: null as File | null, photoPreview: "" };

type MainTab = "pipeline" | "team" | "map";

export default function CRMPage() {
  const user = useCurrentUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("pipeline");
  const [activeStage, setActiveStage] = useState<LeadStatus>("New Lead");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [dateStart, setDateStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [leadsLimit, setLeadsLimit] = useState(50);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
  const [showCustInstModal, setShowCustInstModal] = useState(false);
  const [custInstLead, setCustInstLead] = useState<Lead | null>(null);
  const [payRef, setPayRef] = useState<Record<string, { ref: string; date: string }>>({});
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportAutoItems, setReportAutoItems] = useState<AutoReportItem[]>([]);
  const [celebration, setCelebration] = useState<{ event: "booking" | "contract" | "transfer"; customerName: string; plotNumber: number | null; amount: number | null } | null>(null);
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

  const fetchLeads = async (start: string, end: string, limit = 50) => {
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
    setLeadsLimit(50);
    fetchLeads(dateStart, dateEnd, 50);
  }, [dateStart, dateEnd]);

  const handlePeriodChange = (p: Period, start: string, end: string) => {
    setPeriod(p);
    setDateStart(start);
    setDateEnd(end);
  };

  const stageCounts = useMemo(() => Object.fromEntries(
    pipelineStages.map((s) => [s, leads.filter((l) => l.status === s).length])
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
    setEditingLead(lead);
    setForm({ customer_name: lead.customer_name, phone: lead.phone, email: lead.email ?? "", budget: String(lead.budget), source: lead.source, status: lead.status, notes: lead.notes ?? "", plot_number: lead.plot_number ? String(lead.plot_number) : "", next_follow_up_date: lead.next_follow_up_date ?? "", financing_type: lead.financing_type ?? "ไม่ระบุ", urgency: lead.urgency ?? "ปกติ", delivery_date: lead.delivery_date ?? "", contract_price: lead.contract_price ? String(lead.contract_price) : "", contract_signed_date: lead.contract_signed_date ?? "", loan_approved_date: lead.loan_approved_date ?? "" });
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
    Booking: "จอง", "Loan Process": "กำลังกู้", "Closed Deal": "ปิดการขาย",
  };

  const handleSave = async () => {
    if (!form.customer_name || !form.phone) return;
    setSaving(true);
    const plotNum = form.plot_number ? Number(form.plot_number) : null;
    if (editingLead) {
      const prevLoanDate = editingLead.loan_approved_date;
      const { error: updateErr } = await supabase.from("leads").update({ customer_name: form.customer_name, phone: form.phone, email: form.email || null, budget: Number(form.budget) || 0, source: form.source, status: form.status, notes: form.notes, plot_number: plotNum, next_follow_up_date: form.next_follow_up_date || null, financing_type: form.financing_type || null, urgency: form.urgency || null, delivery_date: form.delivery_date || null, contract_price: form.contract_price ? Number(form.contract_price) : null, contract_signed_date: form.contract_signed_date || null, loan_approved_date: form.loan_approved_date || null, updated_at: new Date().toISOString() }).eq("id", editingLead.id);
      if (updateErr) { setSaving(false); setToast({ msg: "บันทึกไม่สำเร็จ: " + updateErr.message, type: "error" }); return; }
      if (form.status !== editingLead.status) {
        const effectivePlot = plotNum ?? editingLead.plot_number;
        if (effectivePlot) {
          if (form.status === "Booking") {
            const { data: existingBook } = await supabase.from("leads").select("id,customer_name").eq("project_id", PROJECT_ID).eq("plot_number", effectivePlot).in("status", ["Booking", "Loan Process", "Closed Deal"]).neq("id", editingLead.id).maybeSingle();
            if (existingBook) { setSaving(false); setToast({ msg: `แปลง ${effectivePlot} ถูกจองโดย ${existingBook.customer_name} แล้ว ไม่สามารถจองซ้ำได้`, type: "error" }); return; }
            await supabase.from("houses").update({ status: "reserved" }).eq("project_id", PROJECT_ID).eq("plot_number", effectivePlot);
            setCelebration({ event: "booking", customerName: form.customer_name, plotNumber: effectivePlot, amount: Number(form.budget) || null });
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
        await createNotification({
          type: form.status === "Closed Deal" ? "success" : "info",
          title: `${form.customer_name} — ${STATUS_TH[form.status] ?? form.status}`,
          message: `เปลี่ยนสถานะจาก "${STATUS_TH[editingLead.status] ?? editingLead.status}"${plotNum ? ` · แปลง ${plotNum}` : ""}`,
          from_dept: "ฝ่ายขาย",
          to_dept: "ฝ่ายขาย",
        });
        if (form.status === "Loan Process") {
          setCelebration({ event: "contract", customerName: form.customer_name, plotNumber: plotNum, amount: Number(form.budget) || null });
        }
        if (form.status === "Closed Deal") {
          setCelebration({ event: "transfer", customerName: form.customer_name, plotNumber: plotNum, amount: Number(form.budget) || null });
        }
      }
      // Notify when loan is newly approved
      if (form.loan_approved_date && !prevLoanDate) {
        await createNotification({
          type: "success",
          title: `🏦 กู้ผ่านแล้ว! — ${form.customer_name}`,
          message: `ธนาคารอนุมัติสินเชื่อ${plotNum ? ` แปลงที่ ${plotNum}` : ""} วันที่ ${new Date(form.loan_approved_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}`,
          from_dept: "ฝ่ายขาย",
          to_dept: "ผู้บริหาร",
        });
        setToast({ msg: `🏦 บันทึกวันกู้ผ่านแล้ว — ${form.customer_name}`, type: "success" });
      }
    } else {
      const { error: insertErr } = await supabase.from("leads").insert({ customer_name: form.customer_name, phone: form.phone, email: form.email || null, budget: Number(form.budget) || 0, source: form.source, status: form.status, notes: form.notes, plot_number: plotNum, project_id: PROJECT_ID, ai_score: 50, next_follow_up_date: form.next_follow_up_date || null, financing_type: form.financing_type || null, urgency: form.urgency || null, delivery_date: form.delivery_date || null, contract_price: form.contract_price ? Number(form.contract_price) : null, contract_signed_date: form.contract_signed_date || null, loan_approved_date: form.loan_approved_date || null });
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
    await supabase.from("leads").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", lead.id);
    if (lead.plot_number) {
      if (newStatus === "Booking") {
        const { data: existingBook } = await supabase.from("leads").select("id,customer_name").eq("project_id", PROJECT_ID).eq("plot_number", lead.plot_number).in("status", ["Booking", "Loan Process", "Closed Deal"]).neq("id", lead.id).maybeSingle();
        if (existingBook) { setToast({ msg: `แปลง ${lead.plot_number} ถูกจองโดย ${existingBook.customer_name} แล้ว`, type: "error" }); return; }
        await supabase.from("houses").update({ status: "reserved" }).eq("project_id", PROJECT_ID).eq("plot_number", lead.plot_number);
      } else if (BOOKING_STATUSES.includes(lead.status as LeadStatus) && !BOOKING_STATUSES.includes(newStatus)) {
        await supabase.from("houses").update({ status: "available" }).eq("project_id", PROJECT_ID).eq("plot_number", lead.plot_number);
      }
    }
    if (newStatus !== lead.status) {
      await createNotification({
        type: newStatus === "Closed Deal" ? "success" : "info",
        title: `${lead.customer_name} — ${STATUS_TH[newStatus] ?? newStatus}`,
        message: `เปลี่ยนสถานะจาก "${STATUS_TH[lead.status] ?? lead.status}"`,
        from_dept: "ฝ่ายขาย",
        to_dept: "ฝ่ายขาย",
      });
      if (newStatus === "Booking") {
        setCelebration({ event: "booking", customerName: lead.customer_name, plotNumber: lead.plot_number ?? null, amount: lead.budget ?? null });
      }
      if (newStatus === "Loan Process") {
        setCelebration({ event: "contract", customerName: lead.customer_name, plotNumber: lead.plot_number ?? null, amount: lead.budget ?? null });
      }
      if (newStatus === "Closed Deal") {
        setCelebration({ event: "transfer", customerName: lead.customer_name, plotNumber: lead.plot_number ?? null, amount: lead.budget ?? null });
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
            { label: "Loan", value: stageCounts["Loan Process"] ?? 0, color: "text-blue-400", filter: "Loan Process" },
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
              <SectionHeader title="Pipeline" subtitle="แตะเพื่อกรอง" />
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {pipelineStages.map((stage) => (
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
              {!loading && leads.length >= leadsLimit && (
                <button onClick={() => { const next = leadsLimit + 50; setLeadsLimit(next); fetchLeads(dateStart, dateEnd, next); }}
                  className="w-full py-3 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-card hover:border-aviva-gold/30 transition-all">
                  โหลดเพิ่มเติม (แสดง {leadsLimit} รายการแล้ว)
                </button>
              )}
            </div>
          </>
        )}

        {mainTab === "map" && (
          <div className="space-y-4">
            <SectionHeader title="แผนผังโครงการ" subtitle="สถานะแต่ละแปลง AVIVA ONE 31 หลัง" />
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {[["bg-green-500/20 border-green-500/30 text-green-400","ว่าง"],["bg-yellow-500/20 border-yellow-500/30 text-yellow-400","ก่อสร้าง"],["bg-orange-500/20 border-orange-500/30 text-orange-400","จอง"],["bg-aviva-gold/20 border-aviva-gold/30 text-aviva-gold","โอนแล้ว"]].map(([cls,lbl])=>(
                <span key={lbl} className={clsx("px-2 py-0.5 rounded-full border",cls)}>{lbl}</span>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: PLOT_COUNT }, (_, i) => i + 1).map((n) => {
                const house = houses.find(h => h.plot_number === n);
                const bookedLead = leads.find(l => l.plot_number === n && BOOKING_STATUSES.includes(l.status));
                const st = house?.status ?? "available";
                const isSold = st === "sold" || st === "completed" || leads.some(l => l.plot_number === n && l.status === "Closed Deal");
                const isBooked = !!bookedLead && !isSold;
                const isConst = !isSold && !isBooked && (st === "under_construction" || st === "in_progress");
                const cellCls = isSold
                  ? "bg-aviva-gold/20 border-aviva-gold/30 text-aviva-gold"
                  : isBooked
                  ? "bg-orange-500/20 border-orange-500/30 text-orange-400"
                  : isConst
                  ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                  : "bg-green-500/20 border-green-500/30 text-green-400";
                const interestedCount = !isBooked && !isSold ? leads.filter(l => l.plot_number === n && !BOOKING_STATUSES.includes(l.status)).length : 0;
                return (
                  <button key={n} onClick={() => setMapPlotModal(n)}
                    className={clsx("border rounded-xl p-2 text-center cursor-pointer active:scale-95 transition-all", cellCls)}>
                    <p className="text-xl font-black leading-none">{n}</p>
                    <p className="text-xs font-semibold leading-tight mt-0.5">{house?.house_model ?? "—"}</p>
                    <p className="text-[10px] leading-tight opacity-80">{house ? `${house.land_size ?? "—"}ตร.ว.` : "—"}</p>
                    {isBooked && <p className="text-[9px] mt-0.5 truncate font-medium">{bookedLead!.customer_name.split(" ")[0]}</p>}
                    {isSold && <p className="text-[9px] mt-0.5 font-medium">โอนแล้ว</p>}
                    {interestedCount > 0 && <p className="text-[9px] mt-0.5 opacity-70">{interestedCount} สนใจ</p>}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: "ว่าง", count: Array.from({length:PLOT_COUNT},(_,i)=>i+1).filter(n => { const h=houses.find(x=>x.plot_number===n); const b=leads.find(l=>l.plot_number===n&&BOOKING_STATUSES.includes(l.status)); const sold=leads.some(l=>l.plot_number===n&&l.status==="Closed Deal"); return !sold&&!b&&h?.status!=="under_construction"&&h?.status!=="in_progress"; }).length, color: "text-green-400" },
                { label: "จอง/Booking", count: leads.filter(l=>BOOKING_STATUSES.slice(0,2).includes(l.status)&&l.plot_number).length, color: "text-orange-400" },
                { label: "โอนแล้ว", count: leads.filter(l=>l.status==="Closed Deal"&&l.plot_number).length, color: "text-aviva-gold" },
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
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่</label>
                <input type="date" value={actForm.activity_date}
                  onChange={e => setActForm(f => ({ ...f, activity_date: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">บันทึกเพิ่มเติม</label>
                <textarea value={actForm.note}
                  onChange={e => setActForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="รายละเอียดกิจกรรม..." rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">แนบรูปภาพ (ถ่ายรูปหรือเลือกจากคลัง)</label>
                <label className="cursor-pointer flex items-center gap-3 w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3">
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setActForm(prev => ({ ...prev, photo: f, photoPreview: URL.createObjectURL(f) }));
                    }} />
                  {uploadingActPhoto ? <Loader2 size={16} className="text-aviva-gold animate-spin" /> : <Camera size={16} className="text-aviva-secondary/60" />}
                  <span className="text-sm text-aviva-secondary/60">{actForm.photo ? actForm.photo.name : "เลือกรูปภาพ..."}</span>
                  {actForm.photoPreview && <img src={actForm.photoPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover ml-auto border border-aviva-gold/20" />}
                </label>
              </div>
              {user?.isManager && (
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">บันทึกแทน (ชื่อพนักงาน)</label>
                  <input value={actForm.onBehalfOf}
                    onChange={e => setActForm(f => ({ ...f, onBehalfOf: e.target.value }))}
                    placeholder={`เว้นว่างเพื่อใช้ชื่อคุณ (${user.full_name})`}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 placeholder:text-aviva-secondary/40" />
                </div>
              )}
            </div>
            <button onClick={handleAddActivity} disabled={savingAct || uploadingActPhoto}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {savingAct ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
            </button>
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
                <p className="text-xs text-aviva-secondary">{crmLogLead.customer_name} · {crmLogLead.phone}</p>
              </div>
              <button onClick={() => setCrmLogLead(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {crmLogForm.channel === "Phone" ? (
              <a href={`tel:${crmLogLead.phone}`} className="flex items-center justify-center gap-2 w-full py-3 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-sm font-medium">
                <PhoneCall size={16} /> กดโทร {crmLogLead.phone}
              </a>
            ) : (
              <a href={getChatLink(crmLogLead)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-medium">
                <MessageCircle size={16} /> เปิด {crmLogForm.channel}
              </a>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ช่องทาง</label>
                <select value={crmLogForm.channel} onChange={(e) => setCrmLogForm({ ...crmLogForm, channel: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["Phone", "LINE", "Instagram", "TikTok"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผลการติดต่อ *</label>
                <select value={crmLogForm.callStatus} onChange={(e) => setCrmLogForm({ ...crmLogForm, callStatus: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="">-- เลือกผลการติดต่อ --</option>
                  {CALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">บันทึกเพิ่มเติม</label>
                <textarea value={crmLogForm.note} onChange={(e) => setCrmLogForm({ ...crmLogForm, note: e.target.value })}
                  placeholder="รายละเอียดการพูดคุย..." rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">แนบรูปภาพ (ถ่ายรูปการพบปะ)</label>
                <label className="cursor-pointer flex items-center gap-3 w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3">
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setCrmLogForm(prev => ({ ...prev, photo: f, photoPreview: URL.createObjectURL(f) }));
                    }} />
                  {uploadingLogPhoto ? <Loader2 size={16} className="text-aviva-gold animate-spin" /> : <Camera size={16} className="text-aviva-secondary/60" />}
                  <span className="text-sm text-aviva-secondary/60">{crmLogForm.photo ? crmLogForm.photo.name : "เลือกรูปภาพ..."}</span>
                  {crmLogForm.photoPreview && <img src={crmLogForm.photoPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover ml-auto border border-aviva-gold/20" />}
                </label>
              </div>
            </div>
            <button onClick={saveCrmLog} disabled={savingLog || !crmLogForm.callStatus || uploadingLogPhoto}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {savingLog ? "กำลังบันทึก..." : "บันทึก CRM Log"}
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">{editingLead ? "แก้ไข Lead" : "เพิ่ม Lead ใหม่"}</h2>
              <button onClick={() => { setShowModal(false); setEditingLead(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร *</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท)</label>
                  <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="3500000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">แหล่งที่มา</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {pipelineStages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {BOOKING_STATUSES.includes(form.status as LeadStatus) && (
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">แปลงที่จอง</label>
                  <select value={form.plot_number} onChange={(e) => setForm({ ...form, plot_number: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">-- ยังไม่ระบุแปลง --</option>
                    {Array.from({ length: PLOT_COUNT }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>แปลงที่ {n}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">อีเมล</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@email.com"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">แผนการเงิน</label>
                  <select value={form.financing_type} onChange={(e) => setForm({ ...form, financing_type: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="ไม่ระบุ">ไม่ระบุ</option>
                    <option value="กู้แบงก์">กู้ธนาคาร</option>
                    <option value="เงินสด">เงินสด</option>
                    <option value="ผ่อนดาวน์">ผ่อนดาวน์</option>
                    <option value="สินเชื่อบ้านนโยบาย">สินเชื่อนโยบาย</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความเร่งด่วน</label>
                  <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="ปกติ">ปกติ</option>
                    <option value="ด่วน">ด่วน (1 เดือน)</option>
                    <option value="เร่งด่วน">เร่งด่วน (1 สัปดาห์)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">นัดติดตามครั้งต่อไป</label>
                <input type="date" value={form.next_follow_up_date} onChange={(e) => setForm({ ...form, next_follow_up_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ราคาสัญญา (บาท)</label>
                <input type="number" value={form.contract_price} onChange={e => setForm(p => ({ ...p, contract_price: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">🏦 วันกู้ผ่าน</label>
                  <input type="date" value={form.loan_approved_date} onChange={e => setForm(p => ({ ...p, loan_approved_date: e.target.value }))}
                    className="w-full bg-aviva-bg border border-green-500/30 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-green-500/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">🏠 วันส่งมอบบ้าน</label>
                  <input type="date" value={form.delivery_date} onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/50" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="บันทึกเพิ่มเติม..." rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.customer_name || !form.phone}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : editingLead ? "บันทึกการแก้ไข" : "บันทึก Lead"}
            </button>
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModal === "all" ? "ลูกค้าทั้งหมด" :
                 kpiModal === "Booking" ? "สถานะ Booking" :
                 kpiModal === "Loan Process" ? "สถานะ Loan Process" : "โอนกรรมสิทธิ์แล้ว"}
                <span className="ml-1.5 text-xs font-normal text-aviva-secondary">
                  ({(kpiModal === "all" ? leads : leads.filter(l => l.status === kpiModal)).length} ราย)
                </span>
              </h2>
              <button onClick={() => setKpiModal(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {(kpiModal === "all" ? leads : leads.filter(l => l.status === kpiModal)).map(l => (
                <button key={l.id} onClick={() => { setKpiModal(null); setSelectedLead(l); }}
                  className="w-full flex items-center gap-2 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10 hover:border-aviva-gold/30 active:scale-[0.98] transition-all text-left">
                  {l.lead_code && (
                    <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded border border-aviva-gold/20 flex-shrink-0">
                      {l.lead_code}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-aviva-text truncate">{l.customer_name}</p>
                    <p className="text-[10px] text-aviva-secondary">{l.phone} · {formatBudget(l.budget)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full", sourceColor[l.source] ?? "bg-gray-500/20 text-gray-400")}>{l.source}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-aviva-gold/10 text-aviva-gold">{l.status}</span>
                  </div>
                </button>
              ))}
              {(kpiModal === "all" ? leads : leads.filter(l => l.status === kpiModal)).length === 0 && (
                <p className="text-center text-aviva-secondary text-sm py-8">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-aviva-text">{selectedLead.customer_name}</h2>
                  {selectedLead.lead_code && (
                    <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded border border-aviva-gold/20">{selectedLead.lead_code}</span>
                  )}
                </div>
                <p className="text-xs text-aviva-secondary mt-0.5">{selectedLead.phone} · {formatBudget(selectedLead.budget)}</p>
              </div>
              <button onClick={() => setSelectedLead(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={clsx("text-[11px] font-medium px-2 py-1 rounded-full", sourceColor[selectedLead.source] ?? "bg-gray-500/20 text-gray-400")}>
                {selectedLead.source}
              </span>
              {selectedLead.plot_number && (
                <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">แปลงที่ {selectedLead.plot_number}</span>
              )}
              <span className={clsx("text-[11px] font-medium px-2 py-1 rounded-full",
                selectedLead.ai_score >= 70 ? "bg-green-500/20 text-green-400" :
                selectedLead.ai_score >= 40 ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              )}>AI {selectedLead.ai_score}%</span>
            </div>

            {/* ข้อมูลเพิ่มเติม */}
            <div className="grid grid-cols-2 gap-2">
              {selectedLead.email && (
                <div className="col-span-2 bg-aviva-bg rounded-xl px-3 py-2">
                  <p className="text-[10px] text-aviva-secondary mb-0.5">อีเมล</p>
                  <p className="text-xs text-aviva-text">{selectedLead.email}</p>
                </div>
              )}
              {selectedLead.financing_type && selectedLead.financing_type !== "ไม่ระบุ" && (
                <div className="bg-aviva-bg rounded-xl px-3 py-2">
                  <p className="text-[10px] text-aviva-secondary mb-0.5">การเงิน</p>
                  <p className="text-xs text-aviva-text">{selectedLead.financing_type}</p>
                </div>
              )}
              {selectedLead.urgency && selectedLead.urgency !== "ปกติ" && (
                <div className="bg-aviva-bg rounded-xl px-3 py-2">
                  <p className="text-[10px] text-aviva-secondary mb-0.5">ความเร่งด่วน</p>
                  <p className={`text-xs font-medium ${selectedLead.urgency === "เร่งด่วน" ? "text-red-400" : selectedLead.urgency === "สูง" ? "text-orange-400" : "text-aviva-text"}`}>
                    {selectedLead.urgency}
                  </p>
                </div>
              )}
              {selectedLead.next_follow_up_date && (
                <div className="bg-aviva-bg rounded-xl px-3 py-2">
                  <p className="text-[10px] text-aviva-secondary mb-0.5">นัดติดตามครั้งถัดไป</p>
                  <p className="text-xs text-aviva-gold">{new Date(selectedLead.next_follow_up_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {selectedLead.last_contact_date && (
                <div className="bg-aviva-bg rounded-xl px-3 py-2">
                  <p className="text-[10px] text-aviva-secondary mb-0.5">ติดต่อล่าสุด</p>
                  <p className="text-xs text-aviva-text">{new Date(selectedLead.last_contact_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {selectedLead.delivery_date && (
                <div className="bg-aviva-bg rounded-xl px-3 py-2">
                  <p className="text-[10px] text-aviva-secondary mb-0.5">วันส่งมอบบ้าน</p>
                  <p className="text-xs text-aviva-gold font-medium">{new Date(selectedLead.delivery_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}
              {selectedLead.contract_price && (
                <div className="bg-aviva-bg rounded-xl px-3 py-2">
                  <p className="text-[10px] text-aviva-secondary mb-0.5">ราคาสัญญา</p>
                  <p className="text-xs text-aviva-gold font-medium">฿{Number(selectedLead.contract_price).toLocaleString()}</p>
                </div>
              )}
              {selectedLead.loan_approved_date && (
                <div className="col-span-2 bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2">
                  <p className="text-[10px] text-green-400 mb-0.5 font-semibold">🏦 กู้ผ่านแล้ว</p>
                  <p className="text-xs text-green-300">{new Date(selectedLead.loan_approved_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}
            </div>

            {selectedLead.notes && (
              <p className="text-xs text-aviva-secondary bg-aviva-bg rounded-xl px-3 py-2 leading-relaxed">{selectedLead.notes}</p>
            )}

            {/* ประวัติการติดต่อ */}
            {loadingLogs ? (
              <div className="h-10 rounded-xl bg-aviva-bg/50 animate-pulse" />
            ) : leadLogs.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-aviva-secondary mb-1.5">ประวัติการติดต่อ ({leadLogs.length})</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {leadLogs.map(log => (
                    <div key={log.id} className="bg-aviva-bg rounded-xl px-3 py-2 text-xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-aviva-gold font-medium">{log.contact_channel} · {log.call_status}</span>
                        <span className="text-aviva-secondary/60">{new Date(log.created_at).toLocaleDateString("th-TH")}</span>
                      </div>
                      {log.call_note && <p className="text-aviva-secondary leading-relaxed">{log.call_note}</p>}
                      {log.photo_url && (
                        <a href={log.photo_url} target="_blank" rel="noreferrer">
                          <img src={log.photo_url} alt="รูปประกอบ" className="w-16 h-16 rounded-lg object-cover mt-1.5 border border-aviva-gold/20" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-aviva-secondary/50 text-center py-1">ยังไม่มีประวัติการติดต่อ</p>
            )}

            {/* ประวัติเอกสาร/อนุมัติ */}
            {loadingApprovals ? (
              <div className="h-10 rounded-xl bg-aviva-bg/50 animate-pulse" />
            ) : leadApprovals.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-aviva-secondary mb-1.5">เอกสาร / ประวัติอนุมัติ ({leadApprovals.length})</p>
                <div className="space-y-1.5">
                  {leadApprovals.map(appr => {
                    const wfLabel: Record<string, string> = {
                      Contract_Approval: "สัญญาซื้อขาย", Booking_Deposit: "ใบจอง",
                      Finance_Approval: "อนุมัติการเงิน",
                    };
                    const statusColor: Record<string, string> = {
                      Pending: "text-yellow-400 bg-yellow-500/10",
                      Approved: "text-green-400 bg-green-500/10",
                      Rejected: "text-red-400 bg-red-500/10",
                    };
                    return (
                      <div key={appr.id} className="bg-aviva-bg rounded-xl px-3 py-2 text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-aviva-text font-medium">{wfLabel[appr.workflow_type] ?? appr.workflow_type}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColor[appr.action_taken] ?? "text-aviva-secondary bg-aviva-bg"}`}>
                            {appr.action_taken}
                          </span>
                        </div>
                        <p className="text-aviva-secondary leading-relaxed truncate">{appr.source_doc_index}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          {appr.amount != null && <span className="text-aviva-gold">฿{Number(appr.amount).toLocaleString()}</span>}
                          <span className="text-aviva-secondary/60 ml-auto">{new Date(appr.created_at).toLocaleDateString("th-TH")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* ตารางชำระเงินลูกค้า */}
            {(custInsts.length > 0 || BOOKING_STATUSES.includes(selectedLead.status)) && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-aviva-secondary">ตารางชำระเงิน ({custInsts.length} งวด)</p>
                  {custInsts.length === 0 && (
                    <button onClick={() => createDefaultCustInsts(selectedLead)}
                      className="text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-0.5 rounded-lg">
                      + สร้างตาราง
                    </button>
                  )}
                </div>
                {loadingCustInsts ? (
                  <div className="h-8 bg-aviva-bg/50 rounded-xl animate-pulse" />
                ) : (
                  <div className="space-y-1.5">
                    {custInsts.map(inst => (
                      <div key={inst.id} className="bg-aviva-bg rounded-xl px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-aviva-text font-medium">{inst.name}</p>
                          <p className="text-[10px] text-aviva-secondary">฿{Number(inst.amount).toLocaleString()}{inst.due_date ? ` · ครบ ${new Date(inst.due_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : ""}</p>
                        </div>
                        {inst.status === 'paid' ? (
                          <span className="text-[10px] text-green-400 font-bold">✓ รับแล้ว</span>
                        ) : (
                          <div className="flex flex-col gap-1 items-end">
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
                )}
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
              <button onClick={() => { setEditingLead(selectedLead); setForm({ customer_name: selectedLead.customer_name, phone: selectedLead.phone, email: selectedLead.email ?? "", budget: String(selectedLead.budget), source: selectedLead.source, status: selectedLead.status, notes: selectedLead.notes, plot_number: selectedLead.plot_number ? String(selectedLead.plot_number) : "", next_follow_up_date: selectedLead.next_follow_up_date ?? "", financing_type: selectedLead.financing_type ?? "ไม่ระบุ", urgency: selectedLead.urgency ?? "ปกติ", delivery_date: selectedLead.delivery_date ?? "", contract_price: selectedLead.contract_price ? String(selectedLead.contract_price) : "", contract_signed_date: selectedLead.contract_signed_date ?? "", loan_approved_date: selectedLead.loan_approved_date ?? "" }); setShowModal(true); setSelectedLead(null); }}
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
                  <FileText size={12} /> ใบจอง/สัญญา
                </button>
              )}
            </div>

            <p className="text-xs text-aviva-secondary">เปลี่ยนสถานะ:</p>
            <div className="grid grid-cols-2 gap-2">
              {pipelineStages.map((stage) => (
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

      {/* Map Plot Detail Modal */}
      {mapPlotModal !== null && (() => {
        const n = mapPlotModal;
        const house = houses.find(h => h.plot_number === n);
        const bookedLead = leads.find(l => l.plot_number === n && BOOKING_STATUSES.includes(l.status));
        const isSold = house?.status === "sold" || house?.status === "completed" || leads.some(l => l.plot_number === n && l.status === "Closed Deal");
        const isBooked = !!bookedLead && !isSold;
        const interestedLeads = leads.filter(l => l.plot_number === n && !BOOKING_STATUSES.includes(l.status)).sort((a, b) => b.ai_score - a.ai_score);
        const displayLead = isSold ? leads.find(l => l.plot_number === n && l.status === "Closed Deal") : bookedLead;
        const STATUS_TH_MAP: Record<string, string> = { "New Lead": "ลีดใหม่", Contacted: "ติดต่อแล้ว", Interested: "สนใจ", Booking: "จอง", "Loan Process": "กำลังกู้", "Closed Deal": "ปิดการขาย" };
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
                  <div className={`rounded-2xl p-4 border ${isSold ? "bg-aviva-gold/10 border-aviva-gold/30" : "bg-orange-500/10 border-orange-500/30"}`}>
                    <p className="text-[10px] text-aviva-secondary mb-1">{isSold ? "โอนกรรมสิทธิ์แล้ว" : "จองแล้ว"}</p>
                    <p className="text-base font-bold text-aviva-text">{displayLead.customer_name}</p>
                    <p className="text-sm text-aviva-gold font-medium mt-0.5">{displayLead.phone}</p>
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
                    ดูข้อมูลเต็ม / เปลี่ยนสถานะ →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-3 text-center">
                    <p className="text-sm font-bold text-green-400">ว่าง — พร้อมขาย</p>
                    {house?.status === "under_construction" || house?.status === "in_progress" ? (
                      <p className="text-[10px] text-yellow-400 mt-0.5">อยู่ระหว่างก่อสร้าง</p>
                    ) : null}
                  </div>
                  {interestedLeads.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-aviva-secondary mb-2">ผู้สนใจแปลงนี้ ({interestedLeads.length} ราย)</p>
                      <div className="space-y-1.5">
                        {interestedLeads.slice(0, 5).map((l, idx) => (
                          <button key={l.id} onClick={() => { setSelectedLead(l); setMapPlotModal(null); }}
                            className="w-full flex items-center justify-between bg-aviva-bg rounded-xl px-3 py-2 text-left hover:bg-aviva-gold/5">
                            <div>
                              <span className="text-[10px] text-aviva-secondary/50 mr-1.5">#{idx + 1}</span>
                              <span className="text-xs font-medium text-aviva-text">{l.customer_name}</span>
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
            .select("log_type,customer_name,note")
            .eq("project_id", PROJECT_ID)
            .gte("created_at", today);
          (logs ?? []).forEach((l: { log_type: string; customer_name: string; note: string }) => {
            const typeLabel: Record<string, string> = { call: "โทรหา", visit: "รับลูกค้า", followup: "ติดตาม", note: "บันทึก" };
            items.push({ category: "activity", description: `${typeLabel[l.log_type] ?? l.log_type}: ${l.customer_name}${l.note ? ` — ${l.note}` : ""}` });
          });
          const { data: acts } = await supabase
            .from("sales_activities")
            .select("activity_type,description")
            .eq("project_id", PROJECT_ID)
            .gte("created_at", today);
          (acts ?? []).forEach((a: { activity_type: string; description: string }) => {
            items.push({ category: "activity", description: `${a.activity_type}: ${a.description}` });
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
