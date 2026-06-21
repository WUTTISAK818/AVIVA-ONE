"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

interface Props {
  residentId: string;
  residentName: string;
  phone: string;
  onClose: () => void;
  onVerified: () => void;
}

export default function LineVerifyModal({ residentId, residentName, phone, onClose, onVerified }: Props) {
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [lineUrl, setLineUrl] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/winvote/line/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ resident_id: residentId }),
        });
        const json = await res.json();
        if (!active) return;
        if (json.alreadyVerified) { setVerified(true); setLoading(false); return; }
        if (!res.ok) { setError(json.error ?? "เริ่มการยืนยันไม่สำเร็จ"); setLoading(false); return; }
        if (json.needsSetup) { setNeedsSetup(true); setLoading(false); return; }
        setLineUrl(json.line_url);
        const dataUrl = await QRCode.toDataURL(json.line_url, { width: 240, margin: 1 });
        if (!active) return;
        setQrDataUrl(dataUrl);
        setLoading(false);
      } catch {
        if (active) { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [residentId]);

  // poll สถานะ phone_verified ของชาวบ้าน
  useEffect(() => {
    if (needsSetup || error || verified) return;
    if (!qrDataUrl) return;
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .schema("winvote").from("residents")
        .select("phone_verified")
        .eq("id", residentId)
        .single();
      if (data?.phone_verified) {
        setVerified(true);
        stopPoll();
      }
    }, 3000);
    return stopPoll;
  }, [qrDataUrl, needsSetup, error, verified, residentId, stopPoll]);

  useEffect(() => {
    if (verified) { const t = setTimeout(onVerified, 1200); return () => clearTimeout(t); }
  }, [verified, onVerified]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-aviva-text">ยืนยันเบอร์ผ่าน LINE</h2>
            <p className="text-xs text-aviva-secondary">{residentName} · {phone}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-aviva-secondary" /></button>
        </div>

        {loading && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader2 size={28} className="text-aviva-gold animate-spin" />
            <p className="text-sm text-aviva-secondary">กำลังเตรียม QR Code...</p>
          </div>
        )}

        {verified && (
          <div className="flex flex-col items-center py-10 gap-3">
            <CheckCircle2 size={48} className="text-green-400" />
            <p className="text-base font-bold text-green-400">ยืนยันเบอร์สำเร็จ</p>
          </div>
        )}

        {needsSetup && !loading && (
          <div className="flex flex-col items-center py-6 gap-3 text-center">
            <AlertTriangle size={32} className="text-yellow-400" />
            <p className="text-sm text-aviva-text font-medium">ยังไม่ได้ตั้งค่า LINE OA</p>
            <p className="text-xs text-aviva-secondary">
              ต้องตั้งค่า env: <span className="font-mono">LINE_OA_ID</span>,{" "}
              <span className="font-mono">LINE_CHANNEL_SECRET</span>,{" "}
              <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> ก่อนใช้งานการยืนยันผ่าน LINE
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center py-6 gap-2 text-center">
            <AlertTriangle size={32} className="text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {qrDataUrl && !verified && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="LINE QR" width={220} height={220} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm text-aviva-text font-medium">ให้ชาวบ้านสแกน QR นี้ด้วยกล้อง/LINE</p>
              <p className="text-xs text-aviva-secondary">แอป LINE จะเปิดแชตพร้อมข้อความ — แตะ “ส่ง” เพื่อยืนยัน (ไม่ต้องกรอกรหัส)</p>
            </div>
            {lineUrl && (
              <a href={lineUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-green-500/15 text-green-400 border border-green-500/30 rounded-xl text-sm font-medium">
                <Smartphone size={16} /> เปิดใน LINE บนเครื่องนี้
              </a>
            )}
            <div className="flex items-center gap-2 text-xs text-aviva-secondary">
              <Loader2 size={12} className="animate-spin" /> รอการยืนยัน...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
