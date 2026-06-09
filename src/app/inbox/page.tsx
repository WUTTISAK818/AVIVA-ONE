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

const ROLE_LABEL: Record<string, string> = {
  manager: "รออนุมัติ (ผู้จัดการ)",
  finance: "รอจ่ายเงิน (การเงิน)",
};

// where each queue should send the user to act
const ROLE_LINK: Record<string, string> = {
  manager: "/approvals",
  finance: "/construction",
};

function slaInfo(sla: string | null): { text: string; cls: string } | null {
  if (!sla) return null;
  const ms = new Date(sla).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (ms < 0) return { text: `เกินกำหนด ${Math.abs(days)} วัน`, cls: "bg-red-500/20 text-red-400" };
  if (days <= 1) return { text: "ครบกำหนดวันนี้", cls: "bg-orange-500/20 text-orange-400" };
  return { text: `อีก ${days} วัน`, cls: "bg-aviva-gold/10 text-aviva-gold" };
}

export default function InboxPage() {
  const user = useCurrentUser();
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const roles = useMemo(() => (user ? rolesForUser(user) : []), [user]);

  const load = useCallback(async () => {
    if (roles.length === 0) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("work_queue")
      .select("*")
      .eq("status", "open")
      .in("assigned_role", roles)
      .order("sla_due_at", { ascending: true, nullsFirst: false });
    setItems((data as WorkQueueItem[]) ?? []);
    setLoading(false);
  }, [roles]);

  useEffect(() => { load(); }, [load]);

  // realtime refresh when queue changes
  useEffect(() => {
    const ch = supabase
      .channel("work_queue_inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_queue" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <main className="min-h-screen px-4 pt-6 pb-24 max-w-2xl mx-auto">
      <SectionHeader
        title="กล่องงานของฉัน"
        subtitle="งานที่ส่งต่อมาให้ฝ่ายของคุณดำเนินการ"
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
          {items.map((it) => {
            const sla = slaInfo(it.sla_due_at);
            const link = ROLE_LINK[it.assigned_role] ?? "/approvals";
            return (
              <Link key={it.id} href={link}>
                <GlassCard className="p-4 hover:border-aviva-gold/30 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20">
                          {ROLE_LABEL[it.assigned_role] ?? it.assigned_role}
                        </span>
                        {sla && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${sla.cls}`}>
                            <Clock size={10} /> {sla.text}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-aviva-text truncate">{it.title}</div>
                      {it.doc_index && <div className="text-xs text-aviva-secondary truncate">{it.doc_index}</div>}
                      {it.amount != null && it.amount > 0 && (
                        <div className="text-xs text-aviva-secondary mt-1 inline-flex items-center gap-1">
                          <Banknote size={12} /> ฿{it.amount.toLocaleString("th-TH")}
                        </div>
                      )}
                    </div>
                    <ArrowRight size={16} className="text-aviva-secondary/50 mt-1 shrink-0" />
                  </div>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
