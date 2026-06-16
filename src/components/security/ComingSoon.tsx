"use client";

import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import GlassCard from "@/components/GlassCard";

export default function ComingSoon({
  title,
  description,
  phase,
  backHref = "/security",
}: {
  title: string;
  description?: string;
  phase: string;
  backHref?: string;
}) {
  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href={backHref} className="text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">{title}</h1>
            {description && <p className="text-xs text-aviva-secondary mt-0.5">{description}</p>}
          </div>
        </div>
      </div>
      <div className="px-4 py-10 max-w-lg mx-auto">
        <GlassCard className="p-8 text-center">
          <Construction size={36} className="text-aviva-gold/60 mx-auto mb-3" />
          <p className="text-sm font-semibold text-aviva-text mb-1">กำลังพัฒนา</p>
          <p className="text-xs text-aviva-secondary">หน้านี้เป็นส่วนหนึ่งของ {phase}</p>
        </GlassCard>
      </div>
    </div>
  );
}
