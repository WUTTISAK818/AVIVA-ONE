"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { BadgeCheck, X, Clock, CheckCircle, XCircle, AlertTriangle, FileText, HardHat, Package, DollarSign, ChevronDown, ChevronUp, Home, Search, Filter } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import clsx from "clsx";
import { useCurrentUser } from "@/lib/user-context";
import { createNotification } from "@/lib/notify";
import { logAction } from "@/lib/audit";
import { SLA_DAYS, calcSlaDueAt, summarizeApproval } from "@/lib/approval-matrix";
import ApprovalRouteBar from "@/components/ApprovalRouteBar";
import ApprovalVerifyModal, { type VerifyLog } from "@/components/ApprovalVerifyModal";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import { logWorkflowEvent, createWorkQueue, closeWorkQueue, notifyPush, notifyContractor } from "@/lib/workflow-events";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

type MainTab = "approvals" | "registry";

interface ApprovalLog {
  id: string;
  workflow_type: string;
  source_doc_index: string | null;
  source_record_id: string | null;
  current_approver_role: string;
  action_taken: string;
  amount: number | null;
  sla_due_at: string | null;
  assigned_to_name: string | null;
  approver_email: string | null;
  action_timestamp: string | null;
  created_at: string;
  notes: string | null;
}

interface CustomerInstallment {
  id: string;
  lead_id: string;
  installment_no: number;
  name: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  receipt_number: string | null;
  customer_name?: string;
  house_number?: string | null;
}

