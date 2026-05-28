"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Copy, Check, Upload, ImageIcon, AlertCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import QRCodeDisplay from "@/components/security/QRCodeDisplay";
import { supabase } from "@/lib/supabase";

interface Bill {
  id: string;
  bill_type: string | null;
  period_label: string | null;
  amount: number;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  slip_url: string | null;
  payment_ref: string | null;
  promptpay_payload: string | null;
}

function fmtBaht(n: number) {
  return `฿${Number(n).toLocaleString("th-TH")}`;
}

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");

  const load = () => {
    supabase.from("bills").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      const b = data as Bill | null;
      setBill(b);
      setLoading(false);
      if (b?.promptpay_payload) setPayload(b.promptpay_payload);
    });
  };
  useEffect(load, [id]);

  const generateQr = async () => {
    setGenerating(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/promptpay-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ bill_id: id }),
    });
    const json = await res.json();
    setGenerating(false);
    if (res.ok) setPayload(json.payload);
    else setError(json.error ?? `error ${res.status}`);
  };

  const copyAmount = async () => {
    if (!bill) return;
    await navigator.clipboard.writeText(String(bill.amount));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("aviva-slips").upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("aviva-slips").getPublicUrl(path);
    const slipUrl = urlData.publicUrl;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/bills/${id}/slip`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ slip_url: slipUrl, payment_ref: paymentRef || null }),
    });
    const json = await res.json();
    setUploading(false);
    if (res.ok) {
      setUploadOpen(false);
      setPaymentRef("");
      load();
    } else {
      setError(json.error ?? `error ${res.status}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
      </div>
    );
  }
  if (!bill) {
    return (
      <div className="min-h-screen bg-aviva-bg p-8 text-center">
        <p className="text-aviva-secondary">ไม่พบบิล</p>
        <button onClick={() => router.back()} className="text-aviva-gold mt-3">ย้อนกลับ</button>
      </div>
    );
  }

  const isPaid = bill.status === "paid";

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/bills" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">{bill.bill_type ?? "ค่าส่วนกลาง"} {bill.period_label}</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">บิล #{bill.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <GlassCard className="p-6 text-center">
          <p className="text-xs text-aviva-secondary mb-1">ยอดชำระ</p>
          <button onClick={copyAmount} className="text-4xl font-bold text-aviva-gold inline-flex items-center gap-2">
            {fmtBaht(bill.amount)}
            {copied ? <Check size={20} className="text-green-400" /> : <Copy size={18} className="text-aviva-secondary/60" />}
          </button>
          <p className="text-xs text-aviva-secondary mt-1">แตะเพื่อคัดลอกยอด</p>

          {!isPaid ? (
            <div className="mt-5">
              {payload ? (
                <div className="flex flex-col items-center gap-3">
                  <QRCodeDisplay value={payload} size={260} caption="สแกนด้วย Mobile Banking / LINE Pay" />
                  <p className="text-xs text-aviva-secondary">PromptPay QR · ใช้กับแอปธนาคารไทยทุกราย</p>
                </div>
              ) : (
                <button onClick={generateQr} disabled={generating}
                  className="bg-aviva-gold text-aviva-bg font-bold px-6 py-3 rounded-2xl text-sm disabled:opacity-50">
                  {generating ? "กำลังสร้าง QR…" : "สร้าง PromptPay QR"}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
              ชำระแล้วเมื่อ {bill.paid_at ? new Date(bill.paid_at).toLocaleString("th-TH") : "—"}
            </div>
          )}
        </GlassCard>

        {!isPaid && (
          <>
            <button onClick={() => setUploadOpen(true)}
              className="w-full bg-aviva-card border border-aviva-gold/30 text-aviva-text font-medium py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2">
              <Upload size={16} /> อัปโหลดสลิปเพื่อยืนยันการโอน
            </button>
            {bill.slip_url && (
              <GlassCard className="p-3">
                <div className="flex items-center gap-2 text-xs text-aviva-secondary mb-2">
                  <ImageIcon size={14} /> สลิปที่อัปโหลด · รอนิติฯ ตรวจสอบ
                </div>
                <a href={bill.slip_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bill.slip_url} alt="slip" className="max-h-48 w-auto rounded-xl border border-aviva-gold/20" />
                </a>
                {bill.payment_ref && <p className="text-xs text-aviva-secondary mt-2">เลขอ้างอิง: {bill.payment_ref}</p>}
              </GlassCard>
            )}
          </>
        )}

        {error && (
          <div className="text-sm px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14 md:mb-6">
            <h2 className="text-lg font-bold text-aviva-text">อัปโหลดสลิป</h2>
            <div>
              <label className="text-sm text-aviva-secondary mb-1.5 block">เลขอ้างอิงการโอน (ไม่บังคับ)</label>
              <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                placeholder="REF-12345"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </div>
            <div>
              <label className="text-sm text-aviva-secondary mb-1.5 block">รูปสลิป *</label>
              <input type="file" accept="image/*" disabled={uploading}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
                className={clsx(
                  "w-full text-sm text-aviva-text file:mr-3 file:px-4 file:py-2.5 file:rounded-lg",
                  "file:border-0 file:bg-aviva-gold file:text-aviva-bg file:font-bold file:text-sm"
                )} />
              {uploading && <p className="text-sm text-aviva-secondary mt-2">กำลังอัปโหลด…</p>}
            </div>
            <button onClick={() => setUploadOpen(false)}
              className="w-full text-sm text-aviva-secondary bg-aviva-bg/50 border border-aviva-gold/10 rounded-2xl py-3">ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  );
}
