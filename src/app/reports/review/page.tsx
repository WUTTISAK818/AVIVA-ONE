"use client";
import { useState, useEffect } from "react";
import {
  Users, ClipboardList, CheckCircle, AlertTriangle, Clock, Eye, X,
  ChevronLeft, ChevronRight, MapPin, UserX, Printer, ChevronDown, ChevronUp,
  MessageSquare,
} from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  activity:    { label: "กิจกรรม",       color: "text-blue-400" },
  achievement: { label: "ผลสำเร็จ",      color: "text-green-400" },
  issue:       { label: "ปัญหา/อุปสรรค", color: "text-red-400" },
  plan:        { label: "แผนงานพรุ่งนี้",  color: "text-yellow-400" },
};

interface WReport {
  id: string;
  user_email: string;
  employee_name: string;
  department: string;
  report_date: string;
  status: string;
  summary: string;
  work_location?: string;
  submitted_at?: string;
  late_reason?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  manager_comment?: string;
}

interface WeekStat {
  date: string;
  submitted: number;
  late: number;
  total: number;
}

interface WItem {
  id: string;
  report_id?: string;
  category: string;
  description: string;
  source: string;
}

interface ConstructionReport {
  house_number: string;
  contractor: string;
  work_detail: string;
  work_type: string | null;
  progress: number;
  issue: string;
  photo_url: string | null;
}

interface DailySummaryReport {
  employee_name: string;
  work_detail: string;
  photo_url: string | null;
  submitted_at: string;
}

interface Employee {
  id: string;
  full_name: string;
  department: string;
  email: string;
}

