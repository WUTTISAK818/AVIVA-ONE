"use client";
// คิวติดตามลูกค้าแบบ "ทีละชุด 10 ราย เรียงตามความสำคัญ"
// Pom สั่ง 28 ก.ย. 69: "งานติดตามให้ทยอยแบ่งเป็นเซต ตามความสำคัญของแต่ละลูกค้า อาจจะเซตละ 10 คน
//                       ถ้าส่งทีเดียวหมด จะทำไม่ทันและไม่รู้จะเริ่มตรงไหน"
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Target, Phone, CalendarPlus, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { addDaysStr, normalizeDateInput, thaiDateStr } from "@/lib/thai-date";
import { thaiDbError } from "@/lib/db-errors";
import {
  FOLLOWUP_BATCH_SIZE, FOLLOWUP_DONE_STATUSES, TIER_LABEL,
  rankFollowupLeads, splitIntoBatches, type PriorityLead, type PriorityTier,
} from "@/lib/lead-priority";

const SELECT_COLS =
  "id, customer_name, phone, status, budget, ai_score, urgency, probability, plot_number, next_follow_up_date, last_contact_date, visit_date, assigned_to, created_at_default";

const TIER_STYLE: Record<PriorityTier, string> = {
  hot: "bg-red-500/15 text-red-300 border-red-500/40",
  warm: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  cold: "bg-aviva-gold/10 text-aviva-secondary border-aviva-gold/20",
};

