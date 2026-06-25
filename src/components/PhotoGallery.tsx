"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface PhotoGalleryProps {
  photos?: string[] | null;
  title?: string;
  onDelete?: (index: number) => void;
  isEditable?: boolean;
}

export function PhotoGallery({ photos = [], title = "ภาพแนบ", onDelete, isEditable = false }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photoArray = photos?.filter(Boolean) || [];

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
          <div
            key={idx}
            className="relative group cursor-pointer overflow-hidden rounded-lg bg-aviva-bg/50 border border-aviva-gold/10 aspect-square"
            onClick={() => setLightboxIndex(idx)}
          >
            <img
              src={photoUrl}
              alt={`Photo ${idx + 1}`}
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
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          {/* Close button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Close lightbox"
          >
            <X size={24} />
          </button>

          {/* Image container */}
          <div className="flex-1 flex items-center justify-center max-w-4xl max-h-[85vh]">
            <img
              src={photoArray[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-4">
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

          {/* Keyboard shortcuts hint */}
          <p className="text-white/50 text-xs mt-3">Press ESC to close</p>
        </div>
      )}

      {/* Keyboard handler */}
      {lightboxIndex !== null && (
        <div
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightboxIndex(null);
            if (e.key === "ArrowLeft") handlePrevious();
            if (e.key === "ArrowRight") handleNext();
          }}
          tabIndex={0}
          className="hidden"
        />
      )}
    </div>
  );
}
