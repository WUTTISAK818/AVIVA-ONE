"use client";
// ค่าใช้จ่ายประจำเดือน — ทะเบียน + สรุปแยกประเภท + บันทึกจ่ายรายเดือน (ลง JV อัตโนมัติ)
// ดอกเบี้ยเงินกู้ช่วงก่อสร้าง: ติ๊ก "ทุนเข้าโครงการ" → Dr 1180 งานระหว่างก่อสร้าง แทนค่าใช้จ่าย (TFRS)
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, X, Pencil, Power, Check } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { postJv } from "@/lib/jv";
import { logAction } from "@/lib/audit";
import { RECURRING_CATEGORIES, recurringCategory, BANK, WIP, ACCUM_DEPR } from "@/lib/gl-accounts";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const fmtM = (n: number) => n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(2)}M` : baht(n);
const thaiNow = () => new Date(Date.now() + 7 * 3600 * 1000);
const curPeriod = () => thaiNow().toISOString().slice(0, 7);           // YYYY-MM
const todayISO = () => thaiNow().toISOString().split("T")[0];

interface RecExp {
  id: string;
  name: string;
  category: string;
  amount: number;
  due_day: number | null;
  capitalize: boolean;
  is_active: boolean;
  note: string | null;
}

const emptyForm = { name: "", category: RECURRING_CATEGORIES[0].label, amount: "", due_day: "1", capitalize: false, note: "" };

export default function RecurringExpensePanel() {
  const user = useCurrentUser();
  const [items, setItems] = useState<RecExp[]>([]);
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const period = curPeriod();
  const who = user?.full_name ?? user?.email ?? "ฝ่ายการเงิน";

  const load = useCallback(async () => {
    const [itemsRes, postRes] = await Promise.all([
      supabase.from("recurring_expenses").select("*").eq("project_id", PROJECT_ID).order("category"),
      supabase.from("recurring_expense_postings").select("recurring_id").eq("project_id", PROJECT_ID).eq("period", period),
    ]);
    setItems((itemsRes.data as RecExp[]) ?? []);
    setPostedIds(new Set(((postRes.data as { recurring_id: string }[]) ?? []).map((p) => p.recurring_id)));
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setErr(""); setShowForm(true); };
  const openEdit = (it: RecExp) => {
    setEditId(it.id);
    setForm({ name: it.name, category: it.category, amount: String(it.amount), due_day: String(it.due_day ?? 1), capitalize: it.capitalize, note: it.note ?? "" });
    setErr(""); setShowForm(true);
  };

  const save = async () => {
    const amt = Number(form.amount);
    if (!form.name.trim()) { setErr("กรุณาระบุชื่อรายการ"); return; }
    if (!amt || amt <= 0) { setErr("กรุณาระบุจำนวนเงินที่ถูกต้อง"); return; }
    setSaving(true); setErr("");
    const payload = {
      project_id: PROJECT_ID, name: form.name.trim(), category: form.category, amount: amt,
      due_day: Math.min(31, Math.max(1, Number(form.due_day) || 1)),
      capitalize: form.capitalize && !!recurringCategory(form.category).canCapitalize,
      note: form.note.trim() || null,
    };
    const res = editId
      ? await supabase.from("recurring_expenses").update(payload).eq("id", editId)
      : await supabase.from("recurring_expenses").insert({ ...payload, is_active: true });
    if (res.error) { setErr("บันทึกไม่สำเร็จ"); setSaving(false); return; }
    await logAction("finance", editId ? "recurring_edit" : "recurring_create", `${editId ? "แก้ไข" : "เพิ่ม"}ค่าใช้จ่ายประจำ: ${form.name.trim()} ${baht(amt)}`);
    setSaving(false); setShowForm(false); load();
  };

  const toggleActive = async (it: RecExp) => {
    await supabase.from("recurring_expenses").update({ is_active: !it.is_active }).eq("id", it.id);
    load();
  };

  // บันทึกจ่ายเดือนนี้ → ลง JV + (กรณีเป็นเงินสด) finance_transaction + กันบันทึกซ้ำเดือนเดียวกัน
  const postMonth = async (it: RecExp) => {
    if (postedIds.has(it.id)) return;
    setSaving(true); setErr("");
    const cat = recurringCategory(it.category);
    const capitalized = it.capitalize && !!cat.canCapitalize;
    const jvDate = todayISO();
    let lines;
    if (capitalized) {
      // ดอกเบี้ยช่วงก่อสร้าง → ทุนเข้างานระหว่างก่อสร้าง
      lines = [
        { account_code: WIP.code, account_name: WIP.name, debit: it.amount, credit: 0 },
        { account_code: BANK.code, account_name: BANK.name, debit: 0, credit: it.amount },
      ];
    } else if (cat.nonCash) {
      // ค่าเสื่อมราคา (ไม่เป็นเงินสด)
      lines = [
        { account_code: cat.code, account_name: cat.name, debit: it.amount, credit: 0 },
        { account_code: ACCUM_DEPR.code, account_name: ACCUM_DEPR.name, debit: 0, credit: it.amount },
      ];
    } else {
      lines = [
        { account_code: cat.code, account_name: cat.name, debit: it.amount, credit: 0 },
        { account_code: BANK.code, account_name: BANK.name, debit: 0, credit: it.amount },
      ];
    }
    const jvId = await postJv({
      project_id: PROJECT_ID, jv_date: jvDate,
      description: `[ค่าใช้จ่ายประจำ ${period}] ${it.name}${capitalized ? " (ทุนเข้าโครงการ)" : ""}`,
      lines,
    });
    // รายการเงินสดที่เป็นค่าใช้จ่าย P&L → บันทึก finance_transaction (ไม่รวม capitalize/ค่าเสื่อม)
    if (!capitalized && !cat.nonCash) {
      await supabase.from("finance_transactions").insert({
        project_id: PROJECT_ID, transaction_type: "expense", amount: -it.amount,
        description: `[ค่าใช้จ่ายประจำ] ${it.name}`,
      });
    }
    const { error } = await supabase.from("recurring_expense_postings").insert({
      project_id: PROJECT_ID, recurring_id: it.id, period, amount: it.amount,
      capitalized, jv_id: jvId, posted_by: who,
    });
    if (error) { setErr("บันทึกจ่ายไม่สำเร็จ (อาจบันทึกซ้ำ)"); setSaving(false); return; }
    await logAction("finance", "recurring_post", `บันทึกจ่ายค่าใช้จ่ายประจำ ${period}: ${it.name} ${baht(it.amount)}`);
    setSaving(false); load();
  };

  const active = items.filter((i) => i.is_active);
  const monthlyTotal = active.reduce((s, i) => s + i.amount, 0);
  const byCat = new Map<string, number>();
  for (const i of active) byCat.set(i.category, (byCat.get(i.category) ?? 0) + i.amount);
  const catRows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const postedCount = active.filter((i) => postedIds.has(i.id)).length;

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-aviva-gold" />
          <span className="text-sm font-semibold text-aviva-text">ค่าใช้จ่ายประจำเดือน</span>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/25 px-3 py-1.5 rounded-xl text-xs font-semibold">
          <Plus size={13} /> เพิ่ม
        </button>
      </div>

      {loading ? (
        <p className="text-[11px] text-aviva-secondary/70 text-center py-3">กำลังโหลด…</p>
      ) : (
        <>
          {/* สรุปผู้บริหาร */}
          <div className="bg-aviva-bg/50 rounded-xl p-3 mb-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-aviva-secondary">รวมค่าใช้จ่ายประจำ / เดือน</span>
              <span className="text-lg font-bold text-aviva-gold">{fmtM(monthlyTotal)}</span>
            </div>
            <p className="text-[10px] text-aviva-secondary/60 mb-1.5">บันทึกจ่ายเดือน {period} แล้ว {postedCount}/{active.length} รายการ</p>
            {catRows.map(([cat, amt]) => {
              const pct = monthlyTotal > 0 ? (amt / monthlyTotal) * 100 : 0;
              return (
                <div key={cat} className="mt-1">
                  <div className="flex justify-between text-[10px] text-aviva-secondary">
                    <span className="truncate pr-2">{cat}</span><span>{baht(amt)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-aviva-bg rounded-full mt-0.5 overflow-hidden">
                    <div className="h-full bg-aviva-gold/60" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* รายการ */}
          {items.length === 0 ? (
            <p className="text-[11px] text-aviva-secondary/70 text-center py-2">ยังไม่มีค่าใช้จ่ายประจำ — กด &quot;เพิ่ม&quot;</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((it) => {
                const posted = postedIds.has(it.id);
                return (
                  <div key={it.id} className={`flex items-center gap-2 text-xs border border-aviva-gold/10 rounded-lg px-2.5 py-1.5 ${!it.is_active ? "opacity-40" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-aviva-text truncate">{it.name}{it.capitalize && recurringCategory(it.category).canCapitalize ? " · ทุนเข้าโครงการ" : ""}</div>
                      <div className="text-[9px] text-aviva-secondary/60">{it.category} · ครบกำหนดวันที่ {it.due_day ?? 1}</div>
                    </div>
                    <span className="text-aviva-gold font-semibold shrink-0">{baht(it.amount)}</span>
                    {it.is_active && (posted ? (
                      <span className="flex items-center gap-0.5 text-[9px] text-green-400 shrink-0"><Check size={11} /> จ่ายแล้ว</span>
                    ) : (
                      <button onClick={() => postMonth(it)} disabled={saving}
                        className="text-[10px] font-semibold text-aviva-gold border border-aviva-gold/30 rounded px-1.5 py-0.5 shrink-0 disabled:opacity-40">จ่ายเดือนนี้</button>
                    ))}
                    <button onClick={() => openEdit(it)} className="text-aviva-secondary/60 hover:text-aviva-gold p-0.5 shrink-0"><Pencil size={12} /></button>
                    <button onClick={() => toggleActive(it)} className="text-aviva-secondary/60 hover:text-aviva-gold p-0.5 shrink-0" title={it.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}><Power size={12} /></button>
                  </div>
                );
              })}
            </div>
          )}
          {err && <p className="text-[11px] text-red-400 mt-2">{err}</p>}
        </>
      )}

      {/* ฟอร์มเพิ่ม/แก้ไข */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="w-full max-w-sm bg-aviva-bg border border-aviva-gold/20 rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-aviva-text">{editId ? "แก้ไข" : "เพิ่ม"}ค่าใช้จ่ายประจำ</h3>
              <button onClick={() => !saving && setShowForm(false)} className="text-aviva-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-aviva-secondary">ชื่อรายการ</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น ดอกเบี้ยเงินกู้โครงการ / ค่าเช่าสำนักงาน"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">ประเภท</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, capitalize: false })}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text">
                  {RECURRING_CATEGORIES.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-aviva-secondary">จำนวนเงิน/เดือน</label>
                  <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="เช่น 25000" className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
                </div>
                <div>
                  <label className="text-[11px] text-aviva-secondary">ครบกำหนดวันที่</label>
                  <input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                    className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
                </div>
              </div>
              {recurringCategory(form.category).canCapitalize && (
                <label className="flex items-start gap-2 text-[11px] text-aviva-secondary bg-aviva-bg/50 rounded-xl px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={form.capitalize} onChange={(e) => setForm({ ...form, capitalize: e.target.checked })} className="mt-0.5" />
                  <span>ทุนเข้าโครงการ (ดอกเบี้ยช่วงก่อสร้าง → งานระหว่างก่อสร้าง แทนค่าใช้จ่าย ตาม TFRS)</span>
                </label>
              )}
              <div>
                <label className="text-[11px] text-aviva-secondary">หมายเหตุ (ถ้ามี)</label>
                <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              {err && <div className="text-[11px] text-red-400">{err}</div>}
              <button onClick={save} disabled={saving}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