const STATUS_COLOR: Record<string, string> = {
  submitted: "text-green-400",
  late:      "text-orange-400",
  draft:     "text-aviva-secondary",
};
const STATUS_LABEL: Record<string, string> = {
  submitted: "ส่งแล้ว",
  late:      "ส่งล่าช้า",
  draft:     "ยังไม่ส่ง",
};
const STATUS_BG: Record<string, string> = {
  submitted: "bg-green-500/10 border-green-500/20",
  late:      "bg-orange-500/10 border-orange-500/20",
  draft:     "bg-aviva-bg/50 border-aviva-gold/10",
};

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export default function ReportsReviewPage() {
  const user = useCurrentUser();
  const today = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [reports, setReports]           = useState<WReport[]>([]);
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [selectedDept, setSelectedDept] = useState("ทั้งหมด");
  const [selected, setSelected]         = useState<WReport | null>(null);
  const [selItems, setSelItems]         = useState<WItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [weekStats, setWeekStats]       = useState<WeekStat[]>([]);
  const [commentText, setCommentText]   = useState("");
  const [showMissing, setShowMissing]   = useState(false);

  const canAccess = user?.isManager || user?.isAdmin;

  useEffect(() => {
    if (!canAccess) return;
    supabase
      .from("work_reports")
      .select("report_date")
      .eq("report_type", "daily")
      .in("status", ["submitted", "late"])
      .order("report_date", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setSelectedDate(data[0].report_date);
      });
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    supabase
      .from("employees")
      .select("id, full_name, department, email")
      .eq("status", "active")
      .order("department")
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as Employee[]));
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    setLoading(true);
    supabase
      .from("work_reports")
      .select("*")
      .eq("report_date", selectedDate)
      .eq("report_type", "daily")
      .order("department")
      .order("employee_name")
      .then(({ data }) => {
        setReports((data ?? []) as WReport[]);
        setLoading(false);
      });
  }, [canAccess, selectedDate]);

  useEffect(() => {
    if (!canAccess) return;
    const endD = selectedDate <= today ? selectedDate : today;
    const sevenDaysAgo = addDays(endD, -6);
    supabase
      .from("work_reports")
      .select("report_date, status")
      .gte("report_date", sevenDaysAgo)
      .lte("report_date", endD)
      .eq("report_type", "daily")
      .then(({ data }) => {
        const byDate: Record<string, { submitted: number; late: number; total: number }> = {};
        (data ?? []).forEach((r: { report_date: string; status: string }) => {
          if (!byDate[r.report_date]) byDate[r.report_date] = { submitted: 0, late: 0, total: 0 };
          byDate[r.report_date].total++;
          if (r.status === "submitted") byDate[r.report_date].submitted++;
          if (r.status === "late") { byDate[r.report_date].submitted++; byDate[r.report_date].late++; }
        });
        const result: WeekStat[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = addDays(endD, -i);
          result.push({ date: d, ...(byDate[d] ?? { submitted: 0, late: 0, total: 0 }) });
        }
        setWeekStats(result);
      });
  }, [canAccess, selectedDate]);

  async function openReport(r: WReport) {
    setSelected(r);
    setCommentText("");
    const { data } = await supabase
      .from("work_report_items")
      .select("*")
      .eq("report_id", r.id)
      .order("created_at");
    setSelItems((data ?? []) as WItem[]);
  }

  async function acknowledge() {
    if (!selected || !user) return;
    setAcknowledging(true);
    const { data } = await supabase
      .from("work_reports")
      .update({
        acknowledged_by: user.full_name ?? user.email,
        acknowledged_at: new Date().toISOString(),
        manager_comment: commentText.trim() || null,
      })
      .eq("id", selected.id)
      .select()
      .single();
    if (data) {
      setSelected(data as WReport);
      setReports(prev => prev.map(r => r.id === selected.id ? data as WReport : r));
    }
    setAcknowledging(false);
  }

  const submittedEmails = new Set(
    reports.filter(r => r.status === "submitted" || r.status === "late").map(r => r.user_email)
  );
  const missingEmployees = employees.filter(e => !submittedEmails.has(e.email));
  const departments = ["ทั้งหมด", ...Array.from(new Set(employees.map(e => e.department).filter(Boolean)))];
  const filteredReports = selectedDept === "ทั้งหมด"
    ? reports
    : reports.filter(r => r.department === selectedDept);

  const submitted   = reports.filter(r => r.status === "submitted" || r.status === "late");
  const late        = reports.filter(r => r.status === "late");
  const totalActive = employees.length > 0 ? employees.length : reports.length;
  const submitPct   = totalActive > 0 ? Math.round(submitted.length / totalActive * 100) : 0;

  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const A4_BASE_CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Tahoma','Arial',sans-serif;font-size:13px;color:#111;background:#fff}
    @page{size:A4;margin:15mm 18mm}
    .toolbar{position:fixed;top:0;left:0;right:0;background:#0D2B1E;padding:10px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.35);z-index:99}
    .toolbar-title{color:#D4AF37;font-weight:700;font-size:14px;flex:1}
    .btn-print{background:#D4AF37;color:#0D2B1E;border:none;padding:7px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}
    .btn-close{background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer}
    .content{margin-top:52px;padding:12px 0}
    @media print{.toolbar{display:none!important}.content{margin-top:0!important;padding:0!important}}
  `;

  function popupWrite(win: Window, title: string, bodyHtml: string) {
    const toolbar = `<div class="toolbar"><span class="toolbar-title">AVIVA ONE — ${title}</span><button class="btn-print" onclick="window.print()">🖨️ พิมพ์</button><button class="btn-close" onclick="window.close()">✕ ปิด</button></div>`;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${A4_BASE_CSS}</style></head><body>${toolbar}<div class="content">${bodyHtml}</div></body></html>`);
    win.document.close();
    win.focus();
  }

  function printSummary() {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = reports.map(r => `
      <tr>
        <td>${r.employee_name}</td>
        <td>${r.department}</td>
        <td style="color:${r.status === "submitted" ? "green" : r.status === "late" ? "orange" : "#888"}">
          ${STATUS_LABEL[r.status] ?? r.status}
        </td>
        <td>${r.submitted_at ? new Date(r.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
        <td>${r.summary ?? "-"}</td>
        <td>${r.acknowledged_by ?? "-"}</td>
      </tr>`).join("");
    const missingRows = missingEmployees.map(e => `
      <tr style="background:#fff8f8">
        <td>${e.full_name}</td><td>${e.department}</td>
        <td style="color:red">ยังไม่ส่ง</td>
        <td>-</td><td>-</td><td>-</td>
      </tr>`).join("");
    const body = `
      <div style="padding:28px">
        <h1 style="font-size:17px;font-weight:700;margin-bottom:2px">รายงานการปฏิบัติงานประจำวัน — โครงการ AVIVA ONE</h1>
        <div style="color:#666;font-size:11px;margin-bottom:18px">${displayDate}</div>
        <div style="display:flex;gap:14px;margin-bottom:18px">
          <div style="flex:1;background:#f6f6f6;border-radius:8px;padding:10px 14px;text-align:center"><div style="font-size:22px;font-weight:700">${totalActive}</div><div>พนักงานทั้งหมด</div></div>
          <div style="flex:1;background:#f6f6f6;border-radius:8px;padding:10px 14px;text-align:center;color:green"><div style="font-size:22px;font-weight:700">${submitted.length}</div><div>ส่งแล้ว (${submitPct}%)</div></div>
          <div style="flex:1;background:#f6f6f6;border-radius:8px;padding:10px 14px;text-align:center;color:orange"><div style="font-size:22px;font-weight:700">${late.length}</div><div>ส่งล่าช้า</div></div>
          <div style="flex:1;background:#f6f6f6;border-radius:8px;padding:10px 14px;text-align:center;color:red"><div style="font-size:22px;font-weight:700">${missingEmployees.length}</div><div>ยังไม่ส่ง</div></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr><th style="background:#0D2B1E;color:#D4AF37;padding:7px 9px;text-align:left;font-size:11px">ชื่อพนักงาน</th><th style="background:#0D2B1E;color:#D4AF37;padding:7px 9px;text-align:left;font-size:11px">ฝ่าย</th><th style="background:#0D2B1E;color:#D4AF37;padding:7px 9px;text-align:left;font-size:11px">สถานะ</th><th style="background:#0D2B1E;color:#D4AF37;padding:7px 9px;text-align:left;font-size:11px">เวลาส่ง</th><th style="background:#0D2B1E;color:#D4AF37;padding:7px 9px;text-align:left;font-size:11px">สรุปงาน</th><th style="background:#0D2B1E;color:#D4AF37;padding:7px 9px;text-align:left;font-size:11px">รับทราบโดย</th></tr></thead>
          <tbody>${rows}${missingRows}</tbody>
        </table>
        <div style="margin-top:18px;font-size:10px;color:#aaa">พิมพ์โดย: ${user?.full_name ?? ""} · ${new Date().toLocaleString("th-TH")}</div>
      </div>`;
    popupWrite(win, `รายงานประจำวัน ${selectedDate}`, body);
  }

  function buildA4PageHTML(r: WReport, items: WItem[], dateLabel: string, constRpts?: ConstructionReport[], dailySummaryPhotoUrl?: string | null): string {
    const CAT_MAP: Record<string, { label: string; bg: string; color: string }> = {
      activity:    { label: "กิจกรรม",        bg: "#dbeafe", color: "#1d4ed8" },
      achievement: { label: "ผลสำเร็จ",       bg: "#dcfce7", color: "#166534" },
      issue:       { label: "ปัญหา/อุปสรรค",  bg: "#fee2e2", color: "#991b1b" },
      plan:        { label: "แผนงานพรุ่งนี้",  bg: "#fef9c3", color: "#854d0e" },
    };
    const byCategory: Record<string, WItem[]> = {};
    items.forEach(i => { (byCategory[i.category] ??= []).push(i); });
    const catSections = (["activity", "achievement", "issue", "plan"] as const).map(cat => {
      const its = byCategory[cat] ?? [];
      if (!its.length) return "";
      const cfg = CAT_MAP[cat];
      return `<div style="margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;background:${cfg.bg};color:${cfg.color};padding:2px 7px;border-radius:4px;display:inline-block;margin-bottom:5px">${cfg.label} (${its.length})</span>
        <ul style="padding-left:18px">${its.map(i => `<li style="font-size:12.5px;line-height:1.7;margin-bottom:2px">${i.description}</li>`).join("")}</ul>
      </div>`;
    }).join("");
    const statusText = r.status === "submitted" ? "ส่งตรงเวลา ✓" : r.status === "late" ? "ส่งล่าช้า" : "แบบร่าง";
    const submitTime = r.submitted_at
      ? new Date(r.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น."
      : "-";
    return `
      <div style="text-align:center;border-bottom:2px solid #0D2B1E;padding-bottom:10px;margin-bottom:14px">
        <div style="font-size:22px;font-weight:700;color:#0D2B1E;letter-spacing:3px">AVIVA ONE</div>
        <div style="font-size:14px;font-weight:600;color:#444;margin-top:3px">รายงานการปฏิบัติงานประจำวัน</div>
        <div style="font-size:12px;color:#888;margin-top:2px">${dateLabel}</div>
      </div>
      <div style="background:#f5f5f0;border-radius:8px;padding:12px 16px;margin-bottom:14px;border-left:4px solid #C9A84C">
        <div style="font-size:17px;font-weight:700;color:#111;margin-bottom:6px">${r.employee_name}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px 20px;font-size:12px;color:#444">
          <span>ฝ่าย: <strong>${r.department}</strong></span>
          <span>สถานที่: <strong>${r.work_location ?? "ไม่ระบุ"}</strong></span>
          <span>สถานะ: <strong>${statusText}</strong></span>
          <span>เวลาส่ง: <strong>${submitTime}</strong></span>
        </div>
      </div>
      ${r.summary ? `<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px">สรุปภาพรวม</div><p style="font-size:13px;line-height:1.8">${r.summary}</p></div>` : ""}
      ${catSections ? `<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px">รายการกิจกรรม</div>${catSections}</div>` : `<p style="font-size:12px;color:#aaa;font-style:italic;margin-bottom:14px">ไม่มีรายการกิจกรรม</p>`}
      ${r.late_reason ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 12px;font-size:12px;color:#9a3412;margin-bottom:12px">เหตุผลที่ส่งล่าช้า: ${r.late_reason}</div>` : ""}
      ${dailySummaryPhotoUrl ? `
        <div style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px">รูปภาพสรุปประจำวัน</div>
          <img src="${dailySummaryPhotoUrl}" style="max-width:100%;max-height:300px;width:100%;object-fit:contain;border-radius:6px;border:1px solid #ddd;display:block" />
        </div>` : ""}
      ${(constRpts && constRpts.length > 0) ? `
        <div style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px">รายงานการตรวจงานก่อสร้าง (${constRpts.length} รายการ)</div>
          ${constRpts.map(cr => `
            <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;margin-bottom:8px;page-break-inside:avoid">
              <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
                <span style="font-size:13px;font-weight:700;color:#111">${cr.house_number}</span>
                <span style="font-size:11px;color:#555">ผู้รับเหมา: <strong style="color:#1d4ed8">${cr.contractor || "ไม่ระบุ"}</strong></span>
              </div>
              ${cr.work_type ? `<div style="font-size:11px;color:#666;margin-bottom:3px">ประเภทงาน: ${cr.work_type}</div>` : ""}
              <div style="font-size:12.5px;color:#111;line-height:1.6;margin-bottom:4px">${cr.work_detail}</div>
              <div style="font-size:11px;color:#555">ความคืบหน้า: <strong>${cr.progress}%</strong></div>
              ${cr.issue ? `<div style="font-size:11px;color:#c0392b;margin-top:4px">⚠ ${cr.issue}</div>` : ""}
              ${cr.photo_url ? `<div style="margin-top:8px"><img src="${cr.photo_url}" style="max-width:240px;max-height:160px;width:100%;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block" /></div>` : ""}
            </div>
          `).join("")}
        </div>` : ""}
      <div style="display:flex;gap:30px;margin-top:30px;margin-bottom:12px">
        <div style="flex:1;text-align:center;font-size:11px;color:#555">
          <div style="height:1px;background:#999;margin-bottom:5px"></div>
          <div>ลายมือชื่อพนักงาน</div>
          <div style="color:#444;margin-top:3px">(${r.employee_name})</div>
        </div>
        <div style="flex:1;text-align:center;font-size:11px;color:#555">
          <div style="height:1px;background:#999;margin-bottom:5px"></div>
          <div>ลายมือชื่อผู้บังคับบัญชา</div>
          <div style="color:#444;margin-top:3px">${r.acknowledged_by ? `(${r.acknowledged_by})` : "(..................................)"}` + `</div>
        </div>
      </div>
      ${r.acknowledged_by ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px 12px;font-size:11px;color:#166534;text-align:center">✓ ผู้บริหารรับทราบแล้ว: ${r.acknowledged_by}</div>` : ""}
    `;
  }

  async function printDetailedA4() {
    const reportsToShow = reports.filter(r => r.status === "submitted" || r.status === "late");
    if (reportsToShow.length === 0) return;
    const reportIds = reportsToShow.map(r => r.id);
    const { data: allItems } = await supabase
      .from("work_report_items").select("*").in("report_id", reportIds).order("created_at");
    const itemsByReport: Record<string, WItem[]> = {};
    (allItems ?? []).forEach((item: WItem) => { (itemsByReport[item.report_id!] ??= []).push(item); });

    const constByName: Record<string, ConstructionReport[]> = {};
    const summaryPhotoByName: Record<string, string | null> = {};
    const hasConstruction = reportsToShow.some(r => r.department === "ฝ่ายก่อสร้าง");
    if (hasConstruction) {
      const { data: constRaw } = await supabase
        .from("construction_reports")
        .select("work_detail, work_type, progress, issue, photo_url, reported_by, houses!inner(house_number, contractor)")
        .gte("created_at", selectedDate + "T00:00:00")
        .lte("created_at", selectedDate + "T23:59:59");
      (constRaw ?? []).forEach((cr: Record<string, unknown>) => {
        const name = cr.reported_by as string | null;
        if (!name) return;
        const workType = cr.work_type as string | null;
        // ดึง Daily Summary Photos
        if (workType === "สรุปประจำวัน") {
          summaryPhotoByName[name] = cr.photo_url as string | null;
          return;
        }
        // ดึง Construction Reports
        const houses = cr.houses as { house_number: string; contractor: string } | null;
        (constByName[name] ??= []).push({
          house_number: houses?.house_number ?? "—",
          contractor: houses?.contractor ?? "",
          work_detail: String(cr.work_detail ?? ""),
          work_type: workType,
          progress: Number(cr.progress ?? 0),
          issue: String(cr.issue ?? ""),
          photo_url: cr.photo_url as string | null,
        });
      });
    }

    const win = window.open("", "_blank");
    if (!win) return;
    const pages = reportsToShow.map((r, idx) => {
      const constRpts = r.department === "ฝ่ายก่อสร้าง" ? (constByName[r.employee_name] ?? []) : undefined;
      const summaryPhoto = r.department === "ฝ่ายก่อสร้าง" ? summaryPhotoByName[r.employee_name] : undefined;
      return `<div ${idx > 0 ? 'style="page-break-before:always"' : ""}>${buildA4PageHTML(r, itemsByReport[r.id] ?? [], displayDate, constRpts, summaryPhoto)}</div>`;
    }).join("");
    popupWrite(win, `รายงาน A4 รายบุคคล — ${selectedDate}`, pages);
  }

  async function printSingleA4() {
    if (!selected) return;
    const win = window.open("", "_blank");
    if (!win) return;

    let constRpts: ConstructionReport[] | undefined;
    let summaryPhoto: string | null | undefined;
    if (selected.department === "ฝ่ายก่อสร้าง") {
      const { data: constRaw } = await supabase
        .from("construction_reports")
        .select("work_detail, work_type, progress, issue, photo_url, reported_by, houses!inner(house_number, contractor)")
        .eq("reported_by", selected.employee_name)
        .gte("created_at", selected.report_date + "T00:00:00")
        .lte("created_at", selected.report_date + "T23:59:59");
      constRpts = [];
      (constRaw ?? []).forEach((cr: Record<string, unknown>) => {
        const workType = cr.work_type as string | null;
        // ดึง Daily Summary Photo
        if (workType === "สรุปประจำวัน") {
          summaryPhoto = cr.photo_url as string | null;
          return;
        }
        // ดึง Construction Reports
        const houses = cr.houses as { house_number: string; contractor: string } | null;
        constRpts!.push({
          house_number: houses?.house_number ?? "—",
          contractor: houses?.contractor ?? "",
          work_detail: String(cr.work_detail ?? ""),
          work_type: workType,
          progress: Number(cr.progress ?? 0),
          issue: String(cr.issue ?? ""),
          photo_url: cr.photo_url as string | null,
        });
      });
    }

    popupWrite(win, `รายงาน — ${selected.employee_name}`, buildA4PageHTML(selected, selItems, displayDate, constRpts, summaryPhoto));
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center px-4">
        <GlassCard className="p-6 text-center">
          <p className="text-aviva-secondary text-sm">เฉพาะผู้จัดการและผู้ดูแลระบบ</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">

      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">รายงานทีมงาน</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printSummary}
              className="flex items-center gap-1.5 text-xs font-semibold text-aviva-secondary bg-aviva-bg border border-aviva-gold/20 px-3 py-1.5 rounded-xl">
              <Printer size={12} /> สรุป
            </button>
            <button onClick={printDetailedA4}
              disabled={submitted.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-3 py-1.5 rounded-xl disabled:opacity-40">
              <Printer size={12} /> A4 ครบ
            </button>
            <a href="/reports/audit"
              className="flex items-center gap-1.5 text-xs font-semibold text-aviva-secondary bg-aviva-bg border border-aviva-gold/20 px-3 py-1.5 rounded-xl">
              <Eye size={12} /> Audit
            </a>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">

        {weekStats.length > 0 && (
          <GlassCard className="p-3">
            <p className="text-[10px] text-aviva-secondary/70 uppercase tracking-wider mb-2">ภาพรวม 7 วันย้อนหลัง</p>
            <div className="grid grid-cols-7 gap-1">
              {weekStats.map(ws => {
                const isSelected = ws.date === selectedDate;
                const dayLabel = new Date(ws.date + "T12:00:00").toLocaleDateString("th-TH", { weekday: "short" }).slice(0, 2);
                const dayNum   = new Date(ws.date + "T12:00:00").getDate();
                const allGood  = ws.total > 0 && ws.submitted === ws.total && ws.late === 0;
                const hasLate  = ws.late > 0;
                const hasMiss  = ws.total > 0 && ws.submitted < ws.total;
                const noData   = ws.total === 0;
                const dotColor = noData ? "bg-aviva-secondary/20" : allGood ? "bg-green-500" : hasLate ? "bg-orange-400" : hasMiss ? "bg-red-400" : "bg-green-500";
                return (
                  <button key={ws.date} onClick={() => setSelectedDate(ws.date)}
                    className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all ${isSelected ? "bg-aviva-gold/15 border border-aviva-gold" : "border border-transparent hover:bg-aviva-bg/50"}`}>
                    <span className={`text-[9px] font-semibold ${isSelected ? "text-aviva-gold" : "text-aviva-secondary/60"}`}>{dayLabel}</span>
                    <span className={`text-xs font-bold ${isSelected ? "text-aviva-gold" : "text-aviva-text"}`}>{dayNum}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {ws.total > 0 && (
                      <span className={`text-[8px] font-semibold ${isSelected ? "text-aviva-gold/70" : "text-aviva-secondary/50"}`}>
                        {ws.submitted}/{ws.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-aviva-gold/10">
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /><span className="text-[9px] text-aviva-secondary/50">ส่งครบ</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /><span className="text-[9px] text-aviva-secondary/50">มีล่าช้า</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /><span className="text-[9px] text-aviva-secondary/50">ยังไม่ส่ง</span></div>
            </div>
          </GlassCard>
        )}

        <GlassCard className="p-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-2 rounded-xl hover:bg-aviva-gold/10 text-aviva-secondary">
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 text-center">
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-aviva-text text-center focus:outline-none" />
              <p className="text-[10px] text-aviva-secondary/60">{displayDate}</p>
            </div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={selectedDate >= today}
              className="p-2 rounded-xl hover:bg-aviva-gold/10 text-aviva-secondary disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        </GlassCard>

        <div className="grid grid-cols-4 gap-2">
          <GlassCard className="p-3 text-center">
            <p className="text-xl font-bold text-aviva-text">{totalActive}</p>
            <p className="text-[9px] text-aviva-secondary leading-snug mt-0.5">พนักงาน<br/>ทั้งหมด</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <CheckCircle size={13} className="text-green-400 mx-auto mb-0.5" />
            <p className="text-xl font-bold text-green-400">{submitted.length}</p>
            <p className="text-[9px] text-aviva-secondary">{submitPct}%</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <AlertTriangle size={13} className="text-orange-400 mx-auto mb-0.5" />
            <p className="text-xl font-bold text-orange-400">{late.length}</p>
            <p className="text-[9px] text-aviva-secondary">ล่าช้า</p>
          </GlassCard>
          <GlassCard className={`p-3 text-center ${missingEmployees.length > 0 ? "border border-red-500/20" : ""}`}>
            <UserX size={13} className={`mx-auto mb-0.5 ${missingEmployees.length > 0 ? "text-red-400" : "text-aviva-secondary/30"}`} />
            <p className={`text-xl font-bold ${missingEmployees.length > 0 ? "text-red-400" : "text-aviva-secondary/40"}`}>{missingEmployees.length}</p>
            <p className="text-[9px] text-aviva-secondary">ไม่ส่ง</p>
          </GlassCard>
        </div>

        {departments.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {departments.map(dept => (
              <button key={dept} onClick={() => setSelectedDept(dept)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  selectedDept === dept
                    ? "bg-aviva-gold/15 border-aviva-gold text-aviva-gold font-semibold"
                    : "bg-aviva-bg/50 border-aviva-gold/20 text-aviva-secondary"
                }`}>
                {dept}
              </button>
            ))}
          </div>
        )}

        {missingEmployees.length > 0 && (
          <GlassCard className="overflow-hidden border-red-500/15">
            <button onClick={() => setShowMissing(m => !m)}
              className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <UserX size={14} className="text-red-400" />
                <span className="text-sm font-semibold text-red-400">
                  ยังไม่ส่งรายงาน {missingEmployees.length} คน
                </span>
              </div>
              {showMissing
                ? <ChevronUp size={14} className="text-aviva-secondary" />
                : <ChevronDown size={14} className="text-aviva-secondary" />}
            </button>
            {showMissing && (
              <div className="border-t border-red-500/10 divide-y divide-aviva-gold/5">
                {missingEmployees.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-aviva-text">{e.full_name}</p>
                      <p className="text-[10px] text-aviva-secondary">{e.department}</p>
                    </div>
                    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                      ยังไม่ส่ง
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card animate-pulse" />)
        ) : filteredReports.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <ClipboardList size={24} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-sm text-aviva-secondary">ยังไม่มีรายงานในวันที่เลือก</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {filteredReports.map(r => (
              <button key={r.id} onClick={() => openReport(r)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border hover:border-aviva-gold/30 transition-all active:scale-[0.98] text-left ${STATUS_BG[r.status] ?? "bg-aviva-card border-aviva-gold/10"}`}>
                <div className="w-9 h-9 rounded-full bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-aviva-gold">{(r.employee_name ?? "?").charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-aviva-text truncate">{r.employee_name}</p>
                  <p className="text-[10px] text-aviva-secondary">{r.department}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={`text-xs font-bold ${STATUS_COLOR[r.status] ?? "text-aviva-secondary"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </p>
                  {r.submitted_at && (
                    <p className="text-[10px] text-aviva-secondary/60">
                      {new Date(r.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                    </p>
                  )}
                  {r.acknowledged_by && (
                    <p className="text-[9px] text-green-400/70">✓ รับทราบ</p>
                  )}
                </div>
                <Eye size={14} className="text-aviva-secondary/30 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[90vh] flex flex-col">

            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    selected.status === "submitted" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                    selected.status === "late"      ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
                    "bg-aviva-bg/50 border-aviva-gold/10 text-aviva-secondary"
                  }`}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                  {selected.acknowledged_by && (
                    <span className="text-[10px] text-green-400/80 font-semibold">✓ รับทราบแล้ว</span>
                  )}
                </div>
                <h2 className="text-base font-bold text-aviva-text truncate">{selected.employee_name}</h2>
                <p className="text-xs text-aviva-secondary">
                  {selected.department} · {new Date(selected.report_date + "T12:00:00").toLocaleDateString("th-TH", {
                    weekday: "short", day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
                {selected.submitted_at && (
                  <p className="text-[10px] text-aviva-secondary/50 mt-0.5 flex items-center gap-1">
                    <Clock size={9} />
                    ส่งเมื่อ {new Date(selected.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {(selected.status === "submitted" || selected.status === "late") && (
                  <button onClick={printSingleA4}
                    className="flex items-center gap-1 text-[10px] font-semibold text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-2 py-1 rounded-lg">
                    <Printer size={11} /> A4
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="p-1">
                  <X size={20} className="text-aviva-secondary" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">

              {selected.work_location && (
                <div className="flex items-center gap-2 bg-aviva-gold/5 rounded-xl px-3 py-2 border border-aviva-gold/15">
                  <MapPin size={12} className="text-aviva-gold flex-shrink-0" />
                  <p className="text-xs text-aviva-text">{selected.work_location}</p>
                </div>
              )}

              {selected.summary && (
                <div className="bg-aviva-bg/50 rounded-xl p-3">
                  <p className="text-[10px] text-aviva-secondary uppercase tracking-wider font-semibold mb-1.5">สรุปภาพรวม</p>
                  <p className="text-sm text-aviva-text leading-relaxed">{selected.summary}</p>
                </div>
              )}

              {selected.late_reason && (
                <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
                  <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-1">เหตุผลที่ส่งล่าช้า</p>
                  <p className="text-xs text-aviva-text">{selected.late_reason}</p>
                </div>
              )}

              {(["activity", "achievement", "issue", "plan"] as const).map(cat => {
                const catItems = selItems.filter(i => i.category === cat);
                if (catItems.length === 0) return null;
                const cfg = CATEGORY_LABELS[cat];
                return (
                  <div key={cat}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${cfg.color}`}>
                      {cfg.label} ({catItems.length})
                    </p>
                    <div className="space-y-1.5">
                      {catItems.map((item, i) => (
                        <div key={i} className="bg-aviva-bg/50 rounded-xl px-3 py-2.5">
                          <p className="text-xs text-aviva-text leading-relaxed">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {selItems.length === 0 && (
                <p className="text-xs text-aviva-secondary/50 text-center py-4">ยังไม่มีรายการกิจกรรม</p>
              )}

              {selected.acknowledged_by && (
                <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                    <p className="text-xs font-bold text-green-400">รับทราบโดย {selected.acknowledged_by}</p>
                  </div>
                  {selected.acknowledged_at && (
                    <p className="text-[10px] text-aviva-secondary/60 ml-5">
                      {new Date(selected.acknowledged_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  )}
                  {selected.manager_comment && (
                    <div className="mt-2 ml-5 pl-3 border-l-2 border-green-500/30">
                      <p className="text-[10px] text-aviva-secondary uppercase tracking-wider mb-0.5">ความเห็นผู้จัดการ</p>
                      <p className="text-xs text-aviva-text leading-relaxed">{selected.manager_comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!selected.acknowledged_by && (selected.status === "submitted" || selected.status === "late") && (
              <div className="mt-4 pt-4 border-t border-aviva-gold/10 space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageSquare size={12} className="text-aviva-secondary" />
                    <p className="text-[10px] text-aviva-secondary uppercase tracking-wider">
                      ความเห็น / คำแนะนำสำหรับพนักงาน (ไม่บังคับ)
                    </p>
                  </div>
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    rows={2}
                    placeholder="เช่น ดีมาก, ปรับปรุงเรื่อง..., โปรดระวัง..."
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text resize-none focus:outline-none focus:border-aviva-gold/50 placeholder:text-aviva-secondary/30"
                  />
                </div>
                <button onClick={acknowledge} disabled={acknowledging}
                  className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <CheckCircle size={14} />
                  {acknowledging ? "กำลังบันทึก..." : "รับทราบรายงานนี้"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