const WORKFLOW_CONFIG: Record<string, { label: string; icon: typeof BadgeCheck; color: string; bg: string; border: string }> = {
  Installment_Review: {
    label: "ตรวจงวดงาน",
    icon: HardHat,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  Material_Purchase: {
    label: "จัดซื้อวัสดุ",
    icon: Package,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  Document_Approval: {
    label: "อนุมัติเอกสาร",
    icon: FileText,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  Finance_Approval: {
    label: "อนุมัติรายจ่าย",
    icon: DollarSign,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
  Leave_Request: {
    label: "เป็นการลา",
    icon: BadgeCheck,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
  },
};

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Pending:  { label: "รออนุมัติ", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  Approved: { label: "อนุมัติแล้ว", color: "text-green-400",  bg: "bg-green-500/20"  },
  Rejected: { label: "ปฏิเสธ",    color: "text-red-400",    bg: "bg-red-500/20"    },
};

const WORKFLOW_LABELS: Record<string, string> = {
  Installment_Review: "ตรวจงวดงาน",
  Material_Purchase:  "จัดซื้อวัสดุ",
  Document_Approval:  "เอกสาร",
  Finance_Approval:   "การเงิน",
  Leave_Request:      "การลา",
  Booking_Deposit:    "เงินจอง",
  Contract_Approval:  "สัญญา",
};

// รองรับสถานะที่บันทึกมาแบบตัวพิมพ์เล็ก/ใหญ่ปนกัน (ข้อมูลเก่าบางชุดเป็น pending/approved)
const normAction = (a: string | null): "Pending" | "Approved" | "Rejected" => {
  const s = (a ?? "").toLowerCase();
  return s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : "Pending";
};

// ตารางต้นทางของแต่ละ workflow — ใช้ดึงรายละเอียดจริงมาแสดงก่อนอนุมัติ
const SOURCE_TABLE: Record<string, string> = {
  Material_Purchase:  "purchase_orders",
  Finance_Approval:   "approvals",
  Leave_Request:      "leave_requests",
  Document_Approval:  "documents",
  Installment_Review: "contractor_installments",
  Booking_Deposit:    "leads",
  Contract_Approval:  "leads",
};

const str = (v: unknown): string | undefined =>
  (v === null || v === undefined || v === "") ? undefined : String(v);
const baht = (v: unknown): string | undefined =>
  (v === null || v === undefined) ? undefined : `฿${Number(v).toLocaleString("th-TH")}`;


function slaDaysLeft(sla_due_at: string | null): number | null {
  if (!sla_due_at) return null;
  const ms = new Date(sla_due_at).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function SlaChip({ sla_due_at, action }: { sla_due_at: string | null; action: string }) {
  if (action !== "Pending" || !sla_due_at) return null;
  const days = slaDaysLeft(sla_due_at);
  if (days === null) return null;
  const urgent = days <= 1;
  const warn = days <= 3;
  return (
    <span className={clsx(
      "text-[9px] px-1.5 py-0.5 rounded-full font-bold border flex-shrink-0",
      urgent ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
             : warn ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                    : "bg-aviva-bg/60 text-aviva-secondary border-aviva-gold/10"
    )}>
      SLA {days >= 0 ? `${days}d` : `เกิน ${Math.abs(days)}d`}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-aviva-secondary flex-shrink-0">{label}</span>
      <span className="text-aviva-text text-right break-words">{value}</span>
    </div>
  );
}

function ItemsList({ items }: { items: unknown }) {
  let arr: Record<string, unknown>[] = [];
  if (Array.isArray(items)) {
    arr = items as Record<string, unknown>[];
  } else if (typeof items === "string" && items.trim()) {
    try {
      const p: unknown = JSON.parse(items);
      if (Array.isArray(p)) arr = p as Record<string, unknown>[];
      else return <DetailRow label="รายการ" value={items} />;
    } catch {
      return <DetailRow label="รายการ" value={items} />;
    }
  }
  if (arr.length === 0) return null;
  return (
    <div className="pt-1.5 border-t border-aviva-gold/10 mt-1.5">
      <p className="text-[11px] text-aviva-secondary mb-1">รายการ ({arr.length})</p>
      <div className="space-y-1">
        {arr.map((it, i) => {
          const name = str(it.name ?? it.item ?? it.description) ?? `รายการ ${i + 1}`;
          const qty = it.qty ?? it.quantity;
          const price = it.price ?? it.amount ?? it.total;
          return (
            <div key={i} className="flex justify-between gap-2 text-[11px] text-aviva-text">
              <span className="truncate">{name}{qty !== undefined && qty !== null ? ` ×${String(qty)}` : ""}</span>
              {baht(price) && <span className="text-aviva-gold flex-shrink-0">{baht(price)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ดึงข้อมูลจริงจากตารางต้นทางตาม workflow_type + source_record_id มาแสดงก่อนอนุมัติ
function SourceDetail({ log }: { log: ApprovalLog }) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const table = SOURCE_TABLE[log.workflow_type];
    if (!table || !log.source_record_id) { setLoading(false); return; }
    let active = true;
    supabase.from(table).select("*").eq("id", log.source_record_id).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setRow((data as Record<string, unknown> | null) ?? null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [log]);

  if (loading) return <div className="h-16 rounded-xl bg-aviva-bg/50 animate-pulse" />;
  if (!row) return (
    <p className="text-[11px] text-aviva-secondary bg-aviva-bg/50 rounded-xl px-3 py-2.5">
      ไม่พบข้อมูลต้นทาง (เป็นรายการเก่า/เดโม) — ใช้ข้อมูลสรุปด้านบนประกอบการพิจารณา
    </p>
  );

  const wt = log.workflow_type;
  const fileUrl = str(row.file_url);

  return (
    <div className="bg-aviva-bg rounded-xl p-4 space-y-1.5">
      <p className="text-xs font-semibold text-aviva-secondary/70 mb-1">รายละเอียดคำขอ</p>
      {wt === "Material_Purchase" && <>
        <DetailRow label="เลขที่ PO" value={str(row.po_number)} />
        <DetailRow label="ผู้ขาย" value={str(row.supplier_name)} />
        <DetailRow label="ยอดรวม" value={baht(row.total_amount)} />
        <DetailRow label="ผู้ขอ" value={str(row.requested_by)} />
        <DetailRow label="หมายเหตุ" value={str(row.notes)} />
        <ItemsList items={row.items} />
      </>}
      {wt === "Finance_Approval" && <>
        <DetailRow label="โมดูล" value={str(row.module)} />
        <DetailRow label="รายละเอียด" value={str(row.description)} />
        <DetailRow label="ยอดเงิน" value={baht(row.amount)} />
        <DetailRow label="ผู้ขอ" value={str(row.requested_by)} />
        <DetailRow label="หมายเหตุ" value={str(row.note)} />
      </>}
      {wt === "Leave_Request" && <>
        <DetailRow label="พนักงาน" value={str(row.employee_name)} />
        <DetailRow label="ฝ่าย" value={str(row.employee_dept)} />
        <DetailRow label="ประเภทลา" value={str(row.leave_type)} />
        <DetailRow label="ช่วงวันที่" value={`${str(row.date_from) ?? "?"} – ${str(row.date_to) ?? "?"}`} />
        <DetailRow label="จำนวนวัน" value={row.days_count != null ? `${String(row.days_count)} วัน` : undefined} />
        <DetailRow label="เหตุผล" value={str(row.reason)} />
      </>}
      {wt === "Document_Approval" && <>
        <DetailRow label="ชื่อเอกสาร" value={str(row.name)} />
        <DetailRow label="หมวด" value={str(row.category)} />
        <DetailRow label="เลขที่" value={str(row.doc_number)} />
        <DetailRow label="คำอธิบาย" value={str(row.description)} />
        <DetailRow label="ผู้อัปโหลด" value={str(row.uploaded_by)} />
        {fileUrl && <a href={fileUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-aviva-gold underline pt-1"><FileText size={12} /> เปิดไฟล์เอกสาร</a>}
      </>}
      {wt === "Installment_Review" && <>
        <DetailRow label="งวดที่" value={str(row.installment_no)} />
        <DetailRow label="ชื่องวด" value={str(row.name)} />
        <DetailRow label="ค่าแรง" value={baht(row.labor_cost)} />
        <DetailRow label="ค่าวัสดุ" value={baht(row.material_cost)} />
        <DetailRow label="ยอดรวม" value={baht(row.amount)} />
        <DetailRow label="ผู้ตั้งงวด" value={str(row.created_by_name)} />
        <DetailRow label="หมายเหตุช่าง" value={str(row.contractor_notes)} />
      </>}
      {(wt === "Booking_Deposit" || wt === "Contract_Approval") && <>
        <DetailRow label="ลูกค้า" value={str(row.customer_name)} />
        <DetailRow label="แปลง" value={str(row.plot_number)} />
        <DetailRow label="เบอร์โทร" value={str(row.phone)} />
        <DetailRow label="งบ/ราคา" value={baht(row.contract_price ?? row.budget)} />
        <DetailRow label="สถานะ" value={str(row.status)} />
      </>}
    </div>
  );
}

function ApprovalsContent() {
  const user = useCurrentUser();
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | string>("all");
  const [filterAction, setFilterAction] = useState<"all" | "Pending" | "Approved" | "Rejected">("Pending");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<ApprovalLog | null>(null);
  const [verifyLog, setVerifyLog] = useState<ApprovalLog | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const pendingCount = logs.filter(l => normAction(l.action_taken) === "Pending").length;

  const PAGE_SIZE = 50;

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("approval_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const newLogs = (data as ApprovalLog[]) ?? [];
    setLogs(newLogs);
    setHasMore(newLogs.length === PAGE_SIZE);
    setLoading(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const { data } = await supabase
      .from("approval_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(logs.length, logs.length + PAGE_SIZE - 1);
    const more = (data as ApprovalLog[]) ?? [];
    setLogs(prev => [...prev, ...more]);
    setHasMore(more.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterType !== "all" && l.workflow_type !== filterType) return false;
      if (filterAction !== "all" && normAction(l.action_taken) !== filterAction) return false;
      if (search && !(l.source_doc_index ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, filterType, filterAction, search]);

  const handleApprove = async (log: ApprovalLog, approved: boolean, commentArg?: string) => {
    if (!user) return;
    setProcessingId(log.id);
    const action = approved ? "Approved" : "Rejected";
    const note = commentArg ?? notes[log.id] ?? null;

    // Update the approval log (เก็บเหตุผลใน rejection_comment เฉพาะตอนปฏิเสธ — approval_logs ไม่มีคอลัมน์ notes)
    await supabase.from("approval_logs").update({
      action_taken: action,
      action_timestamp: new Date().toISOString(),
      approver_email: user.email,
      ...(approved ? {} : { rejection_comment: note }),
    }).eq("id", log.id);

    // Cascade logic based on workflow type
    if (log.workflow_type === "Installment_Review") {
      const byName = user.full_name ?? user.email;
      // Resolve the contractor linked to this installment's house (for LINE/SMS).
      let contractorRef: string | null = null;
      if (log.source_record_id) {
        const instRow = (await supabase.from("contractor_installments").select("house_id").eq("id", log.source_record_id).maybeSingle()).data as { house_id?: string } | null;
        if (instRow?.house_id) {
          const houseRow = (await supabase.from("houses").select("contractor_line_id").eq("id", instRow.house_id).maybeSingle()).data as { contractor_line_id?: string } | null;
          contractorRef = houseRow?.contractor_line_id ?? null;
        }
      }
      if (approved) {
        // Approve installment in contractor_installments
        if (log.source_record_id) {
          await supabase.from("contractor_installments")
            .update({ status: "approved", approved_by: byName, approved_at: new Date().toISOString() })
            .eq("id", log.source_record_id);
          // Phase 1 — close manager queue, route the task on to Finance (fixes "อนุมัติแล้วค้าง")
          await closeWorkQueue(log.source_record_id, "manager", byName);
          await logWorkflowEvent({
            workflowType: "Installment_Review",
            sourceRecordId: log.source_record_id,
            docIndex: log.source_doc_index,
            eventType: "approved",
            stageFrom: "in_review",
            stageTo: "approved",
            actorName: byName,
            actorRole: user.isAdmin ? "admin" : "manager",
            routedToRole: "finance",
            routedToName: "ฝ่ายการเงิน",
            amount: log.amount ?? null,
          });
          await createWorkQueue({
            workflowType: "Installment_Review",
            sourceRecordId: log.source_record_id,
            docIndex: log.source_doc_index,
            title: `จ่ายเงินงวดงาน: ${log.source_doc_index ?? ""}`,
            amount: log.amount ?? null,
            assignedRole: "finance",
            slaDueAt: calcSlaDueAt("Installment_Review"),
          });
          notifyPush("ฝ่ายการเงิน", "งวดงานรอจ่ายเงิน", log.source_doc_index ?? "", "/construction", `inst-${log.source_record_id}`);
          notifyContractor(contractorRef, "approved", log.source_doc_index ?? undefined);
        }
        await createNotification({
          type: "success",
          title: "อนุมัติงวดงานแล้ว",
          message: log.source_doc_index ?? "",
          from_dept: "ฝ่ายอนุมัติ",
          to_dept: "ฝ่ายการเงิน",
        });
      } else {
        if (log.source_record_id) {
          await supabase.from("contractor_installments")
            .update({ status: "rejected" })
            .eq("id", log.source_record_id);
          // Phase 1 — close manager queue, route back to engineering
          await closeWorkQueue(log.source_record_id, "manager", byName);
          await logWorkflowEvent({
            workflowType: "Installment_Review",
            sourceRecordId: log.source_record_id,
            docIndex: log.source_doc_index,
            eventType: "rejected",
            stageFrom: "in_review",
            stageTo: "rejected",
            actorName: byName,
            actorRole: user.isAdmin ? "admin" : "manager",
            routedToRole: "engineer",
            conditionNote: note ?? undefined,
            amount: log.amount ?? null,
          });
          notifyPush("ฝ่ายก่อสร้าง", "งวดงานถูกตีกลับ", log.source_doc_index ?? "", "/construction", `inst-${log.source_record_id}`);
          notifyContractor(contractorRef, "rejected", note ?? undefined);
        }
        await createNotification({
          type: "info",
          title: "ปฏิเสธงวดงาน",
          message: log.source_doc_index ?? "",
          from_dept: "ฝ่ายอนุมัติ",
        });
      }
    } else if (log.workflow_type === "Material_Purchase") {
      if (log.source_record_id) {
        await supabase.from("purchase_orders")
          .update({ status: approved ? "approved" : "rejected" })
          .eq("id", log.source_record_id);
      }
      await createNotification({
        type: approved ? "success" : "info",
        title: approved ? "อนุมัติสั่งซื้อแล้ว" : "ปฏิเสธสั่งซื้อ",
        message: log.source_doc_index ?? "",
        from_dept: "ฝ่ายอนุมัติ",
      });
    } else if (log.workflow_type === "Document_Approval") {
      if (log.source_record_id) {
        await supabase.from("documents")
          .update({
            status: approved ? "approved" : "rejected",
            approved_by: user.full_name ?? user.email,
          })
          .eq("id", log.source_record_id);
      }
      await createNotification({
        type: approved ? "success" : "info",
        title: approved ? "อนุมัติเอกสารแล้ว" : "ปฏิเสธเอกสาร",
        message: log.source_doc_index ?? "",
        from_dept: "ฝ่ายอนุมัติ",
      });
    } else if (log.workflow_type === "Finance_Approval") {
      if (approved && log.source_record_id) {
        // If second-level approval (admin), also approve first-level logs
        if (user.isAdmin && log.amount && log.amount >= 500000) {
          await supabase.from("approval_logs")
            .update({ action_taken: "Approved", action_timestamp: new Date().toISOString(), approver_email: user.email })
            .eq("source_record_id", log.source_record_id)
            .eq("workflow_type", "Finance_Approval")
            .eq("action_taken", "Pending");
        }
        await supabase.from("approvals")
          .update({ status: "approved", approved_by: user.full_name ?? user.email, approved_at: new Date().toISOString() })
          .eq("id", log.source_record_id);
      } else if (!approved && log.source_record_id) {
        await supabase.from("approvals")
          .update({ status: "rejected", approved_by: user.full_name ?? user.email, approved_at: new Date().toISOString() })
          .eq("id", log.source_record_id);
      }
      await createNotification({
        type: approved ? "success" : "info",
        title: approved ? "อนุมัติรายจ่ายแล้ว" : "ปฏิเสธรายจ่าย",
        message: `${log.source_doc_index ?? ""} — ฿${(log.amount ?? 0).toLocaleString("th-TH")}`,
        from_dept: "ฝ่ายอนุมัติ",
      });
    } else if (log.workflow_type === "Leave_Request") {
      if (log.source_record_id) {
        await supabase.from("leave_requests")
          .update({ status: approved ? "approved" : "rejected" })
          .eq("id", log.source_record_id);
      }
      await createNotification({
        type: approved ? "success" : "info",
        title: approved ? "อนุมัติการลาแล้ว" : "ปฏิเสธการลา",
        message: log.source_doc_index ?? "",
        from_dept: "ฝ่ายอนุมัติ",
      });
    } else if (log.workflow_type === "Booking_Deposit") {
      // ปฏิเสธเงินจอง → คืนสถานะลูกค้าเป็น New Lead + ปล่อยแปลงกลับเป็นว่าง
      if (!approved && log.source_record_id) {
        const { data: lead } = await supabase.from("leads").select("plot_number").eq("id", log.source_record_id).maybeSingle();
        await supabase.from("leads").update({ status: "New Lead" }).eq("id", log.source_record_id);
        const plot = (lead as { plot_number?: number } | null)?.plot_number;
        if (plot) await supabase.from("houses").update({ status: "available" }).eq("project_id", PROJECT_ID).eq("plot_number", plot);
      }
      await createNotification({
        type: approved ? "success" : "info",
        title: approved ? "อนุมัติเงินจองแล้ว" : "ปฏิเสธเงินจอง — คืนสถานะลูกค้า",
        message: log.source_doc_index ?? "",
        from_dept: "ฝ่ายอนุมัติ",
        to_dept: "ฝ่ายขาย",
      });
    } else if (log.workflow_type === "Contract_Approval") {
      // ปฏิเสธสัญญา → คืนสถานะลูกค้าเป็น Booking (จอง)
      if (!approved && log.source_record_id) {
        await supabase.from("leads").update({ status: "Booking" }).eq("id", log.source_record_id);
      }
      await createNotification({
        type: approved ? "success" : "info",
        title: approved ? "อนุมัติสัญญาแล้ว" : "ปฏิเสธสัญญา — คืนสถานะเป็นจอง",
        message: log.source_doc_index ?? "",
        from_dept: "ฝ่ายอนุมัติ",
        to_dept: "ฝ่ายขาย",
      });
    }

    await logAction("approvals", action.toLowerCase(), `${action} — ${log.workflow_type}: ${log.source_doc_index ?? ""}`, log.id);
    setProcessingId(null);
    setDetail(null);
    fetchLogs();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard gold className="p-3 text-center">
          <BadgeCheck size={16} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-gold">{pendingCount}</p>
          <p className="text-[10px] text-aviva-secondary">รออนุมัติ</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">{logs.filter(l => normAction(l.action_taken) === "Approved").length}</p>
          <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <XCircle size={16} className="text-red-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-red-400">{logs.filter(l => normAction(l.action_taken) === "Rejected").length}</p>
          <p className="text-[10px] text-aviva-secondary">ปฏิเสธ</p>
        </GlassCard>
      </div>

      {/* SLA warning */}
      {logs.filter(l => normAction(l.action_taken) === "Pending" && slaDaysLeft(l.sla_due_at) !== null && (slaDaysLeft(l.sla_due_at) as number) <= 1).length > 0 && (
        <GlassCard className="p-3 border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">
              <b>{logs.filter(l => normAction(l.action_taken) === "Pending" && slaDaysLeft(l.sla_due_at) !== null && (slaDaysLeft(l.sla_due_at) as number) <= 1).length} รายการ</b> SLA ใกล้ครบ/เกินกำหนด — ดำเนินการด่วน
            </span>
          </div>
        </GlassCard>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
          <input type="text" placeholder="ค้นหารายการ..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2 text-xs text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", ...Object.keys(WORKFLOW_CONFIG)] as const).map(k => (
            <button key={k} onClick={() => setFilterType(k)}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all",
                filterType === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              {k === "all" ? "ทุกประเภท" : WORKFLOW_CONFIG[k]?.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["all", "Pending", "Approved", "Rejected"] as const).map(k => (
            <button key={k} onClick={() => setFilterAction(k)}
              className={clsx(
                "flex-1 py-1.5 rounded-xl text-[10px] font-medium border transition-all",
                filterAction === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              {k === "all" ? "ทุกสถานะ" : ACTION_CONFIG[k]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        <SectionHeader title={`รายการ (${filtered.length})`} subtitle={
          Object.entries(SLA_DAYS).map(([wf, d]) => `${WORKFLOW_LABELS[wf] ?? wf}: ${d}d`).join(" · ")
        } />
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <BadgeCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีรายการที่ตรงกับเงื่อนไข</p>
          </GlassCard>
        ) : (
          filtered.map(log => {
            const cfg = WORKFLOW_CONFIG[log.workflow_type] ?? { label: log.workflow_type, icon: FileText, color: "text-aviva-secondary", bg: "bg-aviva-bg/50", border: "border-aviva-gold/10" };
            const actionCfg = ACTION_CONFIG[normAction(log.action_taken)] ?? ACTION_CONFIG.Pending;
            const Icon = cfg.icon;
            const isExpanded = expandedId === log.id;
            const isPending = normAction(log.action_taken) === "Pending";
            const canAct = isPending && (user?.isManager || user?.isAdmin);

            return (
              <GlassCard key={log.id} className={clsx("p-3 border", cfg.border)}>
                <div className="flex items-start gap-2.5">
                  <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", cfg.bg)}>
                    <Icon size={14} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>{cfg.label}</span>
                      <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded-full", actionCfg.bg, actionCfg.color)}>{actionCfg.label}</span>
                      <SlaChip sla_due_at={log.sla_due_at} action={normAction(log.action_taken)} />
                      {log.amount !== null && (
                        <span className="text-[9px] text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-full border border-aviva-gold/20">
                          ฿{(log.amount).toLocaleString("th-TH")}
                        </span>
                      )}
                    </div>
                    <ApprovalRouteBar log={log} />
                    <p className="text-[10px] text-aviva-secondary mt-1">
                      {new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canAct && (
                      <button onClick={() => setVerifyLog(log)}
                        className="text-[10px] px-2 py-1 rounded-lg bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/30">
                        ตรวจสอบ &amp; อนุมัติ
                      </button>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : log.id)} className="text-aviva-secondary">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-aviva-gold/10 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-aviva-secondary">ประเภท</span>
                      <span className="text-aviva-text">{WORKFLOW_LABELS[log.workflow_type] ?? log.workflow_type}</span>
                    </div>
                    {log.current_approver_role && (
                      <div className="flex justify-between">
                        <span className="text-aviva-secondary">ผู้อนุมัติ</span>
                        <span className="text-aviva-text capitalize">{log.current_approver_role}</span>
                      </div>
                    )}
                    {log.approver_email && (
                      <div className="flex justify-between">
                        <span className="text-aviva-secondary">อนุมัติโดย</span>
                        <span className="text-aviva-text">{log.approver_email}</span>
                      </div>
                    )}
                    {log.action_timestamp && (
                      <div className="flex justify-between">
                        <span className="text-aviva-secondary">วันดำเนินการ</span>
                        <span className="text-aviva-text">{new Date(log.action_timestamp).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                    )}
                    {log.sla_due_at && (
                      <div className="flex justify-between">
                        <span className="text-aviva-secondary">SLA ครบกำหนด</span>
                        <span className="text-aviva-text">{new Date(log.sla_due_at).toLocaleDateString("th-TH", { dateStyle: "short" })}</span>
                      </div>
                    )}
                    {log.notes && (
                      <div className="flex justify-between">
                        <span className="text-aviva-secondary">หมายเหตุ</span>
                        <span className="text-aviva-text text-right max-w-[60%]">{log.notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
        {hasMore && !loading && (
          <button onClick={loadMore} disabled={loadingMore}
            className="w-full py-3 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-card/50 hover:border-aviva-gold/30 disabled:opacity-50">
            {loadingMore ? "กำลังโหลด..." : "โหลดเพิ่มเติม"}
          </button>
        )}
      </div>

      {/* Detail / Action Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-aviva-text">ดำเนินการอนุมัติ</h2>
              <button onClick={() => setDetail(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="bg-aviva-bg rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-aviva-secondary">ประเภท</span>
                <span className="text-aviva-text font-medium">{WORKFLOW_LABELS[detail.workflow_type] ?? detail.workflow_type}</span>
              </div>
              {detail.amount !== null && (
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">ยอดเงิน</span>
                  <span className="text-aviva-gold font-bold">฿{detail.amount.toLocaleString("th-TH")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-aviva-secondary">รายละเอียด</span>
                <span className="text-aviva-text text-right max-w-[60%] text-xs">{detail.source_doc_index ?? "-"}</span>
              </div>
              {detail.sla_due_at && (
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">SLA</span>
                  <SlaChip sla_due_at={detail.sla_due_at} action={normAction(detail.action_taken)} />
                </div>
              )}
            </div>
            <SourceDetail log={detail} />
            {detail.source_record_id && (
              <div className="border-t border-aviva-gold/10 pt-3">
                <p className="text-xs font-semibold text-aviva-secondary/70 mb-2">ประวัติการส่งต่องาน</p>
                <WorkflowTimeline sourceRecordId={detail.source_record_id} />
              </div>
            )}
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ (ถ้ามี)</label>
              <textarea
                value={notes[detail.id] ?? ""}
                onChange={e => setNotes(prev => ({ ...prev, [detail.id]: e.target.value }))}
                rows={2}
                placeholder="เหตุผลการอนุมัติ/ปฏิเสธ..."
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 resize-none placeholder:text-aviva-secondary/40"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(detail, true)}
                disabled={processingId === detail.id}
                className="flex-1 py-3.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-2xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <CheckCircle size={16} /> อนุมัติ
              </button>
              <button
                onClick={() => handleApprove(detail, false)}
                disabled={processingId === detail.id}
                className="flex-1 py-3.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <XCircle size={16} /> ปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {verifyLog && (
        <ApprovalVerifyModal
          log={verifyLog as VerifyLog}
          busy={processingId === verifyLog.id}
          onClose={() => setVerifyLog(null)}
          onApprove={async (items) => {
            const l = verifyLog; setVerifyLog(null);
            await handleApprove(l, true);
            const s = summarizeApproval(l);
            await logAction("approvals", "verify_approve",
              `ตรวจสอบ & อนุมัติ — ${s.subject} (จาก ${s.fromName})${l.amount ? ` ฿${Number(l.amount).toLocaleString("th-TH")}` : ""} · ยืนยัน: ${items.join(", ")}`,
              l.source_record_id ?? undefined, { department: user?.department });
          }}
          onReject={async (c) => {
            const l = verifyLog; setVerifyLog(null);
            await handleApprove(l, false, c);
            const s = summarizeApproval(l);
            await logAction("approvals", "verify_reject",
              `ตรวจสอบ & ปฏิเสธ — ${s.subject} (จาก ${s.fromName}) · เหตุผล: ${c}`,
              l.source_record_id ?? undefined, { department: user?.department });
          }}
        />
      )}
    </div>
  );
}

// ─── Registry (Customer Installment Viewer) ──────────────────────────────────────────────

function RegistryContent() {
  const [leads, setLeads] = useState<{ id: string; customer_name: string; house_slot?: { house_number: string } | null }[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("leads")
      .select("id, customer_name, house_slot:houses(house_number)")
      .eq("project_id", PROJECT_ID)
      .order("customer_name")
      .then(({ data }) => {
        setLeads((data as unknown as typeof leads) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = leads.filter(l =>
    l.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
      <SectionHeader title="ทะเบียนงวดชำระ" subtitle="การชำระเงินงวดของลูกค้าแต่ละราย" />
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
        <input type="text" placeholder="ค้นหาชื่อลูกค้า..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40" />
      </div>
      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-aviva-card/50 animate-pulse" />)
      ) : filtered.length === 0 ? (
        <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ไม่พบลูกค้า</p></GlassCard>
      ) : (
        filtered.map(lead => (
          <GlassCard key={lead.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-aviva-text">{lead.customer_name}</p>
                {lead.house_slot?.house_number && (
                  <p className="text-xs text-aviva-secondary mt-0.5">ยูนิต: {lead.house_slot.house_number}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedLead(selectedLead === lead.id ? null : lead.id)}
                className="text-[11px] text-aviva-gold border border-aviva-gold/30 px-2.5 py-1 rounded-lg">
                {selectedLead === lead.id ? "ปิด" : "ดูงวด"}
              </button>
            </div>
            {selectedLead === lead.id && <InstallmentViewer leadId={lead.id} />}
          </GlassCard>
        ))
      )}
    </div>
  );
}

function InstallmentViewer({ leadId }: { leadId: string }) {
  const [installments, setInstallments] = useState<CustomerInstallment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("customer_installments")
      .select("*")
      .eq("lead_id", leadId)
      .order("installment_no")
      .then(({ data }) => {
        setInstallments((data as CustomerInstallment[]) ?? []);
        setLoading(false);
      });
  }, [leadId]);

  if (loading) return <div className="mt-3 h-12 rounded-xl bg-aviva-bg/50 animate-pulse" />;
  if (installments.length === 0) return (
    <div className="mt-3 text-center py-4">
      <p className="text-xs text-aviva-secondary">ยังไม่มีงวดชำระ</p>
    </div>
  );

  const paid = installments.filter(i => i.status === "paid").length;
  const total = installments.length;
  const totalAmt = installments.reduce((s, i) => s + Number(i.amount), 0);
  const paidAmt = installments.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex justify-between text-xs text-aviva-secondary">
        <span>ชำระแล้ว {paid}/{total} งวด</span>
        <span>฿{paidAmt.toLocaleString("th-TH")} / ฿{totalAmt.toLocaleString("th-TH")}</span>
      </div>
      <div className="h-1.5 bg-aviva-bg rounded-full overflow-hidden">
        <div className="h-full bg-aviva-gold rounded-full transition-all" style={{ width: `${total > 0 ? Math.round((paid / total) * 100) : 0}%` }} />
      </div>
      <div className="space-y-1.5">
        {installments.map(inst => (
          <div key={inst.id} className={clsx(
            "flex items-center justify-between px-3 py-2 rounded-xl text-xs",
            inst.status === "paid" ? "bg-green-500/10 border border-green-500/15" : "bg-aviva-bg/50"
          )}>
            <div>
              <p className="font-medium text-aviva-text">งวดที่ {inst.installment_no} — {inst.name}</p>
              {inst.due_date && <p className="text-[10px] text-aviva-secondary">ครบกำหนด: {inst.due_date}</p>}
            </div>
            <div className="text-right">
              <p className="font-bold text-aviva-gold">฿{Number(inst.amount).toLocaleString("th-TH")}</p>
              <span className={clsx("text-[9px] px-1.5 py-0.5 rounded-full",
                inst.status === "paid" ? "bg-green-500/20 text-green-400" :
                inst.status === "overdue" ? "bg-red-500/20 text-red-400" :
                "bg-yellow-500/20 text-yellow-400"
              )}>
                {inst.status === "paid" ? "ชำระแล้ว" : inst.status === "overdue" ? "เกินกำหนด" : "รอชำระ"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("approvals");

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/dashboard" className="text-aviva-secondary">
              <Home size={18} />
            </Link>
            <h1 className="text-lg font-bold text-aviva-text">ระบบอนุมัติ</h1>
          </div>
          <div className="flex gap-2">
            {(["approvals", "registry"] as const).map(tab => (
              <button key={tab} onClick={() => setMainTab(tab)}
                className={clsx(
                  "flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
                  mainTab === tab
                    ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                    : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}>
                {tab === "approvals" ? "คำขออนุมัติ" : "ทะเบียนงวดชำระ"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {mainTab === "approvals" && <ApprovalsContent />}
      {mainTab === "registry" && <RegistryContent />}
    </div>
  );
}
