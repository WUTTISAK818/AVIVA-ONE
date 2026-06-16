"use client";
// งบการเงินอัตโนมัติ — งบทดลอง / งบกำไรขาดทุน / งบดุล จากสมุดรายวัน (jv_lines) จริง
// สำหรับผู้บริหาร + เตรียมยื่นสรรพากร/ปิดงบ
import { useCallback, useEffect, useState } from "react";
import { FileBarChart, ChevronDown, ChevronRight } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
type AcctType = "asset" | "liability" | "equity" | "revenue" | "expense";

// fallback จัดประเภทตามหลักแรกของรหัสบัญชี (กรณีไม่มีในผังบัญชี เช่น 1100 เก่า)
function typeByCode(code: string): AcctType {
  const d = code[0];
  if (d === "1") return "asset";
  if (d === "2") return "liability";
  if (d === "3") return "equity";
  if (d === "4") return "revenue";
  return "expense";
}

interface AcctAgg { code: string; name: string; type: AcctType; debit: number; credit: number; }

export default function FinancialStatementsPanel() {
  const [period, setPeriod] = useState<"month" | "year" | "all">("year");
  const [accts, setAccts] = useState<AcctAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTB, setOpenTB] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [coaRes, entRes, lineRes] = await Promise.all([
      supabase.from("chart_of_accounts").select("code,name_th,account_type"),
      supabase.from("jv_entries").select("id,jv_date").eq("project_id", PROJECT_ID),
      supabase.from("jv_lines").select("jv_id,account_code,account_name,debit,credit"),
    ]);
    const coa = new Map<string, { name: string; type: AcctType }>();
    for (const c of (coaRes.data as { code: string; name_th: string; account_type: AcctType }[]) ?? [])
      coa.set(c.code, { name: c.name_th, type: c.account_type });
    const dateById = new Map<string, string>();
    for (const e of (entRes.data as { id: string; jv_date: string }[]) ?? []) dateById.set(e.id, e.jv_date);

    const now = new Date(Date.now() + 7 * 3600 * 1000);
    const ym = now.toISOString().slice(0, 7);
    const yr = now.toISOString().slice(0, 4);

    const agg = new Map<string, AcctAgg>();
    for (const l of (lineRes.data as { jv_id: string; account_code: string; account_name: string; debit: number | null; credit: number | null }[]) ?? []) {
      const d = dateById.get(l.jv_id) ?? "";
      // กรองตามงวด: งบกำไรขาดทุนใช้งวด, งบดุลเป็นยอดสะสม — ที่นี่กรองรวม (balance sheet ใช้ all เสมอผ่าน period=all)
      if (period === "month" && !d.startsWith(ym)) continue;
      if (period === "year" && !d.startsWith(yr)) continue;
      const meta = coa.get(l.account_code);
      const type = meta?.type ?? typeByCode(l.account_code);
      const name = meta?.name ?? l.account_name;
      const a = agg.get(l.account_code) ?? { code: l.account_code, name, type, debit: 0, credit: 0 };
      a.debit += Number(l.debit ?? 0);
      a.credit += Number(l.credit ?? 0);
      agg.set(l.account_code, a);
    }
    setAccts([...agg.values()].sort((x, y) => x.code.localeCompare(y.code)));
    setLoading(false);
  }, [period]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const sumBy = (t: AcctType, signCreditNormal: boolean) =>
    accts.filter((a) => a.type === t).reduce((s, a) => s + (signCreditNormal ? a.credit - a.debit : a.debit - a.credit), 0);

  const revenue = sumBy("revenue", true);
  const expense = sumBy("expense", false);
  const netProfit = revenue - expense;
  const assets = sumBy("asset", false);
  const liabilities = sumBy("liability", true);
  const equityBase = sumBy("equity", true);
  const equity = equityBase + netProfit;            // รวมกำไรสะสมงวดนี้
  const totalDebit = accts.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accts.reduce((s, a) => s + a.credit, 0);
  const balanced = Math.abs(assets - (liabilities + equity)) < 1;

  const Row = ({ label, val, bold }: { label: string; val: number; bold?: boolean }) => (
    <div className={`flex justify-between text-xs ${bold ? "font-bold text-aviva-text" : "text-aviva-secondary"}`}>
      <span>{label}</span><span>{baht(val)}</span>
    </div>
  );

  return (
    <GlassCard className="p-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileBarChart size={16} className="text-aviva-gold" />
          <span className="text-sm font-semibold text-aviva-text">งบการเงิน (อัตโนมัติจากสมุดรายวัน)</span>
        </div>
        {open ? <ChevronDown size={16} className="text-aviva-secondary" /> : <ChevronRight size={16} className="text-aviva-secondary" />}
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex gap-1.5 mb-3">
            {([["month", "เดือนนี้"], ["year", "ปีนี้"], ["all", "ทั้งหมด"]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setPeriod(k)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border ${period === k ? "border-aviva-gold bg-aviva-gold/10 text-aviva-gold" : "border-aviva-gold/15 text-aviva-secondary"}`}>{lbl}</button>
            ))}
          </div>

          {loading ? (
            <p className="text-[11px] text-aviva-secondary/70 text-center py-3">กำลังคำนวณ…</p>
          ) : accts.length === 0 ? (
            <p className="text-[11px] text-aviva-secondary/70 text-center py-3">ยังไม่มีรายการบัญชีในงวดนี้</p>
          ) : (
            <div className="space-y-3">
              {/* งบกำไรขาดทุน */}
              <div className="bg-aviva-bg/40 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-aviva-gold mb-1.5">งบกำไรขาดทุน ({period === "month" ? "เดือนนี้" : period === "year" ? "ปีนี้" : "ทั้งหมด"})</p>
                <Row label="รายได้" val={revenue} />
                <Row label="ต้นทุน + ค่าใช้จ่าย" val={expense} />
                <div className="border-t border-aviva-gold/10 mt-1 pt-1">
                  <div className={`flex justify-between text-xs font-bold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    <span>กำไร(ขาดทุน)สุทธิ</span><span>{baht(netProfit)}</span>
                  </div>
                </div>
              </div>

              {/* งบดุล */}
              <div className="bg-aviva-bg/40 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-aviva-gold mb-1.5">งบแสดงฐานะการเงิน (งบดุล)</p>
                <Row label="สินทรัพย์รวม" val={assets} bold />
                <div className="mt-1.5">
                  <Row label="หนี้สินรวม" val={liabilities} />
                  <Row label="ส่วนของผู้ถือหุ้น (รวมกำไรสะสมงวด)" val={equity} />
                  <Row label="หนี้สิน + ส่วนของผู้ถือหุ้น" val={liabilities + equity} bold />
                </div>
                <p className={`text-[10px] mt-1.5 ${balanced ? "text-green-400" : "text-orange-400"}`}>
                  {balanced ? "✓ งบดุลสมดุล (สินทรัพย์ = หนี้สิน + ทุน)" : "⚠ ยังไม่สมดุล — ตรวจรายการเปิดบัญชี/ทุนจดทะเบียน"}
                </p>
              </div>

              {/* งบทดลอง */}
              <div>
                <button onClick={() => setOpenTB((v) => !v)} className="flex items-center gap-1 text-[11px] text-aviva-gold font-medium">
                  {openTB ? <ChevronDown size={12} /> : <ChevronRight size={12} />} งบทดลอง (Trial Balance) {accts.length} บัญชี
                </button>
                {openTB && (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="grid grid-cols-12 gap-1 text-[9px] text-aviva-secondary/60 border-b border-aviva-gold/10 pb-0.5">
                      <div className="col-span-6">บัญชี</div><div className="col-span-3 text-right">เดบิต</div><div className="col-span-3 text-right">เครดิต</div>
                    </div>
                    {accts.map((a) => (
                      <div key={a.code} className="grid grid-cols-12 gap-1 text-[10px]">
                        <div className="col-span-6 text-aviva-secondary truncate">{a.code} {a.name}</div>
                        <div className="col-span-3 text-right text-aviva-secondary">{a.debit ? baht(a.debit) : "-"}</div>
                        <div className="col-span-3 text-right text-aviva-secondary">{a.credit ? baht(a.credit) : "-"}</div>
                      </div>
                    ))}
                    <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-aviva-text border-t border-aviva-gold/10 pt-0.5">
                      <div className="col-span-6">รวม</div>
                      <div className="col-span-3 text-right">{baht(totalDebit)}</div>
                      <div className="col-span-3 text-right">{baht(totalCredit)}</div>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-aviva-secondary/50">
                * คำนวณจากสมุดรายวัน (JV) จริง — เป็นงบเบื้องต้นเพื่อบริหาร ควรให้ผู้สอบบัญชี (CPA) สอบทานก่อนยื่นจริง
              </p>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
