"use client";

import { useState, useEffect } from "react";
import { Plus, X, Receipt, TrendingDown, TrendingUp, FileText, Pencil } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface ReceiptRow {
  id: string;
  receipt_number: string;
  receipt_date: string;
  vendor_name: string;
  description: string;
  amount: number;
  category: string;
  receipt_type: string;
  created_at: string;
}

const CATEGORIES = ["วัสดุก่อสร้าง", "ค่าแรง", "ค่าสาธารณูปโภค", "ค่าอุปกรณ์สำนักงาน", "ค่าการตลาด", "ค่าขนส่ง", "อื่นๆ"];

const emptyForm = {
  receipt_date: new Date().toISOString().split("T")[0],
  vendor_name: "",
  description: "",
  amount: "",
  category: "วัสดุก่อสร้าง",
  receipt_type: "expense",
  receipt_number: "",
};

function formatThb(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0 });
}

export default function AccountingPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [editingReceipt, setEditingReceipt] = useState<ReceiptRow | null>(null);

  const fetchReceipts = () => {
    supabase
      .from("receipts")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("receipt_date", { ascending: false })
      .then(({ data }) => {
        setReceipts((data as ReceiptRow[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(() => { fetchReceipts(); }, []);

  const totalExpense = receipts.filter(r => r.receipt_type === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome = receipts.filter(r => r.receipt_type === "income").reduce((s, r) => s + Number(r.amount), 0);

  const filtered = filterType === "all" ? receipts : receipts.filter(r => r.receipt_type === filterType);

  const handleSave = async () => {
    if (!form.vendor_name || !form.amount) return;
    setSaving(true);
    if (editingReceipt) {
      await supabase.from("receipts").update({
        receipt_date: form.receipt_date,
        vendor_name: form.vendor_name,
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
        receipt_type: form.receipt_type,
        receipt_number: form.receipt_number || editingReceipt.receipt_number,
      }).eq("id", editingReceipt.id);
    } else {
      await supabase.from("receipts").insert({
        project_id: PROJECT_ID,
        receipt_date: form.receipt_date,
        vendor_name: form.vendor_name,
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
        receipt_type: form.receipt_type,
        receipt_number: form.receipt_number || `RC-${Date.now().toString().slice(-6)}`,
      });
    }
    setSaving(false);
    setShowModal(false);
    setForm(emptyForm);
    setEditingReceipt(null);
    fetchReceipts();
  };

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">บัญชี</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${receipts.length} รายการ`}
              </p>
            </div>
            <button
              onClick={() => { setEditingReceipt(null); setForm(emptyForm); setShowModal(true); }}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl"
            >
              <Plus size={14} /> บันทึกบิล
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={14} className="text-red-400" />
              <span className="text-xs text-aviva-secondary">รายจ่ายทั้งหมด</span>
            </div>
            <p className="text-lg font-bold text-red-400">฿{formatThb(totalExpense)}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-green-400" />
              <span className="text-xs text-aviva-secondary">รายรับทั้งหมด</span>
            </div>
            <p className="text-lg font-bold text-green-400">฿{formatThb(totalIncome)}</p>
          </GlassCard>
        </div>

        <div className="flex gap-2">
          {[
            { key: "all", label: "ทั้งหมด" },
            { key: "expense", label: "รายจ่าย" },
            { key: "income", label: "รายรับ" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterType(key as typeof filterType)}
              className={clsx(
                "px-4 py-1.5 rounded-full text-xs font-medium border transition-all",
                filterType === key
                  ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                  : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <SectionHeader title="รายการบิล / ใบเสร็จ" subtitle="กดปุ่ม + เพื่อเพิ่ม" />
          <div className="space-y-2">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            ) : filtered.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <Receipt size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีบิล/ใบเสร็จ</p>
                <p className="text-aviva-secondary/60 text-xs mt-1">กดปุ่ม + บันทึกบิล เพื่อเริ่มต้น</p>
              </GlassCard>
            ) : (
              filtered.map((r) => (
                <GlassCard key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={13} className={r.receipt_type === "expense" ? "text-red-400" : "text-green-400"} />
                        <p className="text-sm font-medium text-aviva-text truncate">{r.vendor_name}</p>
                        <span className="text-[10px] bg-aviva-gold/10 text-aviva-gold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {r.category}
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-xs text-aviva-secondary mt-0.5 truncate">{r.description}</p>
                      )}
                      <p className="text-[10px] text-aviva-secondary/60 mt-0.5">{r.receipt_date} · {r.receipt_number}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className={clsx(
                        "text-sm font-bold",
                        r.receipt_type === "expense" ? "text-red-400" : "text-green-400"
                      )}>
                        {r.receipt_type === "expense" ? "-" : "+"}฿{formatThb(Number(r.amount))}
                      </p>
                      <button
                        onClick={() => {
                          setEditingReceipt(r);
                          setForm({
                            receipt_number: r.receipt_number,
                            receipt_date: r.receipt_date,
                            vendor_name: r.vendor_name,
                            description: r.description,
                            amount: String(r.amount),
                            category: r.category,
                            receipt_type: r.receipt_type,
                          });
                          setShowModal(true);
                        }}
                        className="p-1.5 rounded-xl text-aviva-secondary/60 hover:text-aviva-gold hover:bg-aviva-gold/10 transition-colors flex-shrink-0"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">
                {editingReceipt ? "แก้ไขบิล / ใบเสร็จ" : "บันทึกบิล / ใบเสร็จ"}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingReceipt(null); }}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                {[
                  { val: "expense", label: "รายจ่าย", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                  { val: "income", label: "รายรับ", color: "bg-green-500/20 text-green-400 border-green-500/30" },
                ].map(({ val, label, color }) => (
                  <button
                    key={val}
                    onClick={() => setForm({ ...form, receipt_type: val })}
                    className={clsx(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                      form.receipt_type === val ? color : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">วันที่</label>
                  <input type="date" value={form.receipt_date}
                    onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เลขที่บิล (ถ้ามี)</label>
                  <input type="text" value={form.receipt_number}
                    onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
                    placeholder="RC-001"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>

              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อผู้ขาย / แหล่งที่มา *</label>
                <input type="text" value={form.vendor_name}
                  onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder="ร้าน / บริษัท / ชื่อ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>

              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด</label>
                <input type="text" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="รายละเอียดสินค้า/บริการ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท) *</label>
                  <input type="number" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                  <select value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button onClick={handleSave}
              disabled={saving || !form.vendor_name || !form.amount}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : editingReceipt ? "บันทึกการแก้ไข" : "บันทึก"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
