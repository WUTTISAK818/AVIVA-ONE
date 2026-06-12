"use client";

import { useEffect, useState } from "react";
import { KeyRound, CheckCircle } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { formatNumber } from "@/lib/thai-baht";

// รายการมาตรฐานวันโอนกรรมสิทธิ์ (หมู่บ้านจัดสรร)
const ITEMS: { key: string; label: string; amount?: boolean }[] = [
  { key: "docs", label: "เตรียมเอกสารโอน (โฉนด/สัญญา/บัตร ปชช.)" },
  { key: "final_inspect", label: "ตรวจรับบ้านก่อนโอน (Defect ครบ)" },
  { key: "final_payment", label: "ชำระยอดคงเหลือ/งวดสุดท้าย", amount: true },
  { key: "transfer_fee", label: "ค่าธรรมเนียมโอน 2% (ผู้ซื้อ-ขายคนละครึ่ง)", amount: true },
  { key: "sbt", label: "ภาษีธุรกิจเฉพาะ/อากรแสตมป์", amount: true },
  { key: "mortgage_fee", label: "ค่าจดจำนอง 1% (กรณีกู้)", amount: true },
  { key: "appointment", label: "นัดวันโอน ณ สนง.ที่ดิน + ธนาคาร" },
  { key: "meters", label: "โอนมิเตอร์ไฟฟ้า/ประปา" },
  { key: "common_fee", label: "ค่าส่วนกลางล่วงหน้า + กองทุน", amount: true },
  { key: "handover", label: "ส่งมอบกุญแจ/บ้าน" },
];

interface Task { item_key: string; done: boolean; amount: number | null; note: string | null; }

export default function TransferChecklist({ leadId }: { leadId: string }) {
  const user = useCurrentUser();
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("transfer_tasks").select("item_key,done,amount,note").eq("lead_id", leadId);
    const map: Record<string, Task> = {};
    (data as Task[] ?? []).forEach(t => { map[t.item_key] = t; });
    setTasks(map);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leadId]);

  const upsert = async (key: string, patch: Partial<Task>) => {
    const cur = tasks[key] ?? { item_key: key, done: false, amount: null, note: null };
    const next = { ...cur, ...patch };
    setTasks(p => ({ ...p, [key]: next }));
    await supabase.from("transfer_tasks").upsert({
      lead_id: leadId, item_key: key, done: next.done, amount: next.amount, note: next.note,
      done_by: user?.full_name ?? user?.email ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "lead_id,item_key" });
  };

  const doneCount = ITEMS.filter(i => tasks[i.key]?.done).length;
  const pct = Math.round((doneCount / ITEMS.length) * 100);

  return (
    <div className="bg-aviva-bg rounded-xl p-3 border border-aviva-gold/10 col-span-2">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <p className="text-xs font-bold text-aviva-text flex items-center gap-1.5">
          <KeyRound size={13} className="text-aviva-gold" /> เช็กลิสต์วันโอนกรรมสิทธิ์
        </p>
        <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full",
          pct === 100 ? "bg-green-500/15 text-green-400" : "bg-aviva-gold/10 text-aviva-gold")}>
          {doneCount}/{ITEMS.length}
        </span>
      </button>
      <div className="mt-1.5 h-1.5 rounded-full bg-aviva-gold/10 overflow-hidden">
        <div className={clsx("h-full transition-all", pct === 100 ? "bg-green-400" : "bg-aviva-gold")} style={{ width: `${pct}%` }} />
      </div>

      {open && !loading && (
        <div className="mt-2.5 space-y-1.5">
          {ITEMS.map((item) => {
            const t = tasks[item.key];
            const done = t?.done ?? false;
            return (
              <div key={item.key} className="bg-aviva-card/50 rounded-lg p-2">
                <button onClick={() => upsert(item.key, { done: !done })} className="flex items-start gap-2 w-full text-left">
                  <span className={clsx("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5",
                    done ? "bg-aviva-gold border-aviva-gold" : "border-aviva-secondary/40")}>
                    {done && <CheckCircle size={11} className="text-aviva-bg" />}
                  </span>
                  <span className={clsx("text-[11px] leading-snug", done ? "text-aviva-text line-through opacity-70" : "text-aviva-text")}>{item.label}</span>
                </button>
                {item.amount && (
                  <input inputMode="numeric" defaultValue={t?.amount != null ? String(t.amount) : ""}
                    onBlur={(e) => { const v = e.target.value ? Number(e.target.value.replace(/,/g, "")) : null; if (v !== (t?.amount ?? null)) upsert(item.key, { amount: v }); }}
                    placeholder="จำนวนเงิน (บาท)"
                    className="mt-1 ml-6 w-[calc(100%-1.5rem)] bg-aviva-bg border border-aviva-gold/15 rounded-md px-2 py-1 text-[11px] text-aviva-text outline-none" />
                )}
                {item.amount && t?.amount != null && (
                  <p className="ml-6 text-[10px] text-aviva-gold mt-0.5">฿{formatNumber(t.amount)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
