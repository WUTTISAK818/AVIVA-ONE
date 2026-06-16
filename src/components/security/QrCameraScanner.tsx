"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

export default function QrCameraScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let scanner: { destroy: () => void; start: () => Promise<void> } | null = null;

    import("qr-scanner")
      .then((mod) => {
        if (cancelled || !videoRef.current) return;
        const QrScanner = mod.default;
        scanner = new QrScanner(
          videoRef.current,
          (res: { data: string }) => onScan(res.data),
          { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 3 }
        );
        scannerRef.current = scanner;
        scanner.start().catch((e: Error) => {
          setError(e.message);
        });
      })
      .catch((e) => setError(e.message));

    return () => {
      cancelled = true;
      if (scanner) scanner.destroy();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-aviva-card border border-aviva-gold/30 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b border-aviva-gold/20">
          <div className="flex items-center gap-2 text-aviva-text">
            <Camera size={18} className="text-aviva-gold" />
            <span className="text-sm font-semibold">สแกน QR ผู้มาเยือน</span>
          </div>
          <button onClick={onClose} aria-label="ปิดกล้อง" className="p-3 -mr-1 text-aviva-secondary hover:text-aviva-gold">
            <X size={20} />
          </button>
        </div>
        <div className="aspect-square bg-black relative">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/80 space-y-2">
              <p className="text-sm text-red-300 font-semibold">เปิดกล้องไม่ได้</p>
              <p className="text-xs text-red-200/80">{error}</p>
              <p className="text-xs text-aviva-secondary mt-2">กรุณาอนุญาตการใช้กล้องในการตั้งค่าอุปกรณ์ แล้วเปิดหน้านี้ใหม่อีกครั้ง</p>
            </div>
          )}
        </div>
        <p className="text-xs text-aviva-secondary text-center px-4 py-3">
          จัดให้ QR ของลูกบ้านอยู่ในกรอบ ระบบจะอ่านอัตโนมัติ
        </p>
      </div>
    </div>
  );
}
