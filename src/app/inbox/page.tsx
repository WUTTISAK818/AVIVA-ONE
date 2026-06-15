"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Inbox as InboxIcon, Clock, ArrowRight, Banknote, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { useCurrentUser } from "@/lib/user-context";
import { rolesForUser } from "@/lib/workflow-events";

interface WorkQueueItem {
  id: string;
  workflow_type: string;
  source_record_id: string;
  doc_index: string | null;
  title: string;
  amount: number | null;
  assigned_role: string;
  status: string;
  sla_due_at: string | null;
  created_at: string;
}

// ป้ายชนิดงาน — ใช้ workflow_type ก่อน (ตรงกว่า role) แล้วค่อย fallback เป็น role
const TYPE_LABEL: Record<string, string> = {
  Lead_Followup: "ติดตามลูกค้า (ขาย)",
  Installment_Review: "อนุมัติงวดงาน (ผู้บริหาร)",
  Defect_Followup: "งานแก้ไข (ก่อสร้าง)",
  Leave_Request: "อนุมัติใบลา (ผู้บริหาร)",
  Warranty_Claim: "เคลมประกัน (หลังการขาย)",
};

const ROLE_LABEL: Record<string, string> = {
  manager: "รออนุมัติ (ผู้จัดการ)",
  finance: "รอจ่ายเงิน (การเงิน)",
  sales_ai: "ติดตามลูกค้า (ฝ่ายขาย)",
  construction_ai: "งานก่อสร้าง",
  engineer: "งานวิศวกรรม",
};

// ปลายทางสำรองตาม role (เมื่อ workflow_type ไม่มี deep-link เฉพาะ)
const ROLE_LINK: Record<string, string> = {
  manager: "/approvals",
  finance: "/construction",
  sales_ai: "/crm",
  construction_ai: "/construction",
  engineer: "/construction",
};

// คลิกการ์ดแล้วเปิด "รายการนั้นจริง ๆ" ไม่ใช่หน้ารวมของแผนก
// (/crm รองรับ ?lead=<id> เปิด detail · /office รองรับ ?tab=)
function linkFor(it: WorkQueueItem): string {
  switch (it.workflow_type) {
    case "Lead_Followup":
      return `/crm?lead=${it.source_record_id}`;
    case "Installment_Review":   // อนุมัติงวดงานก่อสร้าง — panel อยู่หน้า construction
    case "Defect_Followup":
      return "/construction";
    case "Leave_Request":
      return "/office?tab=hr";
    case "Warranty_Claim":
      return "/after-sales";
    default:
      return ROLE_LINK[it.assigned_role] ?? "/approvals";
  }
}

// จัดลำดับ: งานที่ต้องตัดสินใจ/อนุมัติ มาก่อนงานติดตามลูกค้าจำนวนมาก
// (CEO/COO เห็นทุกคิว — กันงานอนุมัติจมใต้ลีดหลักร้อยใบ)
function priority(it: WorkQueueItem): number {
  switch (it.workflow_type) {
    case "Installment_Review":
    case "Leave_Request":
    case "Warranty_Claim":
      return 0; // งานรออนุมัติของผู้บริหาร — บนสุด
    case "Defect_Followup":
      return 1; // งานแก้ไขหน้างาน
    default:
      return 2; // Lead_Followup และอื่น ๆ
  }
}

// แสดงจำนวนเงินให้ตรงความหมาย: ลีดเก็บ "งบ" เป็นล้านบาท ไม่ใช่บาท
function amountText(it: WorkQueueItem): string | null {
  if (it.amount == null || it.amount <= 0) return null;
  if (it.workflow_type === "Lead_Followup") return `งบ ${it.amount} ล้าน`;
  return `฿${it.amount.toLocaleString("th-TH")}`;
}

function slaInfo(sla: string | null): { text: string; cls: string } | null {
  if (!sla) return null;
  const ms = new Date(sla).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (ms < 0) return { text: `เกินกำหนด ${Math.abs(days)} วัน`, cls: "bg-red-500/20 text-red-400" };
  if (days <= 1) return { text: "ครบกำหนดวันนี้", cls: "bg-orange-500/20 text-orange-400" };
  return { text: `อีก ${days} วัน`, cls: "bg-aviva-gold/10 text-aviva-gold" };
}

