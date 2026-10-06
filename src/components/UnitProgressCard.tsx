"use client";
// อัปเดตความคืบหน้าแปลงจากรายงานหน้างานประจำวัน — ตัวเชื่อมระหว่าง "รายงานของวิศวกร" กับ "ผังฝ่ายก่อสร้าง"
//
// Pom แจ้ง 6 ต.ค. 69: รายงานก่อสร้างประจำวันไม่มีความสัมพันธ์กับผังในหน้าฝ่ายก่อสร้าง
// ตรวจแล้ว: ผังอ่านจากตาราง houses ซึ่งไม่มีใครแก้มาตั้งแต่ 18-19 มิ.ย. 69 — V28/V29 จึงยังขึ้น "ยังไม่เริ่ม 0%"
// ทั้งที่รายงานหน้างานบอกว่าทาสีจริงภายในรอบสองและติดตั้งรั้วไปแล้ว
//
// ระบบ "ไม่เดา %" ให้ เพราะเปอร์เซ็นต์ในรายงานเป็นของเนื้องานย่อย (ทาสีวงกบ 50%) ไม่ใช่ทั้งหลัง
// ระบบทำให้แค่: จับว่าวันนี้ทำแปลงไหนบ้าง + เอาค่าปัจจุบันมาตั้งต้น ให้วิศวกรปรับตัวเลขเอง
import { useEffect, useMemo, useState } from "react";
import { HardHat, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { plotCodesInAll } from "@/lib/plot-codes";
import GlassCard from "@/components/GlassCard";

interface HouseRow {
  plot_code: string;
  progress: number | null;
  construction_status: string | null;
  updated_at: string | null;
}

const STATUS_TH: Record<string, string> = {
  completed: "เสร็จแล้ว",
  in_progress: "กำลังก่อสร้าง",
  delayed: "ล่าช้า",
  not_started: "ยังไม่เริ่ม",
};

export default function UnitProgressCard({
  texts, disabled,
}: { texts: (string | null | undefined)[]; disabled?: boolean }) {
  const codes = useMemo(() => plotCodesInAll(texts), [texts]);
  const [houses, setHouses] = useState<HouseRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (codes.length === 0) { setHouses([]); return; }
    supabase.from("houses")
      .select("plot_code, progress, construction_status, updated_at")
      .in("plot_code", codes)
      .then(({ data }) => {
        const rows = (data ?? []) as HouseRow[];
        setHouses(rows);
        setDraft(Object.fromEntries(rows.map(h => [h.plot_code, Number(h.progress ?? 0)])));
      });
  }, [codes.join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (codes.length === 0) return null;
  if (!houses) {
    return (
      <GlassCard className="p-3 flex items-center gap-2 text-xs text-aviva-secondary">
        <Loader2 size={14} className="animate-spin" /> กำลังดึงข้อมูลแปลง...
      </GlassCard>
    );
  }
  if (houses.length === 0) return null;

  const dirty = houses.filter(h => (draft[h.plot_code] ?? 0) !== Number(h.progress ?? 0));

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/construction/progress", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          updates: dirty.map(h => ({ plotCode: h.plot_code, progress: draft[h.plot_code] })),
          note: texts.filter(Boolean).join(" · ").slice(0, 300),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setResult(json?.error ?? "บันทึกไม่สำเร็จ"); }
      else {
        setResult(`✅ อัปเดตผังก่อสร้างแล้ว ${json.changed?.length ?? 0} แปลง`);
        setHouses(prev => (prev ?? []).map(h =>
          draft[h.plot_code] !== undefined ? { ...h, progress: draft[h.plot_code] } : h));
      }
    } catch {
      setResult("เชื่อมต่อไม่สำเร็จ");
    }
    setSaving(false);
  }

  return (
    <GlassCard className="p-3.5 border-aviva-gold/30">
      <div className="flex items-center gap-2">
        <HardHat size={15} className="text-aviva-gold" />
        <h3 className="text-sm font-bold text-aviva-gold">อัปเดตความคืบหน้าแปลง</h3>
      </div>
      <p className="text-[11px] text-aviva-secondary mt-1 leading-relaxed">
        ระบบอ่านจากรายงานของคุณว่าวันนี้ทำแปลง <b className="text-aviva-text">{codes.join(", ")}</b> —
        ปรับเปอร์เซ็นต์ให้ตรงกับหน้างานแล้วกดบันทึก <b className="text-aviva-text">ผังฝ่ายก่อสร้างจะอัปเดตทันที</b>
      </p>

      <div className="space-y-2.5 mt-3">
        {houses.map(h => {
          const val = draft[h.plot_code] ?? 0;
          const before = Number(h.progress ?? 0);
          return (
            <div key={h.plot_code} className="bg-aviva-bg/60 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-aviva-text">{h.plot_code}</span>
                <span className="text-[11px] text-aviva-secondary">
                  ผังตอนนี้: {before}% · {STATUS_TH[h.construction_status ?? ""] ?? h.construction_status}
                </span>
              </div>
              <div className="flex items-center gap-2.5 mt-2">
                <input type="range" min={0} max={100} step={5} value={val} disabled={disabled}
                  onChange={e => setDraft(p => ({ ...p, [h.plot_code]: Number(e.target.value) }))}
                  className="flex-1 accent-aviva-gold" />
                <input type="number" min={0} max={100} value={val} disabled={disabled}
                  onChange={e => setDraft(p => ({ ...p, [h.plot_code]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                  className="w-16 bg-aviva-bg border border-aviva-gold/25 rounded-lg px-2 py-1 text-sm text-aviva-text text-center" />
                <span className="text-xs text-aviva-secondary">%</span>
              </div>
              {val !== before && (
                <p className="text-[11px] text-aviva-gold mt-1.5">
                  {before}% → {val}%{val >= 100 ? " · จะขึ้นเป็น \"เสร็จแล้ว\"" : val > 0 && before === 0 ? " · จะขึ้นเป็น \"กำลังก่อสร้าง\"" : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {result && (
        <p className={`text-xs mt-2.5 text-center ${result.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{result}</p>
      )}

      <button onClick={save} disabled={saving || disabled || dirty.length === 0}
        className="w-full mt-3 bg-aviva-gold text-aviva-bg font-bold text-sm py-2.5 rounded-xl disabled:opacity-40 active:scale-[0.98] transition-transform">
        {saving ? "กำลังบันทึก..." : dirty.length === 0 ? "ยังไม่มีการเปลี่ยนแปลง" : `บันทึกลงผังก่อสร้าง ${dirty.length} แปลง`}
      </button>
      <p className="text-[10px] text-aviva-secondary/60 mt-1.5 text-center">
        บันทึกแล้วแปลงที่เสร็จ 100% จะแจ้งผู้บริหารให้ทราบอัตโนมัติ
      </p>
    </GlassCard>
  );
}
