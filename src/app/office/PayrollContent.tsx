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
import { Employee, PayrollEmployee } from "./_shared";

export default function PayrollContent() {
  const user = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => thaiMonthStr());
  const [payslipEmp, setPayslipEmp] = useState<PayrollEmployee | null>(null);
  // UX-04: persist รายได้พิเศษไว้ใน sessionStorage กันหายเมื่อสลับแท็บ (PayrollContent unmount/remount)
  const [specialIncomes, setSpecialIncomes] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(sessionStorage.getItem("aviva_special_incomes") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { sessionStorage.setItem("aviva_special_incomes", JSON.stringify(specialIncomes)); } catch { /* ignore */ }
  }, [specialIncomes]);

  useEffect(() => {
    supabase.from("employees").select("*").eq("status", "active")
      .order("department").limit(300)
      .then(({ data }) => { setEmployees((data as Employee[]) ?? []); setLoading(false); });
  }, []);

  const calcSSO = (base: number) => Math.min(base * 0.05, 750);
  const calcCommission = (emp: Employee) => Math.round((emp.base_salary * (emp.commission_rate ?? 0)) / 100);

  const calcIncomeTax = (annual: number): number => {
    if (annual <= 150000) return 0;
    let tax = 0;
    const brackets: [number, number, number][] = [
      [150001, 300000, 0.05],
      [300001, 500000, 0.10],
      [500001, 750000, 0.15],
      [750001, 1000000, 0.20],
      [1000001, 2000000, 0.25],
      [2000001, Infinity, 0.35],
    ];
    for (const [lo, hi, rate] of brackets) {
      if (annual < lo) break;
      tax += (Math.min(annual, hi) - lo) * rate;
    }
    return Math.round(tax / 12);
  };

  const calcPayroll = (emp: Employee): PayrollEmployee => {
    const special = parseFloat(specialIncomes[emp.id] ?? "0") || 0;
    const commission = calcCommission(emp);
    const sso = calcSSO(emp.base_salary);
    const gross = emp.base_salary + commission + special;
    const tax = calcIncomeTax(gross * 12);
    return { ...emp, commission_amount: commission, sso, tax, net: gross - sso - tax };
  };

  const totalNetPayroll = employees.reduce((sum, emp) => sum + (calcPayroll(emp).net ?? 0), 0);

  const printPayslip = (pr: PayrollEmployee) => {
    const special = parseFloat(specialIncomes[pr.id] ?? "0") || 0;
    const monthDisplay = new Date(month + "-01").toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
      <title>สลิปเงินเดือน — ${pr.full_name}</title>
      <style>
        body{font-family:'IBM Plex Sans Thai','Noto Sans Thai',Arial,sans-serif;margin:0;padding:40px;color:#222;font-size:14px;max-width:600px;margin:0 auto}
        .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #D4AF37;padding-bottom:16px}
        .logo{font-size:24px;font-weight:bold;letter-spacing:4px;color:#1E4A35}
        .sub{font-size:13px;color:#666;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        td{padding:8px 0;border-bottom:1px solid #eee;font-size:13px}
        td:last-child{text-align:right;font-weight:600}
        .section-title{background:#f9f7f0;font-weight:bold;color:#1E4A35;padding:8px 12px;margin:-1px -0px;font-size:12px;text-transform:uppercase;letter-spacing:1px}
        .total-row td{border-top:2px solid #D4AF37;border-bottom:none;color:#D4AF37;font-size:16px;font-weight:bold;padding-top:12px}
        .deduct{color:#e53e3e}
        .footer{text-align:center;margin-top:24px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px}
        .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px}
        .sign-box{text-align:center;border-top:1px solid #ccc;padding-top:8px;font-size:12px;color:#666}
        .btns{position:fixed;top:16px;right:16px;display:flex;gap:8px}.btn{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-weight:600}.btn-p{background:#1E4A35;color:#D4AF37}.btn-c{background:#eee;color:#333}
        @media print{body{padding:10px}.btns{display:none!important}}
      </style></head><body>
      <div class="header">
        <div class="logo">AVIVA Private</div>
        <div class="sub">สลิปเงินเดือนประจำเดือน ${monthDisplay}</div>
      </div>
      <table>
        <tr><td>ชื่อ-นามสกุล</td><td>${pr.full_name}</td></tr>
        <tr><td>ตำแหน่ง</td><td>${pr.position ?? "-"}</td></tr>
        <tr><td>แผนก</td><td>${pr.department ?? "-"}</td></tr>
        <tr><td>สถานะ</td><td>Active</td></tr>
      </table>
      <p class="section-title">รายรับ</p>
      <table>
        <tr><td>เงินเดือนพื้นฐาน</td><td>฿${pr.base_salary.toLocaleString("th-TH")}</td></tr>
        ${(pr.commission_amount ?? 0) > 0 ? `<tr><td>ค่าคอมมิชชั่น</td><td style="color:#22543d">+฿${(pr.commission_amount ?? 0).toLocaleString("th-TH")}</td></tr>` : ""}
        ${special > 0 ? `<tr><td>รายได้พิเศษ</td><td style="color:#22543d">+฿${special.toLocaleString("th-TH")}</td></tr>` : ""}
        <tr><td>รายรับรวม</td><td>฿${(pr.base_salary + (pr.commission_amount ?? 0) + special).toLocaleString("th-TH")}</td></tr>
      </table>
      <p class="section-title">รายหัก</p>
      <table>
        <tr><td class="deduct">ประกันสังคม (5%, สูงสุด ฿750)</td><td class="deduct">-฿${(pr.sso ?? 0).toLocaleString("th-TH")}</td></tr>
        <tr><td class="deduct">ภาษีเงินได้หัก ณ ที่จ่าย</td><td class="deduct">-฿${(pr.tax ?? 0).toLocaleString("th-TH")}</td></tr>
        <tr class="total-row"><td>เงินได้สุทธิ</td><td>฿${(pr.net ?? 0).toLocaleString("th-TH")}</td></tr>
      </table>
      <div class="sign">
        <div class="sign-box">ลงชื่อผู้รับเงิน<br><br>(_________________________)<br>${pr.full_name}</div>
        <div class="sign-box">ลงชื่อผู้อนุมัติ<br><br>(_________________________)<br>ผู้บริหาร</div>
      </div>
      <div class="footer">บริษัท อลิสา พร็อพเพอร์ตี้ ดีเวลลอปเม้นท์ จำกัด · เลขทะเบียน 0305564005951 · โทร 064-456-2878 · ${new Date().toLocaleDateString("th-TH")}</div>
      <div class="btns"><button class="btn btn-p" onclick="window.print()">พิมพ์</button><button class="btn btn-c" onclick="window.close()">ปิด</button></div>
      </body></html>`;
    const w = window.open("", "_blank", "width=700,height=600");
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label htmlFor="payroll-month" className="text-xs text-aviva-secondary mb-1 block">เดือนที่คำนวณ</label>
          <input id="payroll-month" type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
        </div>
        <div className="text-right mt-4">
          <p className="text-[10px] text-aviva-secondary">เงินเดือนรวมสุทธิ</p>
          <p className="text-lg font-bold text-aviva-gold">฿{totalNetPayroll.toLocaleString("th-TH")}</p>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-aviva-card/50 animate-pulse" />) :
         employees.map(emp => {
          const pr = calcPayroll(emp);
          return (
            <GlassCard key={emp.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-aviva-text font-medium">{emp.full_name}</p>
                  <p className="text-[10px] text-aviva-secondary">{emp.department} · {emp.position}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-aviva-gold">฿{(pr.net ?? 0).toLocaleString("th-TH")}</p>
                  <p className="text-[10px] text-aviva-secondary">สุทธิ</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">เงินเดือน</p>
                  <p className="text-aviva-text font-medium">฿{emp.base_salary.toLocaleString("th-TH")}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">ประกันสังคม</p>
                  <p className="text-red-400 font-medium">-฿{(pr.sso ?? 0).toLocaleString("th-TH")}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">ภาษีหัก ณ ที่จ่าย</p>
                  <p className="text-red-400 font-medium">-฿{(pr.tax ?? 0).toLocaleString("th-TH")}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">รายได้พิเศษ</p>
                  <input type="number" value={specialIncomes[emp.id] ?? ""}
                    onChange={e => setSpecialIncomes(p => ({ ...p, [emp.id]: e.target.value }))}
                    placeholder="0"
                    className="w-full text-center text-aviva-text bg-transparent outline-none text-[10px]" />
                </div>
              </div>
              <button onClick={() => setPayslipEmp(pr)}
                className="w-full py-1.5 bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                <Printer size={11} /> ดูสลิปเงินเดือน
              </button>
            </GlassCard>
          );
        })}
      </div>

      {/* Payslip Modal */}
      {payslipEmp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 print-area">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">สลิปเงินเดือน</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => printPayslip(payslipEmp)} className="text-xs text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Printer size={11} /> พิมพ์สลิป
                </button>
                <button onClick={() => setPayslipEmp(null)} aria-label="ปิด"><X size={18} className="text-aviva-secondary" /></button>
              </div>
            </div>
            <div className="text-center border-b border-aviva-gold/20 pb-3">
              <p className="text-xs font-bold text-aviva-gold tracking-widest">AVIVA ONE</p>
              <p className="text-xs text-aviva-secondary mt-0.5">สลิปเงินเดือนประจำเดือน {month}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-aviva-secondary">ชื่อ-สกุล</span>
                <span className="text-aviva-text font-medium">{payslipEmp.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aviva-secondary">ตำแหน่ง</span>
                <span className="text-aviva-text">{payslipEmp.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aviva-secondary">แผนก</span>
                <span className="text-aviva-text">{payslipEmp.department}</span>
              </div>
            </div>
            <div className="border-t border-aviva-gold/10 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-aviva-secondary">เงินเดือนพื้นฐาน</span>
                <span className="text-aviva-text">฿{payslipEmp.base_salary.toLocaleString("th-TH")}</span>
              </div>
              {(payslipEmp.commission_amount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">ค่าคอมมิชชั่น</span>
                  <span className="text-green-400">+฿{(payslipEmp.commission_amount ?? 0).toLocaleString("th-TH")}</span>
                </div>
              )}
              {(specialIncomes[payslipEmp.id] && parseFloat(specialIncomes[payslipEmp.id]) > 0) && (
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">รายได้พิเศษ</span>
                  <span className="text-green-400">+฿{parseFloat(specialIncomes[payslipEmp.id]).toLocaleString("th-TH")}</span>
                </div>
              )}
              <div className="flex justify-between text-red-400">
                <span>หัก: ประกันสังคม (5%, สูงสุด ฿750)</span>
                <span>-฿{(payslipEmp.sso ?? 0).toLocaleString("th-TH")}</span>
              </div>
              <div className="flex justify-between font-bold text-aviva-gold border-t border-aviva-gold/20 pt-2 mt-1">
                <span>เงินได้สุทธิ</span>
                <span>฿{(payslipEmp.net ?? 0).toLocaleString("th-TH")}</span>
              </div>
            </div>
            <p className="text-[10px] text-aviva-secondary/40 text-center">เอกสารนี้ออกโดยระบบ AVIVA ONE · {new Date().toLocaleDateString("th-TH")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
