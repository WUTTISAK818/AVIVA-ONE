"use client";
import { useState } from "react";
import { Camera, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface PresenceProof {
  selfie_path: string;
  capture_lat: number | null;
  capture_lng: number | null;
  captured_at: string;
}

interface Props {
  /** เก็บ selfie ไว้ใต้โฟลเดอร์นี้ใน bucket canvass-proof (เช่น national_id) */
  refKey: string;
  onCaptured: (proof: PresenceProof) => void;
  onError?: (message: string) => void;
}

function getPosition(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

export default function PresenceCapture({ refKey, onCaptured, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<PresenceProof | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      // ขอพิกัด GPS + เวลา ควบคู่กับ selfie เพื่อยืนยันการพบตัวจริง
      const { lat, lng } = await getPosition();
      const capturedAt = new Date().toISOString();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${refKey || "unknown"}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("canvass-proof")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        onError?.("อัปโหลดรูปยืนยันไม่สำเร็จ");
        return;
      }
      const proof: PresenceProof = {
        selfie_path: path,
        capture_lat: lat,
        capture_lng: lng,
        captured_at: capturedAt,
      };
      setDone(proof);
      onCaptured(proof);
    } catch {
      onError?.("เกิดข้อผิดพลาดในการยืนยันการพบตัว");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="cursor-pointer flex items-center gap-3 w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3.5">
        <input
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {loading ? (
          <Loader2 size={18} className="text-aviva-gold animate-spin" />
        ) : done ? (
          <CheckCircle2 size={18} className="text-green-400" />
        ) : (
          <Camera size={18} className="text-aviva-secondary/60" />
        )}
        <span className="text-sm font-medium text-aviva-text">
          {loading ? "กำลังบันทึกหลักฐาน..." : done ? "ยืนยันการพบตัวแล้ว" : "ถ่าย selfie เจ้าของบัตร (ยืนยันพบตัวจริง)"}
        </span>
      </label>
      {done && (
        <p className="text-[11px] text-aviva-secondary flex items-center gap-1">
          <MapPin size={11} className="text-aviva-gold" />
          {done.capture_lat != null && done.capture_lng != null
            ? `พิกัด ${done.capture_lat.toFixed(5)}, ${done.capture_lng.toFixed(5)}`
            : "ไม่ได้รับพิกัด GPS (ตรวจสอบการอนุญาตตำแหน่ง)"}
          {" · "}
          {new Date(done.captured_at).toLocaleString("th-TH")}
        </p>
      )}
    </div>
  );
}
