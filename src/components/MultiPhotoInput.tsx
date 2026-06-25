"use client";
import { useEffect, useState } from "react";
import { Camera, X, FileText } from "lucide-react";
import SignedImg from "./SignedImg";

// ช่องแนบรูปหลายรูปพร้อมกัน (controlled) — ใช้ร่วมทุกฟอร์มที่ต้องแนบหลายรูป
// - value: ไฟล์ใหม่ที่ผู้ใช้เลือก (ยังไม่อัป)  → onChange ส่งกลับ array ใหม่
// - existingUrls: รูปที่อัปไว้แล้ว (ตอนแก้ไข) แสดงพร้อมปุ่มลบถ้ามี onRemoveExisting
export default function MultiPhotoInput({
  value,
  onChange,
  label = "ถ่ายรูป / เลือกได้หลายรูป",
  accept = "image/*",
  existingUrls = [],
  onRemoveExisting,
}: {
  value: File[];
  onChange: (files: File[]) => void;
  label?: string;
  accept?: string;
  existingUrls?: string[];
  onRemoveExisting?: (url: string) => void;
}) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = value.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [value]);

  const total = value.length + existingUrls.length;

  return (
    <div className="space-y-2">
      <label className="cursor-pointer flex items-center gap-3 w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 hover:border-aviva-gold/40 transition-all">
        <input
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) onChange([...value, ...picked]);
            e.target.value = "";
          }}
        />
        <Camera size={15} className="text-aviva-secondary/60 flex-shrink-0" />
        <span className="text-xs text-aviva-secondary/60 flex-1">
          {total > 0 ? `แนบแล้ว ${total} รูป — แตะเพื่อเพิ่ม` : label}
        </span>
      </label>

      {total > 0 && (
        <div className="flex flex-wrap gap-2">
          {existingUrls.map((u) => (
            <div key={`ex-${u}`} className="relative">
              <SignedImg src={u} alt="รูปแนบ" imgClassName="w-14 h-14 rounded-lg object-cover border border-aviva-gold/20" />
              {onRemoveExisting && (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(u)}
                  aria-label="ลบรูปนี้"
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 leading-none"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {value.map((f, i) => (
            <div key={`new-${i}-${previews[i] ?? f.name}`} className="relative">
              {f.type.startsWith("image/") && previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i]} alt="รูปที่เลือก" className="w-14 h-14 rounded-lg object-cover border border-aviva-gold/20" />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-aviva-gold/20 bg-aviva-bg flex flex-col items-center justify-center gap-0.5 p-1">
                  <FileText size={16} className="text-aviva-gold" />
                  <span className="text-[7px] text-aviva-secondary/70 leading-tight truncate w-full text-center">{f.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label="ลบรูปนี้"
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 leading-none"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
