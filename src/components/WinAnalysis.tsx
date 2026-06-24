"use client";

import { useState, useMemo } from "react";
import { TrendingUp, RotateCcw } from "lucide-react";
import clsx from "clsx";

// ===== ข้อมูลจริงเลือกตั้งครั้งก่อน (2568) รวมรายเขต — our=เบอร์2, rival=เบอร์1 =====
const HIST = [
  { code: 1, name: "เขต 1", eligible: 21123, voted: 10586, our: 4748, rival: 2362 },
  { code: 2, name: "เขต 2", eligible: 23017, voted: 11940, our: 5307, rival: 2215 },
  { code: 3, name: "เขต 3", eligible: 23291, voted: 11963, our: 4988, rival: 2893 },
  { code: 4, name: "เขต 4", eligible: 24570, voted: 12879, our: 6000, rival: 2766 },
];

const fmt = (n: number) => Math.round(n).toLocaleString("th-TH");

function Slider({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-aviva-secondary">{label}</span>
        <span className="font-bold text-aviva-gold-soft">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-aviva-gold" />
    </div>
  );
}

export default function WinAnalysis() {
  // สมมติฐานปรับได้ (global)
  const [pctA, setPctA] = useState(40);   // สัดส่วนฐานเสียงชั้น A (%)
  const [pctB, setPctB] = useState(35);   // ชั้น B
  // ชั้น C = 100 - A - B
  const pctC = Math.max(0, 100 - pctA - pctB);
  const [probA, setProbA] = useState(90); // P(เลือกเรา) ชั้น A
  const [probB, setProbB] = useState(55);
  const [probC, setProbC] = useState(35);
  const [ourTurnout, setOurTurnout] = useState(90); // turnout ฝั่งเรา
  const [rivalAdj, setRivalAdj] = useState(100);     // คู่แข่งเทียบครั้งก่อน
  const [safety, setSafety] = useState(10);          // เผื่อ margin %

  // ฐานเสียงยืนยันแล้วต่อเขต (เริ่มต้น = ผลครั้งก่อน เพื่อให้เห็นภาพ)
  const [base, setBase] = useState<number[]>(HIST.map((h) => h.our));

  const tierWeight = (dProb = 0) => {
    const a = (probA + dProb) / 100, b = (probB + dProb) / 100, c = (probC + dProb) / 100;
    return (pctA / 100) * Math.min(1, a) + (pctB / 100) * Math.min(1, b) + (pctC / 100) * Math.min(1, c);
  };

  const rows = useMemo(() => HIST.map((h, i) => {
    const w = tierWeight(0), wOpt = tierWeight(10), wPess = tierWeight(-10);
    const ot = ourTurnout / 100;
    const ourMid = base[i] * w * ot;
    const ourOpt = base[i] * wOpt * ot;
    const ourPess = base[i] * wPess * ot;
    const rival = h.rival * (rivalAdj / 100);
    const target = rival * (1 + safety / 100);

    let winProb: number;
    if (ourPess > rival) winProb = 90 + Math.min(8, (ourPess - rival) / rival * 20);
    else if (ourOpt < rival) winProb = Math.max(2, 10 - (rival - ourOpt) / rival * 20);
    else winProb = 10 + ((ourMid - ourPess) / Math.max(1, ourOpt - ourPess)) * 80;
    winProb = Math.max(1, Math.min(99, winProb));

    const needBase = (target / (w * ot));
    const gap = needBase - base[i];

    return { ...h, ourMid, ourOpt, ourPess, rival, target, winProb, gap };
  }), [base, pctA, pctB, probA, probB, probC, ourTurnout, rivalAdj, safety]); // eslint-disable-line

  const won = rows.filter((r) => r.winProb >= 50).length;

  const reset = () => {
    setPctA(40); setPctB(35); setProbA(90); setProbB(55); setProbC(35);
    setOurTurnout(90); setRivalAdj(100); setSafety(10); setBase(HIST.map((h) => h.our));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-aviva-gold" />
          <h2 className="font-bold text-aviva-text">วิเคราะห์โอกาสชนะ (จำลอง)</h2>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-[11px] text-aviva-secondary">
          <RotateCcw size={12} /> รีเซ็ต
        </button>
      </div>
      <p className="text-[11px] text-aviva-secondary -mt-2">
        ใช้ผลจริงครั้งก่อน 185 หน่วยเป็นฐาน · ปรับค่าแล้วผลเปลี่ยนสด · ตัวเลขจำลองเพื่อทดสอบ
      </p>

      {/* สรุปรวม */}
      <div className="bg-aviva-card rounded-2xl p-4 border border-aviva-gold/15">
        <div className="text-xs text-aviva-secondary">คาดว่าชนะ</div>
        <div className="text-3xl font-bold text-aviva-gold-soft">{won}<span className="text-lg text-aviva-secondary"> / {HIST.length} เขต</span></div>
      </div>

      {/* ผลรายเขต */}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const status = r.winProb >= 65 ? "win" : r.winProb >= 45 ? "tossup" : "lose";
          const color = status === "win" ? "text-green-400" : status === "tossup" ? "text-yellow-400" : "text-red-400";
          const label = status === "win" ? "✅ น่าจะชนะ" : status === "tossup" ? "⚠️ ก้ำกึ่ง" : "🔴 เสี่ยงแพ้";
          return (
            <div key={r.code} className="bg-aviva-card rounded-2xl p-3 border border-aviva-gold/10">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-aviva-text">{r.name}</span>
                <span className={clsx("text-xs font-bold", color)}>{label} · {Math.round(r.winProb)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-aviva-secondary">คะแนนเราคาดหวัง</span><span className="font-semibold text-aviva-text">{fmt(r.ourMid)}</span></div>
                <div className="flex justify-between"><span className="text-aviva-secondary">คู่แข่งแกร่งสุด</span><span className="font-semibold text-aviva-text">{fmt(r.rival)}</span></div>
                <div className="flex justify-between"><span className="text-aviva-secondary">ช่วง</span><span className="text-aviva-secondary">{fmt(r.ourPess)}–{fmt(r.ourOpt)}</span></div>
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">ฐานเสียง</span>
                  {r.gap > 0
                    ? <span className="text-red-400 font-semibold">ขาด {fmt(r.gap)}</span>
                    : <span className="text-green-400 font-semibold">พอ (+{fmt(-r.gap)})</span>}
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-aviva-secondary mb-1">
                  <span>ฐานเสียงยืนยันแล้ว (ปรับได้)</span><span className="font-bold text-aviva-gold-soft">{fmt(base[i])}</span>
                </div>
                <input type="range" min={0} max={r.eligible} step={50} value={base[i]}
                  onChange={(e) => { const nb = [...base]; nb[i] = Number(e.target.value); setBase(nb); }}
                  className="w-full accent-aviva-gold" />
              </div>
            </div>
          );
        })}
      </div>

      {/* สมมติฐาน */}
      <div className="bg-aviva-card rounded-2xl p-4 border border-aviva-gold/15 space-y-3">
        <div className="text-xs font-bold text-aviva-text mb-1">⚙️ สมมติฐาน (ปรับได้)</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Slider label="ชั้น A %" value={pctA} min={0} max={100} step={5} suffix="%" onChange={setPctA} />
          <Slider label="ชั้น B %" value={pctB} min={0} max={100 - pctA} step={5} suffix="%" onChange={setPctB} />
          <Slider label="P เลือกเรา · A" value={probA} min={0} max={100} step={5} suffix="%" onChange={setProbA} />
          <Slider label="P เลือกเรา · B" value={probB} min={0} max={100} step={5} suffix="%" onChange={setProbB} />
          <Slider label="P เลือกเรา · C" value={probC} min={0} max={100} step={5} suffix="%" onChange={setProbC} />
          <Slider label="turnout ฝั่งเรา" value={ourTurnout} min={50} max={100} step={5} suffix="%" onChange={setOurTurnout} />
          <Slider label="คู่แข่งเทียบครั้งก่อน" value={rivalAdj} min={50} max={150} step={5} suffix="%" onChange={setRivalAdj} />
          <Slider label="เผื่อ margin" value={safety} min={0} max={30} step={5} suffix="%" onChange={setSafety} />
        </div>
        <div className="text-[10px] text-aviva-secondary">ชั้น C = {pctC}% (= 100 − A − B) · ชนะ = คะแนนสูงสุด (plurality)</div>
      </div>
    </div>
  );
}
