import { getContractorTrack } from "@/lib/track-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TrackPage({ params }: { params: Promise<{ refCode: string }> }) {
  const { refCode } = await params;
  const data = await getContractorTrack(decodeURIComponent(refCode));

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-aviva-bg text-aviva-text">
        <div className="text-center">
          <h1 className="text-lg font-bold text-aviva-gold">ไม่พบข้อมูล</h1>
          <p className="text-sm text-aviva-secondary mt-2">รหัสติดตาม ({refCode}) ไม่ถูกต้องหรือถูกยกเลิกแล้ว</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10 bg-aviva-bg text-aviva-text">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-aviva-gold tracking-wide">AVIVA ONE</h1>
        <p className="text-sm text-aviva-secondary">ติดตามสถานะงาน — {data.name}</p>
        <p className="text-xs text-aviva-secondary/60 mt-1">รหัส: {data.ref_code}</p>

        <div className="mt-6 space-y-3">
          {data.houses.length === 0 && (
            <div className="text-sm text-aviva-secondary">ยังไม่มีงานที่มอบหมาย</div>
          )}
          {data.houses.map((h, i) => (
            <div key={i} className="rounded-2xl border border-aviva-gold/10 bg-aviva-card/80 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">แปลง {h.plot_number ?? "-"}</div>
                <div className="text-xs text-aviva-secondary">{h.status ?? "-"}</div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-aviva-gold/10 overflow-hidden">
                <div className="h-full bg-aviva-gold" style={{ width: `${Math.min(100, Math.max(0, h.progress ?? 0))}%` }} />
              </div>
              <div className="mt-1 text-right text-xs text-aviva-secondary">{h.progress ?? 0}%</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