const INITIAL_VISIBLE = 20;

export default function InboxPage() {
  const user = useCurrentUser();
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const roles = useMemo(() => (user ? rolesForUser(user) : []), [user]);

  const load = useCallback(async () => {
    if (roles.length === 0) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("work_queue")
      .select("*")
      .eq("status", "open")
      .in("assigned_role", roles)
      .order("sla_due_at", { ascending: true, nullsFirst: false });
    const queueItems = (data as WorkQueueItem[]) ?? [];
    let merged: WorkQueueItem[] = queueItems;

    // ผู้จัดการ/ผู้บริหาร: รวมงานรออนุมัติที่อยู่นอก work_queue เข้ากล่องงานให้ครบ
    if (roles.includes("manager")) {
      const seen = new Set(queueItems.map((q) => q.source_record_id));

      // (ก) approval_logs ที่ยัง Pending (จอง/สัญญา/จัดซื้อ/การเงิน/เอกสาร)
      const { data: appr } = await supabase
        .from("approval_logs")
        .select("approval_id, workflow_type, source_record_id, source_doc_index, amount, sla_due_at, created_at")
        .eq("action_taken", "Pending");
      const apprItems: WorkQueueItem[] = (
        (appr as {
          approval_id: string; workflow_type: string; source_record_id: string | null;
          source_doc_index: string | null; amount: number | null;
          sla_due_at: string | null; created_at: string;
        }[]) ?? []
      )
        .filter((a) => !a.source_record_id || !seen.has(a.source_record_id))
        .map((a) => ({
          id: a.approval_id,
          workflow_type: a.workflow_type,
          source_record_id: a.source_record_id ?? a.approval_id,
          doc_index: a.source_doc_index,
          title: (a.source_doc_index ?? "").split(" | ")[1] || a.source_doc_index || a.workflow_type,
          amount: a.amount,
          assigned_role: "manager",
          status: "open",
          sla_due_at: a.sla_due_at,
          created_at: a.created_at,
        }));

      // (ข) ใบลาที่รออนุมัติ — ตาราง leave_requests (ไม่ได้ผ่าน approval_logs)
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("id, employee_name, leave_type, date_from, date_to, days_count, created_at")
        .eq("status", "pending");
      const leaveItems: WorkQueueItem[] = (
        (leaves as {
          id: string; employee_name: string | null; leave_type: string | null;
          date_from: string | null; date_to: string | null; days_count: number | null; created_at: string;
        }[]) ?? []
      ).map((l) => ({
        id: `leave-${l.id}`,
        workflow_type: "Leave_Request",
        source_record_id: l.id,
        doc_index: l.date_from ? `${l.date_from}${l.date_to ? " – " + l.date_to : ""}` : null,
        title: `ใบลา: ${l.employee_name ?? "-"} — ${l.leave_type ?? "ลา"}${l.days_count ? ` (${l.days_count} วัน)` : ""}`,
        amount: null,
        assigned_role: "manager",
        status: "open",
        sla_due_at: null,
        created_at: l.created_at,
      }));

      // (ค) เคลมประกันที่รอดำเนินการ — ตาราง warranty_claims
      const { data: warr } = await supabase
        .from("warranty_claims")
        .select("id, customer_name, house_number, issue_type, created_at")
        .eq("status", "pending");
      const warrItems: WorkQueueItem[] = (
        (warr as {
          id: string; customer_name: string | null; house_number: string | null;
          issue_type: string | null; created_at: string;
        }[]) ?? []
      ).map((w) => ({
        id: `warranty-${w.id}`,
        workflow_type: "Warranty_Claim",
        source_record_id: w.id,
        doc_index: w.house_number ? `บ้าน ${w.house_number}` : null,
        title: `เคลม: ${w.customer_name ?? "-"}${w.issue_type ? " — " + w.issue_type : ""}`,
        amount: null,
        assigned_role: "manager",
        status: "open",
        sla_due_at: null,
        created_at: w.created_at,
      }));

      merged = [...queueItems, ...apprItems, ...leaveItems, ...warrItems];
    }

    // เรียงตามความสำคัญก่อน แล้วค่อยตามกำหนด SLA (ใหม่สุด/ด่วนสุดขึ้นก่อน)
    merged.sort((x, y) => {
      const p = priority(x) - priority(y);
      if (p !== 0) return p;
      const ax = x.sla_due_at ? new Date(x.sla_due_at).getTime() : Infinity;
      const ay = y.sla_due_at ? new Date(y.sla_due_at).getTime() : Infinity;
      return ax - ay;
    });
    setItems(merged);
    setLoading(false);
  }, [roles]);

  useEffect(() => { load(); }, [load]);

  // realtime refresh when queue changes
  useEffect(() => {
    const ch = supabase
      .channel("work_queue_inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_queue" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const overdue = useMemo(
    () => items.filter((i) => i.sla_due_at && new Date(i.sla_due_at).getTime() < Date.now()).length,
    [items]
  );
  const approvals = useMemo(() => items.filter((i) => priority(i) === 0).length, [items]);
  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE);

  const subtitle = loading
    ? "งานที่ส่งต่อมาให้ฝ่ายของคุณดำเนินการ"
    : `งานค้าง ${items.length} ชิ้น` +
      (approvals > 0 ? ` · รออนุมัติ ${approvals}` : "") +
      (overdue > 0 ? ` · เกินกำหนด ${overdue}` : "");

  return (
    <main className="min-h-screen px-4 pt-6 pb-24 max-w-2xl mx-auto">
      <SectionHeader
        title="กล่องงานของฉัน"
        subtitle={subtitle}
        action={<InboxIcon size={20} className="text-aviva-gold" />}
      />

      {loading ? (
        <div className="text-sm text-aviva-secondary/60 py-10 text-center">กำลังโหลด...</div>
      ) : roles.length === 0 ? (
        <GlassCard className="p-6 text-center text-sm text-aviva-secondary">
          ฝ่ายของคุณยังไม่มีกล่องงานที่เชื่อมต่อ
        </GlassCard>
      ) : items.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <BadgeCheck size={28} className="text-green-400 mx-auto mb-2" />
          <div className="text-sm text-aviva-text font-medium">ไม่มีงานค้าง</div>
          <div className="text-xs text-aviva-secondary mt-1">งานทุกชิ้นได้รับการดำเนินการแล้ว</div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {visible.map((it) => {
            const sla = slaInfo(it.sla_due_at);
            const amt = amountText(it);
            return (
              <Link key={it.id} href={linkFor(it)}>
                <GlassCard className="p-4 hover:border-aviva-gold/30 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20">
                          {TYPE_LABEL[it.workflow_type] ?? ROLE_LABEL[it.assigned_role] ?? it.assigned_role}
                        </span>
                        {sla && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${sla.cls}`}>
                            <Clock size={10} /> {sla.text}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-aviva-text truncate">{it.title}</div>
                      {it.doc_index && <div className="text-xs text-aviva-secondary truncate">{it.doc_index}</div>}
                      {amt && (
                        <div className="text-xs text-aviva-secondary mt-1 inline-flex items-center gap-1">
                          <Banknote size={12} /> {amt}
                        </div>
                      )}
                    </div>
                    <ArrowRight size={16} className="text-aviva-secondary/50 mt-1 shrink-0" />
                  </div>
                </GlassCard>
              </Link>
            );
          })}

          {!showAll && items.length > INITIAL_VISIBLE && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-3 text-sm font-medium text-aviva-gold border border-aviva-gold/20 rounded-xl hover:bg-aviva-gold/10 transition-all"
            >
              ดูงานที่เหลือทั้งหมด ({items.length - INITIAL_VISIBLE} ชิ้น)
            </button>
          )}
        </div>
      )}
    </main>
  );
}
