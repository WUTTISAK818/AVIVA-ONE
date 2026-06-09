"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Send, XCircle, Banknote, Clock, AlertTriangle, UserCheck, Circle } from "lucide-react";

interface WorkflowEvent {
  id: string;
  event_type: string;
  stage_from: string | null;
  stage_to: string | null;
  actor_name: string | null;
  actor_role: string | null;
  routed_to_role: string | null;
  routed_to_name: string | null;
  condition_note: string | null;
  created_at: string;
}

const EVENT_META: Record<string, { label: string; Icon: typeof CheckCircle; color: string }> = {
  submitted: { label: "ส่งตรวจสอบ", Icon: Send, color: "text-blue-400" },
  acknowledged: { label: "ผู้รับเหมารับทราบ", Icon: UserCheck, color: "text-cyan-400" },
  approved: { label: "อนุมัติแล้ว", Icon: CheckCircle, color: "text-green-400" },
  rejected: { label: "ตีกลับ", Icon: XCircle, color: "text-red-400" },
  paid: { label: "จ่ายเงินแล้ว", Icon: Banknote, color: "text-emerald-400" },
  reminded: { label: "เตือนงานค้าง", Icon: Clock, color: "text-yellow-400" },
  escalated: { label: "ส่งถึงผู้บริหาร", Icon: AlertTriangle, color: "text-orange-400" },
};

function meta(type: string) {
  return EVENT_META[type] ?? { label: type, Icon: Circle, color: "text-aviva-secondary" };
}

export default function WorkflowTimeline({ sourceRecordId }: { sourceRecordId: string }) {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("workflow_events")
        .select("id,event_type,stage_from,stage_to,actor_name,actor_role,routed_to_role,routed_to_name,condition_note,created_at")
        .eq("source_record_id", sourceRecordId)
        .order("created_at", { ascending: true });
      if (active) {
        setEvents((data as WorkflowEvent[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [sourceRecordId]);

  if (loading) return <div className="text-xs text-aviva-secondary/60 py-2">กำลังโหลดประวัติ...</div>;
  if (events.length === 0) return <div className="text-xs text-aviva-secondary/60 py-2">ยังไม่มีประวัติการส่งต่องาน</div>;

  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-aviva-gold/15" />
      {events.map((ev) => {
        const m = meta(ev.event_type);
        const when = new Date(ev.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        return (
          <div key={ev.id} className="relative mb-3 last:mb-0">
            <div className="absolute -left-5 top-0.5 bg-aviva-bg rounded-full">
              <m.Icon size={15} className={m.color} />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-aviva-text">{m.label}</span>
              <span className="text-[10px] text-aviva-secondary/60 whitespace-nowrap">{when}</span>
            </div>
            <div className="text-[11px] text-aviva-secondary">
              {ev.actor_name ? `โดย ${ev.actor_name}` : ""}
              {ev.routed_to_role ? ` → ส่งต่อ: ${ev.routed_to_name ?? ev.routed_to_role}` : ""}
            </div>
            {ev.condition_note && (
              <div className="text-[11px] text-aviva-secondary/70 italic mt-0.5">{ev.condition_note}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
