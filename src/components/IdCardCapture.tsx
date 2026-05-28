"use client";
import { useState } from "react";
import { Camera, Loader2, ScanLine } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface ExtractedIdFields {
  national_id: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  address: string | null;
}

interface Props {
  onExtracted: (fields: ExtractedIdFields) => void;
  onError?: (message: string) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function IdCardCapture({ onExtracted, onError }: Props) {
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const dataUrl = await fileToBase64(file);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/canvass/extract-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError?.(json.error ?? "อ่านบัตรไม่สำเร็จ");
        return;
      }
      onExtracted(json.fields as ExtractedIdFields);
    } catch {
      onError?.("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <label className="cursor-pointer flex items-center gap-3 w-full bg-aviva-bg border border-aviva-gold/40 rounded-xl px-4 py-3.5">
      <input
        type="file"
        accept="image/*"
        capture="environment"
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
      ) : (
        <ScanLine size={18} className="text-aviva-gold" />
      )}
      <span className="text-sm font-medium text-aviva-text">
        {loading ? "กำลังอ่านข้อมูลจากบัตร..." : "ถ่ายรูปบัตรประชาชนเพื่ออ่านข้อมูล"}
      </span>
      <Camera size={16} className="text-aviva-secondary/60 ml-auto" />
    </label>
  );
}
