"use client";

// ระบบเงินสดย่อย (Petty Cash) สำหรับค่าใช้จ่ายสำนักงานเล็ก ๆ น้อย ๆ
// เช่น น้ำดื่ม/กาแฟบริการลูกค้า, น้ำยาทำความสะอาด, ล้างแอร์/ซ่อมสำนักงานเล็กน้อย
// - "เบิกจ่าย" หักจากวงเงินคงเหลือ + ลงบัญชี (เดบิต ค่าใช้จ่ายสำนักงาน / เครดิต เงินสดย่อย)
// - "เติมเงิน" เพิ่มวงเงิน + ลงบัญชี (เดบิต เงินสดย่อย / เครดิต เงินฝากธนาคาร)
// - เตือนเมื่อยอดคงเหลือใกล้หมด
import { useEffect, useState, useCallback } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, AlertTriangle, X, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import { postJv } from "@/lib/jv";
import { createNotification } from "@/lib/notify";
import { logAction } from "@/lib/audit";
import { useCurrentUser } from "@/lib/user-context";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const LOW_THRESHOLD = 1000; // เตือนเมื่อเงินสดย่อยเหลือน้อยกว่านี้

// หมวดค่าใช้จ่ายสำนักงานที่จ่ายจากเงินสดย่อยบ่อย ๆ
const PETTY_CATEGORIES = [
  "ของใช้สำนักงาน",
  "ซ่อมบำรุงสำนักงาน",
  "สวัสดิการ/ต้อนรับลูกค้า",
  "ค่าเดินทาง",
  "อื่นๆ",
];

interface Entry {
  id: string;
  entry_type: "replenish" | "expense";
  category: string | null;
  description: string;
  amount: number;
  balance_after: number;
  created_by: string | null;
  created_at: string;
  txn_date: string | null;
}

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
// วันที่ทำรายการ (เฉพาะวัน) — ใช้ txn_date ถ้ามี ไม่งั้น fallback เป็นวันที่ของ created_at
const fmtTxnDate = (txn: string | null, createdAt: string) =>
  new Date(txn ? `${txn}T00:00:00` : createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
// วันนี้ในรูปแบบ YYYY-MM-DD ตามเขตเวลาไทย
const todayISO = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().split("T")[0];
};

