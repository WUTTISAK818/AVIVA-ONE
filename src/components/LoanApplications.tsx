"use client";

import { useEffect, useState } from "react";
import { Landmark, Plus, CheckCircle, XCircle, X, Clock } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { formatNumber } from "@/lib/thai-baht";

const BANKS = [
  "ธอส. (อาคารสงเคราะห์)", "ธ.กรุงไทย", "ธ.ออมสิน", "ธ.กรุงเทพ", "ธ.กสิกรไทย",
  "ธ.ไทยพาณิชย์", "ธ.กรุงศรีอยุธยา", "ธ.ทหารไทยธนชาต (ttb)", "ธ.ซีไอเอ็มบี ไทย", "ธ.ยูโอบี", "อื่นๆ",
];

const STATUS = {
  submitted: { label: "ยื่นแล้ว — รอผล", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: Clock },
  approved: { label: "อนุมัติ", cls: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
} as const;

interface LoanApp {
  id: string;
  bank_name: string;
  requested_amount: number | null;
  approved_amount: number | null;
  status: keyof typeof STATUS;
  submitted_date: string | null;
  result_date: string | null;
  rejection_reason: string | null;
  notes: string | null;
}

export default function LoanApplications({
  leadId, defaultAmount, onApproved,
}: {
  leadId: string;
  defaultAmount?: number | null;
  onApproved?: (approvedAmount: number | null) => void;
}) {
  const user = useCurrentUser();
  const [apps, setApps] = useState<LoanApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bank_name: BANKS[0], requested_amount: "", notes: "" });
  const [result, setResult] = useState<{ id: string; type: "approved" | "rejected" } | null>(null);
  const [resultVal, setResultVal] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const load = async () => {
    const { data } = await supabase.from("loan_applications")
      .select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
    setApps((data as LoanApp[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leadId]);

  const add = async () => {
    setSaving(true);
    await supabase.from("loan_applications").insert({
      lead_id: leadId,
      bank_name: form.bank_name,
      requested_amount: form.requested_amount ? Number(form.requested_amount) : (defaultAmount ?? null),
      status: "submitted",
      submitted_date: today,
      notes: form.notes || null,
      created_by: user?.full_name ?? user?.email ?? null,
    });
    setSaving(false);
    setAdding(false);
    setForm({ bank_name: BANKS[0], requested_amount: "", notes: "" });
    load();
  };

  const saveResult = async () => {
    if (!result) return;
    setSaving(true);
    const patch = result.type === "approved"
      ? { status: "approved", approved_amount: resultVal ? Number(resultVal) : null, result_date: today, rejection_reason: null }
      : { status: "rejected", rejection_reason: resultVal || null, result_date: today };
    await supabase.from("loan_applications").update(patch).eq("id", result.id);
    if (result.type === "approved") onApproved?.(resultVal ? Number(resultVal) : null);
    setSaving(false);
    setResult(null);
    setResultVal("");
    load();
  };

  const approvedCount = apps.filter(a => a.status === "approved").length;

  return (
    <div className="bg-aviva-bg rounded-xl p-3 border border-aviva-gold/10 col-span-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-aviva-text flex items-center gap-1.5">
          <Landmark size={13} className="text-aviva-gold" /> สินเชื่อ / การยื่นกู้
          {apps.length > 0 && <span className="text-aviva-secondary font-normal">· ยื่น {apps.length} · อนุมัติ {approvedCount}</span>}
        </p>
        {!adding && (
          <button onClick={() => { setForm(f => ({ ...f, requested_amount: defaultAmount ? String(defaultAmount) : "" })); setAdding(true); }}
            className="flex items-center gap-1 text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg">
            <Plus size={11} /> เพิ่มธนาคาร
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-8 rounded-lg bg-aviva-card/50 animate-pulse" />
      ) : apps.length === 0 && !adding ? (
        <p className="text-[11px] text-aviva-secondary/60">ยังไม่มีการยื่นกู้ — แตะ &ldquo;เพิ่มธนาคาร&rdquo;</p>
      ) : (
        <div className="space-y-2">
          {apps.map((a) => {
            const sc = STATUS[a.status] ?? STATUS.submitted;
            const Icon = sc.icon;
            return (
              <div key={a.id} className="bg-aviva-card/60 rounded-lg p-2.5 border border-aviva-gold/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-aviva-text">{a.bank_name}</span>
                  <span className={clsx("text-[9px] px-1.5 py-0.5 rounded-full border flex items-center gap-0.5", sc.cls)}>
                    <Icon size={9} /> {sc.label}
                  </span>
                </div>
                <div className="text-[10px] text-aviva-secondary mt-1 flex flex-wrap gap-x-3">
                  {a.requested_amount != null && <span>ขอ ฿{formatNumber(a.requested_amount)}</span>}
                  {a.approved_amount != null && <span className="text-green-400">อนุมัติ ฿{formatNumber(a.approved_amount)}</span>}
                  {a.submitted_date && <span>ยื่น {new Date(a.submitted_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>}
                </div>
                {a.rejection_reason && <p className="text-[10px] text-red-400 mt-0.5">เหตุผล: {a.rejection_reason}</p>}
                {a.status === "submitted" && (
                  <div className="flex gap-1.5 mt-1.5">
                    <button onClick={() => { setResult({ id: a.id, type: "approved" }); setResultVal(a.requested_amount ? String(a.requested_amount) : ""); }}
                      className="flex-1 py-1 text-[10px] bg-green-500/15 text-green-400 border border-green-500/25 rounded-md">บันทึกอนุมัติ</button>
                    <button onClick={() => { setResult({ id: a.id, type: "rejected" }); setResultVal(""); }}
                      className="flex-1 py-1 text-[10px] bg-red-500/15 text-red-400 border border-red-500/25 rounded-md">ไม่อนุมัติ</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="mt-2 space-y-2 bg-aviva-card/60 rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-aviva-text">เพิ่มการยื่นกู้</span>
            <button onClick={() => setAdding(false)}><X size={14} className="text-aviva-secondary" /></button>
          </div>
          <select value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })}
            className="w-full bg-aviva-bg border border-aviva-gold/15 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none">
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input inputMode="numeric" value={form.requested_amount} onChange={e => setForm({ ...form, requested_amount: e.target.value })}
            placeholder="วงเงินที่ขอกู้ (บาท)"
            className="w-full bg-aviva-bg border border-aviva-gold/15 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none" />
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="หมายเหตุ (ถ้ามี)"
            className="w-full bg-aviva-bg border border-aviva-gold/15 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none" />
          <button onClick={add} disabled={saving}
            className="w-full py-2 bg-aviva-gold text-aviva-bg text-xs font-bold rounded-lg disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "บันทึกการยื่นกู้"}
          </button>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setResult(null)}>
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 space-y-3 mb-14" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-aviva-text">{result.type === "approved" ? "บันทึกผลอนุมัติ" : "บันทึกไม่อนุมัติ"}</h3>
            <input inputMode={result.type === "approved" ? "numeric" : "text"} value={resultVal} onChange={e => setResultVal(e.target.value)}
              placeholder={result.type === "approved" ? "วงเงินที่อนุมัติ (บาท)" : "เหตุผลที่ไม่อนุมัติ"}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            <button onClick={saveResult} disabled={saving}
              className={clsx("w-full py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50", result.type === "approved" ? "bg-green-500" : "bg-red-500")}>
              {saving ? "กำลังบันทึก..." : "ยืนยัน"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