export default function FollowupQueueCard() {
  const user = useCurrentUser();
  const [rows, setRows] = useState<PriorityLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchIndex, setBatchIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const today = thaiDateStr();

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      // ผู้จัดการ/ผู้บริหารเห็นคิวรวมทั้งทีม · พนักงานขายเห็นเฉพาะลูกค้าที่ตัวเองดูแล
      // leads.assigned_to เก็บเป็น "ชื่อเล่น" (ฟ้า/เดียร์) จึงต้องแปลงอีเมลผู้ใช้เป็นชื่อก่อน
      let myNames: string[] = [];
      if (!user.isManager) {
        const { data: me } = await supabase.from("employees_directory")
          .select("full_name, nickname").ilike("email", user.email).maybeSingle();
        myNames = [me?.nickname, me?.full_name, user.full_name]
          .filter((v): v is string => !!v && !!v.trim())
          .map(v => v.trim().toLowerCase());
      }

      const { data, error } = await supabase.from("leads")
        .select(SELECT_COLS)
        .not("status", "in", `(${FOLLOWUP_DONE_STATUSES.map(s => `"${s}"`).join(",")})`);
      if (error) throw error;

      const all = (data ?? []) as PriorityLead[];
      const mine = user.isManager
        ? all
        : all.filter(l => myNames.includes((l.assigned_to ?? "").trim().toLowerCase()));
      setRows(mine);
      setErr("");
    } catch (e) {
      setErr(thaiDbError(e as { code?: string; message?: string }, "โหลดคิวติดตาม"));
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.isManager, user?.full_name]);

  useEffect(() => { void load(); }, [load]);

  const ranked = useMemo(
    () => rankFollowupLeads(rows, today).filter(r => !doneIds.includes(r.lead.id)),
    [rows, today, doneIds],
  );
  const batches = useMemo(() => splitIntoBatches(ranked, FOLLOWUP_BATCH_SIZE), [ranked]);
  const safeIndex = Math.min(batchIndex, Math.max(batches.length - 1, 0));
  const batch = batches[safeIndex] ?? [];

  // ตั้งวันนัดติดตามให้ลูกค้ารายนี้ → หลุดออกจากคิวทันที คนถัดไปเลื่อนขึ้นมา
  const setFollowup = async (id: string, dateStr: string) => {
    setSavingId(id);
    try {
      const { error } = await supabase.from("leads")
        .update({ next_follow_up_date: dateStr, last_contact_date: today, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setDoneIds(prev => [...prev, id]);
      setOpenId(null);
      setErr("");
    } catch (e) {
      setErr(thaiDbError(e as { code?: string; message?: string }, "ตั้งวันนัดติดตาม"));
    } finally {
      setSavingId(null);
    }
  };

  if (!user) return null;
  if (loading) {
    return (
      <div className="bg-aviva-card rounded-2xl border border-aviva-gold/10 p-4">
        <div className="animate-pulse h-16 bg-aviva-gold/10 rounded-xl" />
      </div>
    );
  }
  if (rows.length === 0) return null; // ไม่ใช่คนที่ดูแลลูกค้า — ไม่ต้องรบกวน

  const total = ranked.length;
  const clearedToday = doneIds.length;

  return (
    <div className="bg-aviva-card rounded-2xl border border-aviva-gold/25 overflow-hidden">
      <div className="px-3.5 py-3 border-b border-aviva-gold/15 bg-aviva-gold/5">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-aviva-gold flex-shrink-0" />
          <h3 className="text-sm font-bold text-aviva-gold">คิวติดตามลูกค้า — ทำทีละชุด</h3>
        </div>
        <p className="text-xs text-aviva-secondary mt-1 leading-relaxed">
          {total > 0
            ? <>ต้องติดตามทั้งหมด <b className="text-aviva-text">{total} ราย</b> — แบ่งเป็น {batches.length} ชุด (ชุดละไม่เกิน {FOLLOWUP_BATCH_SIZE} ราย) เรียงคนสำคัญที่สุดไว้ก่อน</>
            : <>เคลียร์คิวครบแล้ววันนี้ 🎉</>}
          {clearedToday > 0 && <> · ตั้งวันนัดแล้ว {clearedToday} ราย</>}
        </p>
      </div>

      {err && <p className="px-3.5 py-2 text-xs text-red-300 bg-red-500/10">{err}</p>}

      {total === 0 ? (
        <p className="px-3.5 py-5 text-sm text-aviva-secondary text-center">ไม่มีลูกค้าค้างติดตาม — เยี่ยมมากครับ</p>
      ) : (
        <>
          <div className="px-3.5 py-2 flex items-center justify-between gap-2 border-b border-aviva-gold/10">
            <button type="button" onClick={() => setBatchIndex(i => Math.max(0, i - 1))} disabled={safeIndex === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-aviva-gold/20 text-aviva-secondary disabled:opacity-30">
              <ChevronLeft size={13} />ก่อนหน้า
            </button>
            <span className="text-xs font-bold text-aviva-text">ชุดที่ {safeIndex + 1} / {batches.length}</span>
            <button type="button" onClick={() => setBatchIndex(i => Math.min(batches.length - 1, i + 1))} disabled={safeIndex >= batches.length - 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-aviva-gold/20 text-aviva-secondary disabled:opacity-30">
              ชุดถัดไป<ChevronRight size={13} />
            </button>
          </div>

          <ul className="divide-y divide-aviva-gold/10">
            {batch.map((r, i) => {
              const rank = safeIndex * FOLLOWUP_BATCH_SIZE + i + 1;
              const phone = (r.lead.phone ?? "").trim();
              const expanded = openId === r.lead.id;
              return (
                <li key={r.lead.id} className="px-3.5 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-aviva-gold/15 text-aviva-gold text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{rank}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-aviva-text">{r.lead.customer_name}</span>
                        <span className={clsx("text-[11px] font-bold px-1.5 py-0.5 rounded-full border", TIER_STYLE[r.tier])}>{TIER_LABEL[r.tier]}</span>
                        {user.isManager && r.lead.assigned_to && (
                          <span className="text-[11px] text-aviva-secondary">({r.lead.assigned_to})</span>
                        )}
                      </div>
                      <p className="text-xs text-aviva-secondary mt-1 leading-relaxed">{r.reasons.join(" · ") || "ยังไม่มีข้อมูลเพิ่มเติม"}</p>
                      {phone && <p className="text-xs text-aviva-text/80 mt-0.5">{phone}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2.5">
                    {phone ? (
                      <a href={`tel:${phone.replace(/\D/g, "")}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600/20 border border-green-500/40 text-green-300 text-xs font-bold">
                        <Phone size={13} />โทรเลย
                      </a>
                    ) : (
                      <span className="flex-1 text-center py-2 rounded-xl bg-aviva-bg border border-aviva-gold/10 text-xs text-aviva-secondary">ไม่มีเบอร์โทร</span>
                    )}
                    <button type="button" onClick={() => setOpenId(expanded ? null : r.lead.id)}
                      className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border",
                        expanded ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-gold/10 text-aviva-gold border-aviva-gold/40")}>
                      <CalendarPlus size={13} />ตั้งวันนัดถัดไป
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-aviva-bg border border-aviva-gold/15">
                      <p className="text-xs text-aviva-secondary mb-2">นัดติดตามครั้งถัดไปเมื่อไหร่?</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[["วันนี้", 0], ["พรุ่งนี้", 1], ["+3 วัน", 3], ["+7 วัน", 7]].map(([label, d]) => (
                          <button key={label as string} type="button" disabled={savingId === r.lead.id}
                            onClick={() => setFollowup(r.lead.id, addDaysStr(today, d as number))}
                            className="py-2 rounded-lg bg-aviva-card border border-aviva-gold/25 text-xs font-semibold text-aviva-text disabled:opacity-40">
                            {label as string}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input type="date" defaultValue={today} min={today}
                          // แปลงปี พ.ศ. → ค.ศ. ก่อนบันทึก (ปฏิทินพุทธศักราชบนมือถือส่งปี 2569 มา)
                          onChange={e => { const d = normalizeDateInput(e.target.value); if (d) void setFollowup(r.lead.id, d); }}
                          className="flex-1 bg-aviva-card border border-aviva-gold/20 rounded-lg px-2.5 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/50" />
                        {savingId === r.lead.id
                          ? <Loader2 size={15} className="text-aviva-gold animate-spin" />
                          : <Check size={15} className="text-aviva-secondary" />}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="px-3.5 py-2.5 text-xs text-aviva-secondary border-t border-aviva-gold/10">
            ตั้งวันนัดแล้วลูกค้ารายนั้นจะออกจากคิว คนถัดไปเลื่อนขึ้นมาแทน — ทำชุดนี้ให้จบก่อนไปชุดถัดไป
          </p>
        </>
      )}
    </div>
  );
}
