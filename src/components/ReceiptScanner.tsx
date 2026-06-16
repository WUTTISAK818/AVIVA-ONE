"use client";

import { useRef, useState } from "react";
import { ScanLine, X, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { createNotification } from "@/lib/notify";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const CATEGORIES = [
  "ค่าวัสดุก่อสร้าง", "ค่าแรง/ค่าจ้างผู้รับเหมา", "ค่าการตลาด/โฆษณา",
  "ค่าสาธารณูปโภค (น้ำ/ไฟ/เน็ต)", "เงินเดือน/สวัสดิการ", "ค่าใช้จ่ายสำนักงาน",
  "ค่าธรรมเนียม/ภาษี", "รับชำระงวด/เงินดาวน์", "รายได้จากการขาย", "อื่นๆ",
];

interface Draft {
  transaction_type: "income" | "expense";
  amount: string;
  date: string;
  vendor_name: string;
  category: string;
  description: string;
  confidence?: string;
}

// #สแกนใบเสร็จ/สลิป → ลงบัญชีอัตโนมัติ — อ่านด้วย AI แล้วให้ผู้ใช้ยืนยันก่อนบันทึก finance_transactions
export default function ReceiptScanner({ onSaved }: { onSaved?: () => void }) {
  const user = useCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const pick = () => { setErr(""); setDone(false); fileRef.current?.click(); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true); setErr(""); setDraft(null);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/accounting/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ imageBase64: b64, mediaType: file.type || "image/jpeg" }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json?.error ?? "สแกนไม่สำเร็จ"); setScanning(false); return; }
      const r = json.result;
      setDraft({
        transaction_type: r.transaction_type === "income" ? "income" : "expense",
        amount: String(r.amount ?? ""),
        date: r.date ?? new Date().toISOString().slice(0, 10),
        vendor_name: r.vendor_name ?? "",
        category: CATEGORIES.includes(r.category) ? r.category : "อื่นๆ",
        description: r.description ?? "",
        confidence: r.confidence,
      });
    } catch {
      setErr("อ่านไฟล์ไม่สำเร็จ");
    }
    setScanning(false);
  };

  const save = async () => {
    if (!draft || !Number(draft.amount)) return;
    setSaving(true);
    const { error } = await supabase.from("finance_transactions").insert({
      transaction_type: draft.transaction_type,
      amount: Number(draft.amount),
      category: draft.category,
      description: `${draft.description}${draft.vendor_name ? ` — ${draft.vendor_name}` : ""}${draft.date ? ` (${draft.date})` : ""}`,
      approved_by: user?.id ?? null,
      project_id: PROJECT_ID,
    });
    setSaving(false);
    if (error) { setErr("บันทึกไม่สำเร็จ: " + error.message); return; }
    await createNotification({
      type: "success",
      title: `ลงบัญชีจากสลิป — ${draft.transaction_type === "income" ? "รายรับ" : "รายจ่าย"}`,
      message: `${draft.category} ฿${Number(draft.amount).toLocaleString("th-TH")}${draft.vendor_name ? ` · ${draft.vendor_name}` : ""}`,
      from_dept: "ฝ่ายบัญชี", to_dept: "ฝ่ายการเงิน",
    });
    setDraft(null); setDone(true);
    onSaved?.();
  };

  const inputCls = "w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60";

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      <button onClick={pick} disabled={scanning}
        className="w-full flex items-center justify-center gap-2 bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/30 font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
        {scanning ? <><Loader2 size={16} className="animate-spin" /> กำลังอ่านเอกสาร...</> : <><ScanLine size={16} /> สแกนใบเสร็จ/สลิป → ลงบัญชี</>}
      </button>
      {done && <p className="text-[11px] text-green-400 mt-2 flex items-center gap-1"><CheckCircle size={12} /> ลงบัญชีเรียบร้อยแล้ว</p>}
      {err && <p className="text-[11px] text-red-400 mt-2">{err}</p>}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-3 max-h-[88vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-aviva-text">ตรวจสอบก่อนลงบัญชี</h2>
              <button onClick={() => setDraft(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {draft.confidence && draft.confidence !== "high" && (
              <p className="text-[11px] text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2">AI ไม่มั่นใจการอ่าน ({draft.confidence}) — โปรดตรวจทานก่อนบันทึก</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDraft({ ...draft, transaction_type: "expense" })}
                className={`py-2.5 rounded-xl text-sm font-bold border ${draft.transaction_type === "expense" ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"}`}>รายจ่าย</button>
              <button onClick={() => setDraft({ ...draft, transaction_type: "income" })}
                className={`py-2.5 rounded-xl text-sm font-bold border ${draft.transaction_type === "income" ? "bg-green-500/20 text-green-400 border-green-500/40" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"}`}>รายรับ</button>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท)</label>
              <input type="number" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่</label>
                <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้รับเงิน/ร้าน</label>
                <input type="text" value={draft.vendor_name} onChange={e => setDraft({ ...draft, vendor_name: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">หมวดบัญชี</label>
              <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด</label>
              <input type="text" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className={inputCls} />
            </div>
            <button onClick={save} disabled={saving || !Number(draft.amount)}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "ยืนยัน ลงบัญชี"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
