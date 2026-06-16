"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Plus, X, Receipt, ImageIcon, CheckCircle, AlertCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Bill {
  id: string;
  resident_id: string;
  bill_type: string | null;
  period_label: string | null;
  amount: number;
  due_date: string | null;
  status: string;
  slip_url: string | null;
  payment_ref: string | null;
  created_at: string;
}
interface Resident { id: string; full_name: string }

function fmtBaht(n: number) {
  return `฿${Number(n).toLocaleString("th-TH")}`;
}

export default function AdminBillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ resident_id: "", bill_type: "ค่าส่วนกลาง", period_label: "", amount: "", due_date: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      supabase.from("bills").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("residents").select("id, full_name").order("full_name"),
    ]).then(([b, r]) => {
      setBills((b.data as Bill[]) ?? []);
      setResidents((r.data as Resident[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const visible = bills.filter(b => filter === "all" || (filter === "paid" ? b.status === "paid" : b.status !== "paid"));

  const resName = (id: string) => residents.find(r => r.id === id)?.full_name ?? id.slice(0, 8);

  const create = async () => {
    if (!form.resident_id || !form.amount) { setError("กรุณาเลือกลูกบ้านและระบุยอด"); return; }
    setSaving(true);
    setError(null);
    const { error: insErr } = await supabase.from("bills").insert({
      resident_id: form.resident_id,
      bill_type: form.bill_type,
      period_label: form.period_label || null,
      amount: Number(form.amount),
      due_date: form.due_date || null,
      status: "unpaid",
    });
    setSaving(false);
    if (insErr) { setError(insErr.message); return; }
    setShowForm(false);
    setForm({ resident_id: "", bill_type: "ค่าส่วนกลาง", period_label: "", amount: "", due_date: "" });
    load();
  };

  const confirmPayment = async (id: string) => {
    if (!confirm("ยืนยันรับชำระบิลนี้ และบันทึกเข้า finance?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/bills/${id}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({}),
    });
    if (res.ok) load();
    else {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "ไม่สำเร็จ");
    }
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">บิลค่าส่วนกลาง</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{visible.length} รายการ</p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> ออกบิล
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <div className="flex gap-2">
          {([
            { k: "unpaid" as const, l: "ค้างชำระ" },
            { k: "paid" as const, l: "ชำระแล้ว" },
            { k: "all" as const, l: "ทั้งหมด" },
          ]).map(({ k, l }) => (
            <button key={k} onClick={() => setFilter(k)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border",
                filter === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{l}</button>
          ))}
        </div>

        <SectionHeader title="รายการ" subtitle="คลิกตรวจสลิป / ยืนยันรับชำระ" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : visible.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Receipt size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีรายการ</p>
          </GlassCard>
        ) : (
          visible.map(b => (
            <GlassCard key={b.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-aviva-text">{resName(b.resident_id)}</p>
                  <p className="text-xs text-aviva-secondary">{b.bill_type} {b.period_label} · กำหนด {b.due_date ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-aviva-gold">{fmtBaht(b.amount)}</p>
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full border",
                    b.status === "paid" ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-red-500/15 text-red-300 border-red-500/30"
                  )}>{b.status === "paid" ? "ชำระแล้ว" : "ค้างชำระ"}</span>
                </div>
              </div>
              {b.slip_url && (
                <div className="flex items-center gap-2 text-xs">
                  <a href={b.slip_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-aviva-gold underline">
                    <ImageIcon size={12} /> ดูสลิป
                  </a>
                  {b.payment_ref && <span className="text-aviva-secondary">เลข ref {b.payment_ref}</span>}
                </div>
              )}
              {b.status !== "paid" && (
                <button onClick={() => confirmPayment(b.id)}
                  className="flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/30 text-aviva-gold text-sm font-bold px-4 py-2.5 rounded-xl">
                  <CheckCircle size={12} /> ยืนยันรับชำระ
                </button>
              )}
            </GlassCard>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ออกบิลใหม่</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && (
              <div className="text-sm px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <Field label="ลูกบ้าน *">
              <select value={form.resident_id} onChange={e => setForm({ ...form, resident_id: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                <option value="">— เลือก —</option>
                {residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </Field>
            <Field label="ประเภท">
              <input type="text" value={form.bill_type}
                onChange={e => setForm({ ...form, bill_type: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="งวด">
                <input type="text" value={form.period_label}
                  onChange={e => setForm({ ...form, period_label: e.target.value })}
                  placeholder="เช่น 2568"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </Field>
              <Field label="กำหนดชำระ">
                <input type="date" value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </Field>
            </div>
            <Field label="ยอด (บาท) *">
              <input type="number" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="1500"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <button onClick={create} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "ออกบิล"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-aviva-secondary mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
