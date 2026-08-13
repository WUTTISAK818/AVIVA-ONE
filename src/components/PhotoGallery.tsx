"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface PhotoGalleryProps {
  photos?: string[] | null;
  captions?: (string | null | undefined)[] | null;
  title?: string;
  onDelete?: (index: number) => void;
  isEditable?: boolean;
}

export function PhotoGallery({ photos = [], captions = [], title = "ภาพแนบ", onDelete, isEditable = false }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photoArray = photos?.filter(Boolean) || [];

  // ปิด/เลื่อนด้วยคีย์บอร์ด (ผูกกับ window จริง — เดิมผูกกับ div ที่ hidden เลยกด ESC ไม่ได้)
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowLeft") setLightboxIndex((p) => (p === null ? p : p === 0 ? photoArray.length - 1 : p - 1));
      else if (e.key === "ArrowRight") setLightboxIndex((p) => (p === null ? p : p === photoArray.length - 1 ? 0 : p + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photoArray.length]);

  if (!photoArray || photoArray.length === 0) {
    return (
      <div className="text-center py-6 text-aviva-secondary/60">
        <p className="text-xs">ไม่มีรูปแนบ</p>
      </div>
    );
  }

  const handlePrevious = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((prev) => (prev === 0 ? photoArray.length - 1 : (prev ?? 0) - 1));
    }
  };

  const handleNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((prev) => (prev === photoArray.length - 1 ? 0 : (prev ?? 0) + 1));
    }
  };

  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-semibold text-aviva-text">{title}</p>}

      {/* Photo Grid */}
      <div className="grid grid-cols-3 gap-2">
        {photoArray.map((photoUrl, idx) => (
          <div key={idx} className="space-y-1">
            <div
              className="relative group cursor-pointer overflow-hidden rounded-lg bg-aviva-bg/50 border border-aviva-gold/10 aspect-square"
              onClick={() => setLightboxIndex(idx)}
            >
              <img
                src={photoUrl}
                alt={captions?.[idx] || `Photo ${idx + 1}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <span className="text-white text-xs font-semibold">{idx + 1}</span>
              </div>

              {/* Delete button */}
              {isEditable && onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(idx);
                  }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete photo"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {captions?.[idx] && (
              <p className="text-[10px] text-aviva-secondary leading-tight line-clamp-2">{captions[idx]}</p>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox — z สูงกว่าโมดัลรายงาน · แตะพื้นที่ว่างเพื่อปิด */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* Close button (แตะปิด) */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 text-white"
            aria-label="ปิด"
          >
            <X size={26} />
          </button>

          {/* Image container (กดที่รูปไม่ปิด) */}
          <div className="flex-1 flex flex-col items-center justify-center max-w-4xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={photoArray[lightboxIndex]}
              alt={captions?.[lightboxIndex] || `Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            {captions?.[lightboxIndex] && (
              <p className="text-white/90 text-sm text-center mt-3 px-4 max-w-2xl">{captions[lightboxIndex]}</p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handlePrevious}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
              disabled={photoArray.length <= 1}
              aria-label="Previous photo"
            >
              <ChevronLeft size={24} />
            </button>

            <span className="text-white text-sm font-semibold">
              {lightboxIndex + 1} / {photoArray.length}
            </span>

            <button
              onClick={handleNext}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
              disabled={photoArray.length <= 1}
              aria-label="Next photo"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <p className="text-white/50 text-xs mt-3">แตะพื้นที่ว่าง · กากบาท · หรือ ESC เพื่อปิด</p>
        </div>
      )}
    </div>
  );
}
