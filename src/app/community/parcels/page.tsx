"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Package, CheckCircle, Clock } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Parcel {
  id: string;
  tracking_no: string | null;
  courier: string | null;
  received_at: string;
  picked_up_at: string | null;
  photo_url: string | null;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ParcelsPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("parcels").select("*").order("received_at", { ascending: false }).limit(50)
      .then(({ data }) => { setParcels((data as Parcel[]) ?? []); setLoading(false); });
  }, []);

  const pending = parcels.filter(p => !p.picked_up_at);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-aviva-text">พัสดุของฉัน</h1>
          <p className="text-xs text-aviva-secondary mt-0.5">
            {loading ? "กำลังโหลด…" : `${pending.length} ชิ้น รอรับที่นิติฯ`}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="ทั้งหมด" subtitle="พัสดุที่ฝากไว้ที่ป้อม / นิติฯ" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : parcels.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Package size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีพัสดุในระบบ</p>
          </GlassCard>
        ) : (
          parcels.map(p => {
            const picked = !!p.picked_up_at;
            return (
              <GlassCard key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  {p.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.photo_url} alt="parcel" className="w-16 h-16 rounded-xl object-cover border border-aviva-gold/20" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-aviva-bg flex items-center justify-center border border-aviva-gold/10">
                      <Package size={20} className="text-aviva-secondary/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-aviva-text">
                      {p.courier ?? "พัสดุ"}
                      {p.tracking_no && <span className="text-xs text-aviva-secondary font-mono ml-2">{p.tracking_no}</span>}
                    </p>
                    <p className="text-xs text-aviva-secondary mt-0.5">รับเข้านิติฯ {fmtDateTime(p.received_at)}</p>
                    {picked && (
                      <p className="text-xs text-green-300 mt-0.5">รับแล้ว {fmtDateTime(p.picked_up_at)}</p>
                    )}
                  </div>
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0",
                    picked
                      ? "bg-green-500/15 text-green-300 border-green-500/30"
                      : "bg-aviva-gold/15 text-aviva-gold border-aviva-gold/30"
                  )}>
                    {picked ? <CheckCircle size={12} /> : <Clock size={12} />}
                    {picked ? "รับแล้ว" : "รอรับ"}
                  </span>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
