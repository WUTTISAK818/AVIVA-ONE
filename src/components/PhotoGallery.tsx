"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import Image from "next/image";

interface PhotoGalleryProps {
  photos?: string[] | null;
  captions?: (string | null | undefined)[] | null;
  title?: string;
  onDelete?: (index: number) => void;
  isEditable?: boolean;
}

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

function touchDistance(t1: React.Touch, t2: React.Touch) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

export function PhotoGallery({ photos = [], captions = [], title = "ภาพแนบ", onDelete, isEditable = false }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const photoArray = photos?.filter(Boolean) || [];

  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTapRef = useRef(0);

  // รูปใหม่/ปิด lightbox → รีเซ็ตซูมกลับ 1x เสมอ กันซูมค้างข้ามรูป
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [lightboxIndex]);

  const setClampedScale = (next: number) => {
    const s = Math.min(MAX_SCALE, Math.max(1, next));
    setScale(s);
    if (s <= 1) setTranslate({ x: 0, y: 0 });
  };

  const toggleZoom = () => {
    if (scale > 1) setClampedScale(1);
    else setClampedScale(DOUBLE_TAP_SCALE);
  };

  // ปิด/เลื่อนด้วยคีย์บอร์ด (ผูกกับ window จริง — เดิมผูกกับ div ที่ hidden เลยกด ESC ไม่ได้)
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowLeft") setLightboxIndex((p) => (p === null ? p : p === 0 ? photoArray.length - 1 : p - 1));
      else if (e.key === "ArrowRight") setLightboxIndex((p) => (p === null ? p : p === photoArray.length - 1 ? 0 : p + 1));
      else if (e.key === "+" || e.key === "=") setClampedScale(scale + 0.5);
      else if (e.key === "-") setClampedScale(scale - 0.5);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, photoArray.length, scale]);

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

  // มือถือ: บีบนิ้วซูม + ลากเลื่อนตอนซูมค้าง + แตะสองครั้งสลับซูม
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartRef.current = { dist: touchDistance(e.touches[0], e.touches[1]), scale };
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: translate.x, ty: translate.y };
      }
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        toggleZoom();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const dist = touchDistance(e.touches[0], e.touches[1]);
      setClampedScale(pinchStartRef.current.scale * (dist / pinchStartRef.current.dist));
    } else if (e.touches.length === 1 && dragStartRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setTranslate({ x: dragStartRef.current.tx + dx, y: dragStartRef.current.ty + dy });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchStartRef.current = null;
    if (e.touches.length === 0) dragStartRef.current = null;
  };

  // เดสก์ท็อป: ล้อเมาส์ซูม + ลากเมาส์เลื่อนตอนซูมค้าง + ดับเบิลคลิกสลับซูม
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setClampedScale(scale + (e.deltaY < 0 ? 0.3 : -0.3));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStartRef.current) return;
    setTranslate({ x: dragStartRef.current.tx + (e.clientX - dragStartRef.current.x), y: dragStartRef.current.ty + (e.clientY - dragStartRef.current.y) });
  };

  const onMouseUp = () => { dragStartRef.current = null; };

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

          {/* ปุ่มซูมด่วน */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleZoom(); }}
            className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-white/15 hover:bg-white/30 active:bg-white/40 text-white text-xs font-semibold"
            aria-label="ซูม"
          >
            <ZoomIn size={18} /> {scale > 1 ? `${Math.round(scale * 100)}%` : "ซูม"}
          </button>

          {/* Image container (กดที่รูปไม่ปิด) — บีบนิ้ว/ล้อเมาส์ซูม, ลากเลื่อนตอนซูมค้าง, ดับเบิลแทป/คลิกสลับซูม */}
          <div
            className="flex-1 w-full flex flex-col items-center justify-center max-w-4xl max-h-[85vh] overflow-hidden"
            style={{ touchAction: "none" }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onDoubleClick={toggleZoom}
          >
            <img
              src={photoArray[lightboxIndex]}
              alt={captions?.[lightboxIndex] || `Photo ${lightboxIndex + 1}`}
              draggable={false}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transition: dragStartRef.current ? "none" : "transform 0.15s ease-out",
                cursor: scale > 1 ? "grab" : "zoom-in",
              }}
            />
            {captions?.[lightboxIndex] && scale === 1 && (
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

          <p className="text-white/50 text-xs mt-3">บีบนิ้ว/ล้อเมาส์ซูม · ดับเบิลแทปสลับซูม · แตะพื้นที่ว่าง/กากบาท/ESC เพื่อปิด</p>
        </div>
      )}
    </div>
  );
}
