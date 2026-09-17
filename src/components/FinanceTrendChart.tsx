"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// กราฟรายรับ-รายจ่าย-กำไร หน้าหลัก — แยกไฟล์เพื่อให้โหลด recharts แบบ lazy
// (recharts เป็นไลบรารีก้อนใหญ่ ไม่ควรติดมากับ JS ชุดแรกที่พนักงานโหลดบนมือถือ)
export interface FinanceTrendPoint {
  month: string;
  revenue: number;
  expense: number;
  profit: number;
}

export default function FinanceTrendChart({ data }: { data: FinanceTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#4ADE80" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F87171" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fill: "#D1D5DB", fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#D1D5DB", fontSize: 9 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: "#17332D", border: "1px solid #D4AF37", borderRadius: "8px", color: "#fff", fontSize: "11px" }}
          formatter={(val, name) => [`฿${val}M`, name === "revenue" ? "รายรับ" : name === "expense" ? "รายจ่าย" : "กำไรสุทธิ"]}
        />
        <Area type="monotone" dataKey="revenue" stroke="#4ADE80" strokeWidth={2} fill="url(#greenGrad)" dot={false} />
        <Area type="monotone" dataKey="expense" stroke="#F87171" strokeWidth={1.5} fill="url(#redGrad)" dot={false} />
        <Area type="monotone" dataKey="profit" stroke="#D4AF37" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
