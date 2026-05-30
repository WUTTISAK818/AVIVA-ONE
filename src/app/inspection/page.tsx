"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface InstallmentInfo {
  id: string;
  name: string;
  status: string;
  amount: number;
  contractor_notes?: string | null;
}

interface InspectionItem {
  id: string;
  work_item_name: string;
  result: "pass" | "fail" | "pending";
  note: string | null;
  photo_url: string | null;
}

export default function InspectionPage() {
  const params = useSearchParams();
  const id = params.get("id");

  const [installment, setInstallment] = useState<InstallmentInfo | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError("ไม่พบ ID งวดงาน"); setLoading(false); return; }
    const load = async () => {
      const { data: inst, error: instErr } = await supabase
        .from("contractor_installments")
        .select("id, name, status, amount, contractor_notes")
        .eq("id", id)
        .single();
      if (instErr || !inst) { setError("ไม่พบข้อมูลงวดงาน"); setLoading(false); return; }
      setInstallment(inst as InstallmentInfo);
      setNotes((inst as InstallmentInfo).contractor_notes ?? "");

      const { data: insps } = await supabase
        .from("installment_inspections")
        .select("id, work_item_name, result, note, photo_url")
        .eq("contractor_installment_id", id)
        .order("id");
      setItems((insps ?? []) as InspectionItem[]);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSaveNotes = async () => {
    if (!id) return;
    setSaving(true);
    await supabase
      .from("contractor_installments")
      .upsert({ id, contractor_notes: notes }, { onConflict: "id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-gray-400 text-sm animate-pulse">กำลังโหลด...</p>
      </div>
    );
  }

  if (error || !installment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-red-400 text-sm">{error ?? "เกิดข้อผิดพลาด"}</p>
      </div>
    );
  }

  const passCount = items.filter(i => i.result === "pass").length;
  const failCount = items.filter(i => i.result === "fail").length;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 text-white max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 mb-1">ลิงก์ตรวจสอบงาน (สาธารณะ)</p>
        <h1 className="text-lg font-bold text-white">{installment.name}</h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-400">฿{Number(installment.amount).toLocaleString()}</span>
          <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full bg-gray-800">{installment.status}</span>
        </div>
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="flex gap-4 mb-4 text-sm">
          <span className="text-green-400 font-semibold">✓ ผ่าน {passCount}</span>
          <span className="text-red-400 font-semibold">✗ ไม่ผ่าน {failCount}</span>
          <span className="text-gray-500">/ {items.length} รายการ</span>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-2 mb-6">
        {items.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">ยังไม่มีรายการตรวจงาน</p>
        )}
        {items.map(item => (
          <div key={item.id} className={`rounded-xl p-3 border ${
            item.result === "pass" ? "border-green-500/40 bg-green-900/10"
            : item.result === "fail" ? "border-red-500/40 bg-red-900/10"
            : "border-gray-700 bg-gray-900"
          }`}>
            <div className="flex items-center gap-2">
              {item.result === "pass" ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
               : item.result === "fail" ? <XCircle size={14} className="text-red-400 flex-shrink-0" />
               : <Clock size={14} className="text-gray-500 flex-shrink-0" />}
              <p className="text-sm text-white">{item.work_item_name}</p>
            </div>
            {item.note && (
              <p className="text-xs text-gray-400 mt-1 ml-5">{item.note}</p>
            )}
            {item.photo_url && (
              <img src={item.photo_url} alt="รูปตรวจ" className="mt-2 ml-5 w-20 h-20 object-cover rounded-lg border border-gray-700" />
            )}
          </div>
        ))}
      </div>

      {/* Contractor Notes */}
      <div className="border border-gray-700 rounded-xl p-4 bg-gray-900">
        <p className="text-sm font-semibold text-gray-300 mb-2">หมายเหตุจากผู้รับเหมา</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          placeholder="พิมพ์หมายเหตุหรือข้อสังเกตของผู้รับเหมา..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none resize-none"
        />
        <button
          onClick={handleSaveNotes}
          disabled={saving}
          className="mt-2 w-full py-2 rounded-xl text-sm font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : saved ? "บันทึกแล้ว ✓" : "บันทึกหมายเหตุ"}
        </button>
      </div>

      <p className="text-center text-xs text-gray-700 mt-6">AVIVA ONE — หน้านี้เป็นสาธารณะ ไม่ต้องล็อกอิน</p>
    </div>
  );
}
