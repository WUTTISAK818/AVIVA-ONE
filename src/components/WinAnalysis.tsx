"use client";

import { useState, useMemo, useEffect } from "react";
import { TrendingUp, RotateCcw } from "lucide-react";
import clsx from "clsx";

// ===== ข้อมูลจริงเลือกตั้งครั้งก่อน (2568) รวมรายเขต — our=เบอร์2 (v2), คู่แข่ง=max(v1,v3,v4) =====
const HIST = [
  { code: 1, name: "เขต 1", eligible: 21123, voted: 10586, v1: 2362, v2: 4748, v3: 941, v4: 1619 },
  { code: 2, name: "เขต 2", eligible: 23017, voted: 11940, v1: 2215, v2: 5307, v3: 964, v4: 2479 },
  { code: 3, name: "เขต 3", eligible: 23291, voted: 11963, v1: 2893, v2: 4988, v3: 1077, v4: 1899 },
  { code: 4, name: "เขต 4", eligible: 24570, voted: 12879, v1: 2766, v2: 6000, v3: 1063, v4: 1920 },
];

// ความไม่แน่นอน (ส่วนเบี่ยงเบนมาตรฐาน) สำหรับ Monte Carlo
const PSD = 0.08;  // ความไม่แน่นอนของ P(เลือกเรา) แต่ละชั้น
const TSD = 0.05;  // ความไม่แน่นอนของ turnout ฝั่งเรา
const RSD = 0.12;  // ความไม่แน่นอนของคู่แข่ง
const NSIM = 2000;

const fmt = (n: number) => Math.round(n).toLocaleString("th-TH");
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// Box-Muller — สุ่มค่าแบบการแจกแจงปกติ
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

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
  const [pctA, setPctA] = useState(40);
  const [pctB, setPctB] = useState(35);
  const pctC = Math.max(0, 100 - pctA - pctB);
  const [probA, setProbA] = useState(90);
  const [probB, setProbB] = useState(55);
  const [probC, setProbC] = useState(35);
  const [ourTurnout, setOurTurnout] = useState(90);
  const [rivalAdj, setRivalAdj] = useState(100);
  const [safety, setSafety] = useState(10);
  const [base, setBase] = useState<number[]>(HIST.map((h) => h.v2));

  // debounce อินพุตที่ใช้คำนวณ Monte Carlo — slider ลื่น แต่ไม่รัน 8,000 sims ทุก pixel
  const [calc, setCalc] = useState({ pctA, pctB, pctC, probA, probB, probC, ourTurnout, rivalAdj, safety, base });
  useEffect(() => {
    const t = setTimeout(() => setCalc({ pctA, pctB, pctC, probA, probB, probC, ourTurnout, rivalAdj, safety, base }), 120);
    return () => clearTimeout(t);
  }, [pctA, pctB, pctC, probA, probB, probC, ourTurnout, rivalAdj, safety, base]);

  const rows = useMemo(() => {
    const { pctA, pctB, pctC, probA, probB, probC, ourTurnout, rivalAdj, safety, base } = calc;
    return HIST.map((h, i) => {
    const sA = pctA / 100, sB = pctB / 100, sC = pctC / 100;
    const pA = probA / 100, pB = probB / 100, pC = probC / 100;
    const ot = ourTurnout / 100;
    const weight = sA * pA + sB * pB + sC * pC;             // น้ำหนักเฉลี่ย (คะแนนคาดหวัง/หัว)
    const rivalStrength = Math.max(h.v1, h.v3, h.v4) * (rivalAdj / 100); // คู่แข่งแกร่งสุดที่แท้จริง

    // ===== Monte Carlo: สุ่ม NSIM ครั้ง เพื่อหา "ความน่าจะเป็นชนะ" จริง =====
    const samples: number[] = [];
    let wins = 0;
    for (let s = 0; s < NSIM; s++) {
      const w = sA * clamp01(pA + randn() * PSD) + sB * clamp01(pB + randn() * PSD) + sC * clamp01(pC + randn() * PSD);
      const otS = clamp01(ot + randn() * TSD);
      const ourVotes = base[i] * w * otS;
      const rivalS = rivalStrength * Math.max(0.4, 1 + randn() * RSD);
      samples.push(ourVotes);
      if (ourVotes > rivalS) wins++;
    }
    samples.sort((a, b) => a - b);
    const winProb = (wins / NSIM) * 100;
    const ourMid = base[i] * weight * ot;
    const p5 = samples[Math.floor(NSIM * 0.05)];
    const p95 = samples[Math.floor(NSIM * 0.95)];

    // ฐานเสียงที่ต้องมีเพื่อให้คาดหวังชนะ + เผื่อ margin
    const need = (rivalStrength * (1 + safety / 100)) / Math.max(0.0001, weight * ot);
    const gap = need - base[i];

    return { ...h, ourMid, p5, p95, rival: rivalStrength, winProb, gap };
    });
  }, [calc]);

  const won = rows.filter((r) => r.winProb >= 50).length;

  const reset = () => {
    setPctA(40); setPctB(35); setProbA(90); setProbB(55); setProbC(35);
    setOurTurnout(90); setRivalAdj(100); setSafety(10); setBase(HIST.map((h) => h.v2));
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
        Monte Carlo {NSIM.toLocaleString()} รอบ · ฐาน = ผลจริง 185 หน่วย · คู่แข่ง = max(เบอร์ 1/3/4) · ตัวเลขจำลองเพื่อทดสอบ
      </p>

      <div className="bg-aviva-card rounded-2xl p-4 border border-aviva-gold/15">
        <div className="text-xs text-aviva-secondary">คาดว่าชนะ</div>
        <div className="text-3xl font-bold text-aviva-gold-soft">{won}<span className="text-lg text-aviva-secondary"> / {HIST.length} เขต</span></div>
      </div>

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
                <div className="flex justify-between"><span className="text-aviva-secondary">ช่วง 90% (p5–p95)</span><span className="text-aviva-secondary">{fmt(r.p5)}–{fmt(r.p95)}</span></div>
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
        <div className="text-[10px] text-aviva-secondary">ชั้น C = {pctC}% (= 100 − A − B) · ชนะ = คะแนนสูงสุด (plurality) · โอกาสชนะจากการจำลองสุ่ม {NSIM.toLocaleString()} รอบ</div>
      </div>
    </div>
  );
}
