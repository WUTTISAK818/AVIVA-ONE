"use client";
// กำไร–ต้นทุนรายหลัง + ภาพรวมทั้งโครงการ (สำหรับผู้บริหาร)
// รายได้: recognized (โอนแล้ว) หรือราคาขายตั้งต้น (ศักยภาพ) · ต้นทุน: ผลรวมงวดผู้รับเหมาของหลังนั้น
import { useCallback, useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Home, Wallet, BarChart3 } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const fmtM = (n: number) => n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(2)}M` : baht(n);

interface HouseRow {
  id: string;
  house_number: string;
  plot_number: number | null;
  status: string;
  model: string | null;
  revenue: number;       // รายได้ (รับรู้แล้ว หรือราคาขายตั้งต้น)
  recognized: boolean;   // รับรู้รายได้แล้ว (โอนกรรมสิทธิ์)
  buildCost: number;     // ต้นทุนก่อสร้าง (รวมทุกงวดผู้รับเหมา)
  landCost: number;      // ต้นทุนที่ดินของแปลงนั้น
  cost: number;          // ต้นทุนรวม = ก่อสร้าง + ที่ดิน
  paidCost: number;      // ต้นทุนที่จ่ายจริงแล้ว
  profit: number;
  margin: number;        // %
}

export default function ProfitabilityPanel() {
  const [rows, setRows] = useState<HouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const [housesRes, instRes, revRes] = await Promise.all([
      supabase.from("houses").select("id,house_number,plot_number,status,price,house_model,land_cost,infra_cost").eq("project_id", PROJECT_ID),
      supabase.from("contractor_installments").select("house_id,amount,status"),
      supabase.from("revenue_recognition").select("house_id,recognized_amount,status").eq("project_id", PROJECT_ID),
    ]);
    const houses = (housesRes.data as { id: string; house_number: string; plot_number: number | null; status: string; price: number | null; house_model: string | null; land_cost: number | null; infra_cost: number | null }[]) ?? [];
    const insts = (instRes.data as { house_id: string; amount: number | null; status: string }[]) ?? [];
    const revs = (revRes.data as { house_id: string | null; recognized_amount: number | null; status: string }[]) ?? [];

    const costByHouse = new Map<string, { total: number; paid: number }>();
    for (const i of insts) {
      const c = costByHouse.get(i.house_id) ?? { total: 0, paid: 0 };
      c.total += Number(i.amount ?? 0);
      if (i.status === "paid") c.paid += Number(i.amount ?? 0);
      costByHouse.set(i.house_id, c);
    }
    const recByHouse = new Map<string, number>();
    for (const r of revs) {
      if (!r.house_id || r.status !== "recognized") continue;
      recByHouse.set(r.house_id, (recByHouse.get(r.house_id) ?? 0) + Number(r.recognized_amount ?? 0));
    }

    const out: HouseRow[] = houses.map((h) => {
      const rec = recByHouse.get(h.id) ?? 0;
      const recognized = rec > 0;
      const revenue = recognized ? rec : Number(h.price ?? 0);
      const buildCost = costByHouse.get(h.id)?.total ?? 0;
      const landCost = Number(h.land_cost ?? 0) + Number(h.infra_cost ?? 0); // ที่ดิน + ปันส่วนสาธารณูปโภค
      const cost = buildCost + landCost;                 // ต้นทุนเต็ม = ก่อสร้าง + ที่ดิน + โครงสร้างพื้นฐาน
      const paidCost = (costByHouse.get(h.id)?.paid ?? 0) + landCost; // ที่ดิน/โครงสร้างถือว่าลงทุนแล้ว
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { id: h.id, house_number: h.house_number, plot_number: h.plot_number, status: h.status, model: h.house_model, revenue, recognized, buildCost, landCost, cost, paidCost, profit, margin };
    }).sort((a, b) => (a.plot_number ?? 0) - (b.plot_number ?? 0));

    setRows(out);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ภาพรวม
  const sold = rows.filter((r) => r.recognized);
  const recRevenue = sold.reduce((s, r) => s + r.revenue, 0);
  const recCost = sold.reduce((s, r) => s + r.cost, 0);
  const recProfit = recRevenue - recCost;
  const recMargin = recRevenue > 0 ? (recProfit / recRevenue) * 100 : 0;
  const potentialRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalPaidCost = rows.reduce((s, r) => s + r.paidCost, 0);
  const totalLandCost = rows.reduce((s, r) => s + r.landCost, 0);

  const shown = expanded ? rows : rows.slice(0, 8);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-aviva-gold" />
        <span className="text-sm font-semibold text-aviva-text">กำไร–ต้นทุน รายหลัง & ภาพรวมโครงการ</span>
      </div>

      {loading ? (
        <p className="text-[11px] text-aviva-secondary/70 text-center py-3">กำลังคำนวณ…</p>
      ) : (
        <>
          {/* ภาพรวม */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-aviva-bg/50 rounded-xl p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-aviva-secondary"><TrendingUp size={11} className="text-green-400" /> กำไรขั้นต้นที่รับรู้แล้ว</div>
              <p className={`text-base font-bold ${recProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtM(recProfit)}</p>
              <p className="text-[10px] text-aviva-secondary/70">margin {recMargin.toFixed(1)}% · {sold.length} หลัง</p>
            </div>
            <div className="bg-aviva-bg/50 rounded-xl p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-aviva-secondary"><Home size={11} className="text-aviva-gold" /> รายได้ที่รับรู้</div>
              <p className="text-base font-bold text-aviva-gold">{fmtM(recRevenue)}</p>
              <p className="text-[10px] text-aviva-secondary/70">ต้นทุนขาย {fmtM(recCost)}</p>
            </div>
            <div className="bg-aviva-bg/50 rounded-xl p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-aviva-secondary"><Wallet size={11} className="text-blue-400" /> ต้นทุนลงไปแล้ว</div>
              <p className="text-base font-bold text-blue-400">{fmtM(totalPaidCost)}</p>
              <p className="text-[10px] text-aviva-secondary/70">ก่อสร้าง + ที่ดิน {fmtM(totalLandCost)}</p>
            </div>
            <div className="bg-aviva-bg/50 rounded-xl p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-aviva-secondary"><BarChart3 size={11} className="text-purple-400" /> มูลค่าขายทั้งโครงการ</div>
              <p className="text-base font-bold text-purple-400">{fmtM(potentialRevenue)}</p>
              <p className="text-[10px] text-aviva-secondary/70">{rows.length} หลัง (รวมศักยภาพ)</p>
            </div>
          </div>

          {/* ตารางรายหลัง */}
          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-1 text-[9px] text-aviva-secondary/60 px-1 pb-1 border-b border-aviva-gold/10">
              <div className="col-span-3">ยูนิต</div>
              <div className="col-span-3 text-right">ราคาขาย</div>
              <div className="col-span-3 text-right">ต้นทุน</div>
              <div className="col-span-3 text-right">กำไร / margin</div>
            </div>
            {rows.length === 0 ? (
              <p className="text-[11px] text-aviva-secondary/70 text-center py-2">ยังไม่มีข้อมูลบ้าน</p>
            ) : shown.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-1 text-[10px] items-center px-1 py-0.5">
                <div className="col-span-3 min-w-0">
                  <span className="text-aviva-text truncate block">{r.house_number}</span>
                  <span className={`text-[8px] ${r.recognized ? "text-green-400" : "text-aviva-secondary/50"}`}>{r.recognized ? "โอนแล้ว" : "ศักยภาพ"}</span>
                </div>
                <div className="col-span-3 text-right text-aviva-secondary">{fmtM(r.revenue)}</div>
                <div className="col-span-3 text-right text-aviva-secondary">{fmtM(r.cost)}</div>
                <div className="col-span-3 text-right">
                  <span className={r.profit >= 0 ? "text-green-400" : "text-red-400"}>{fmtM(r.profit)}</span>
                  <span className="text-[8px] text-aviva-secondary/60 block">{r.revenue > 0 ? `${r.margin.toFixed(0)}%` : "-"}</span>
                </div>
              </div>
            ))}
          </div>
          {rows.length > 8 && (
            <button onClick={() => setExpanded((v) => !v)} className="w-full mt-2 text-[11px] text-aviva-gold font-medium">
              {expanded ? "ย่อ" : `ดูทั้งหมด ${rows.length} หลัง`}
            </button>
          )}
          <p className="text-[9px] text-aviva-secondary/50 mt-2 flex items-center gap-1">
            <TrendingDown size={9} /> ต้นทุน = งวดผู้รับเหมา + ต้นทุนที่ดิน + ปันส่วนสาธารณูปโภค (ตั้งค่าที่ บัญชี → ต้นทุนแปลง) · ยังไม่รวมค่าใช้จ่ายขาย
          </p>
        </>
      )}
    </GlassCard>
  );
}