export default function PettyCashPanel() {
  const user = useCurrentUser();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<null | "expense" | "replenish">(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState(PETTY_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // แก้ไขรายการ (เฉพาะรายละเอียด/หมวด — ยอดเงินล็อกเพื่อรักษายอดคงเหลือ)
  const [txnDate, setTxnDate] = useState(todayISO());
  const [editing, setEditing] = useState<Entry | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editCat, setEditCat] = useState(PETTY_CATEGORIES[0]);
  const [editDate, setEditDate] = useState(todayISO());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("petty_cash_entries")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .limit(50);
    setEntries((data as Entry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const balance = entries[0]?.balance_after ?? 0;
  const low = balance < LOW_THRESHOLD;

  const openForm = (m: "expense" | "replenish") => {
    setMode(m); setAmount(""); setDesc(""); setCategory(PETTY_CATEGORIES[0]); setTxnDate(todayISO()); setErr("");
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setErr("กรุณาระบุจำนวนเงินที่ถูกต้อง"); return; }
    if (!desc.trim()) { setErr("กรุณาระบุรายละเอียด"); return; }
    setSaving(true);

    // อ่านยอดล่าสุดอีกครั้งกันยอดค้าง (เผื่อมีการบันทึกพร้อมกัน)
    const { data: latest } = await supabase
      .from("petty_cash_entries")
      .select("balance_after")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .limit(1);
    const curBal = (latest?.[0]?.balance_after as number) ?? 0;
    if (mode === "expense" && amt > curBal) {
      setErr(`เงินสดย่อยคงเหลือ ${baht(curBal)} ไม่พอจ่าย — กรุณาเติมเงินก่อน`);
      setSaving(false); return;
    }
    const newBal = mode === "replenish" ? curBal + amt : curBal - amt;
    const who = user?.full_name ?? user?.email ?? "ผู้ใช้";

    const useDate = txnDate || todayISO();
    const { error } = await supabase.from("petty_cash_entries").insert({
      project_id: PROJECT_ID,
      entry_type: mode,
      category: mode === "expense" ? category : null,
      description: desc.trim(),
      amount: amt,
      balance_after: newBal,
      created_by: who,
      txn_date: useDate,
    });
    if (error) { setErr("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง"); setSaving(false); return; }

    // ลงบัญชีอัตโนมัติแบบ double-entry — ใช้วันที่ทำรายการจริงที่ผู้ใช้เลือก
    const jvDate = useDate;
    if (mode === "replenish") {
      await postJv({
        project_id: PROJECT_ID, jv_date: jvDate,
        description: `เติมเงินสดย่อย — ${desc.trim()}`,
        lines: [
          { account_code: "1130", account_name: "เงินสดย่อย", debit: amt, credit: 0 },
          { account_code: "1120", account_name: "เงินฝากธนาคาร", debit: 0, credit: amt },
        ],
      });
    } else {
      await postJv({
        project_id: PROJECT_ID, jv_date: jvDate,
        description: `[${category}] ${desc.trim()}`,
        lines: [
          { account_code: "6600", account_name: "ค่าใช้จ่ายสำนักงาน", debit: amt, credit: 0 },
          { account_code: "1130", account_name: "เงินสดย่อย", debit: 0, credit: amt },
        ],
      });
    }

    await logAction(
      "finance",
      mode === "replenish" ? "petty_replenish" : "petty_expense",
      `${mode === "replenish" ? "เติมเงินสดย่อย" : `เบิกจ่ายเงินสดย่อย [${category}]`} ${baht(amt)} — ${desc.trim()} (คงเหลือ ${baht(newBal)})`
    );

    // เตือนเมื่อเงินสดย่อยใกล้หมด
    if (newBal < LOW_THRESHOLD) {
      await createNotification({
        type: "info",
        title: "เงินสดย่อยใกล้หมด",
        message: `คงเหลือ ${baht(newBal)} — ควรเติมเงินสดย่อยสำนักงาน`,
        from_dept: "ฝ่ายการเงิน",
        to_dept: "ผู้บริหาร",
      });
    }

    setSaving(false); setMode(null);
    load();
  };

  const openEdit = (e: Entry) => {
    setEditing(e); setEditDesc(e.description); setEditCat(e.category ?? PETTY_CATEGORIES[0]);
    setEditDate(e.txn_date ?? todayISO()); setErr("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editDesc.trim()) { setErr("กรุณาระบุรายละเอียด"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("petty_cash_entries")
      .update({
        description: editDesc.trim(),
        category: editing.entry_type === "expense" ? editCat : null,
        txn_date: editDate || editing.txn_date,
      })
      .eq("id", editing.id);
    if (error) { setErr("แก้ไขไม่สำเร็จ"); setSaving(false); return; }
    await logAction("finance", "petty_edit",
      `แก้ไขรายการเงินสดย่อย ${baht(editing.amount)} — ${editDesc.trim()}`);
    setSaving(false); setEditing(null);
    load();
  };

  return (
    <GlassCard className={`p-4 ${low ? "border border-orange-500/30 bg-orange-500/5" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-aviva-gold" />
          <span className="text-sm font-semibold text-aviva-text">เงินสดย่อยสำนักงาน</span>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${low ? "text-orange-400" : "text-aviva-gold"}`}>
            {loading ? "…" : baht(balance)}
          </div>
          <div className="text-[10px] text-aviva-secondary">คงเหลือ</div>
        </div>
      </div>

      {low && !loading && (
        <div className="flex items-center gap-1.5 text-[11px] text-orange-400 mb-3">
          <AlertTriangle size={12} /> เงินสดย่อยใกล้หมด — ควรเติมเงิน
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => openForm("expense")}
          className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/25 py-2.5 rounded-xl text-xs font-semibold"
        >
          <ArrowDownCircle size={14} /> เบิกจ่าย
        </button>
        <button
          onClick={() => openForm("replenish")}
          className="flex-1 flex items-center justify-center gap-1.5 bg-green-500/15 text-green-400 border border-green-500/25 py-2.5 rounded-xl text-xs font-semibold"
        >
          <ArrowUpCircle size={14} /> เติมเงิน
        </button>
      </div>

      {/* รายการล่าสุด */}
      {!loading && entries.length === 0 ? (
        <div className="text-[11px] text-aviva-secondary/70 text-center py-2">
          ยังไม่มีรายการ — เริ่มจาก &quot;เติมเงิน&quot; เพื่อตั้งวงเงินสำรอง
        </div>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 6).map((e) => (
            <div key={e.id} className="flex items-start justify-between text-xs gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-aviva-text truncate">
                  {e.entry_type === "expense" ? (e.category ? `[${e.category}] ` : "") : "เติมเงิน — "}
                  {e.description}
                </div>
                <div className="text-[10px] text-aviva-secondary/70 mt-0.5">
                  {e.entry_type === "replenish" ? "เติมเมื่อ " : ""}{fmtTxnDate(e.txn_date, e.created_at)}
                  {e.created_by ? ` · ${e.created_by}` : ""}
                  {" · คงเหลือ "}{baht(e.balance_after)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`font-semibold ${e.entry_type === "expense" ? "text-red-400" : "text-green-400"}`}>
                  {e.entry_type === "expense" ? "−" : "+"}{baht(e.amount)}
                </span>
                <button onClick={() => openEdit(e)} className="text-aviva-secondary/60 hover:text-aviva-gold p-1" title="แก้ไขรายละเอียด/หมวด">
                  <Pencil size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ฟอร์มเบิกจ่าย/เติมเงิน */}
      {mode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !saving && setMode(null)}>
          <div className="w-full max-w-sm bg-aviva-bg border border-aviva-gold/20 rounded-2xl p-5" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-aviva-text">
                {mode === "expense" ? "เบิกจ่ายเงินสดย่อย" : "เติมเงินสดย่อย"}
              </h3>
              <button onClick={() => !saving && setMode(null)} className="text-aviva-secondary"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              {mode === "expense" && (
                <div>
                  <label className="text-[11px] text-aviva-secondary">หมวดค่าใช้จ่าย</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text"
                  >
                    {PETTY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[11px] text-aviva-secondary">จำนวนเงิน (บาท)</label>
                <input
                  type="number" inputMode="decimal" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="เช่น 350"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text"
                />
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">
                  {mode === "replenish" ? "วันที่เติมเงิน" : "วันที่ทำรายการ"}
                </label>
                <input
                  type="date" value={txnDate} max={todayISO()}
                  onChange={(e) => setTxnDate(e.target.value)}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text"
                />
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">รายละเอียด</label>
                <input
                  type="text" value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={mode === "expense" ? "เช่น น้ำดื่มบริการลูกค้า / ล้างแอร์" : "เช่น เติมจากเงินสดบริษัท"}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text"
                />
              </div>

              {mode === "expense" && (
                <div className="text-[11px] text-aviva-secondary">
                  คงเหลือปัจจุบัน {baht(balance)}
                  {Number(amount) > 0 && Number(amount) <= balance && (
                    <span className="text-aviva-gold"> → หลังเบิก {baht(balance - Number(amount))}</span>
                  )}
                </div>
              )}

              {err && <div className="text-[11px] text-red-400">{err}</div>}

              <button
                onClick={submit}
                disabled={saving}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก…" : mode === "expense" ? "บันทึกเบิกจ่าย" : "บันทึกเติมเงิน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* แก้ไขรายการ (รายละเอียด/หมวด) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !saving && setEditing(null)}>
          <div className="w-full max-w-sm bg-aviva-bg border border-aviva-gold/20 rounded-2xl p-5" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-aviva-text">แก้ไขรายการเงินสดย่อย</h3>
              <button onClick={() => !saving && setEditing(null)} className="text-aviva-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] text-aviva-secondary">
                {fmtDate(editing.created_at)} น. · ยอด{" "}
                <span className={editing.entry_type === "expense" ? "text-red-400" : "text-green-400"}>
                  {editing.entry_type === "expense" ? "−" : "+"}{baht(editing.amount)}
                </span>{" "}
                <span className="text-aviva-secondary/60">(ยอดเงินแก้ไม่ได้ — หากผิดให้บันทึกรายการปรับปรุงแทน)</span>
              </div>
              {editing.entry_type === "expense" && (
                <div>
                  <label className="text-[11px] text-aviva-secondary">หมวดค่าใช้จ่าย</label>
                  <select value={editCat} onChange={(e) => setEditCat(e.target.value)}
                    className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text">
                    {PETTY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[11px] text-aviva-secondary">
                  {editing.entry_type === "replenish" ? "วันที่เติมเงิน" : "วันที่ทำรายการ"}
                </label>
                <input type="date" value={editDate} max={todayISO()} onChange={(e) => setEditDate(e.target.value)}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">รายละเอียด</label>
                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              {err && <div className="text-[11px] text-red-400">{err}</div>}
              <button onClick={saveEdit} disabled={saving}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
