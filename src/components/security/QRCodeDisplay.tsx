"use client";

import { QRCodeSVG } from "qrcode.react";

export default function QRCodeDisplay({
  value,
  size = 200,
  caption,
}: {
  value: string;
  size?: number;
  caption?: string;
}) {
  return (
    <div className="inline-flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border-2 border-aviva-gold/40">
      <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
      {caption && <p className="text-xs text-aviva-bg font-medium">{caption}</p>}
    </div>
  );
}
