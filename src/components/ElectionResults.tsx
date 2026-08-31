"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, PieChart, Pie, Tooltip, LabelList,
} from "recharts";
import {
  Search, ChevronLeft, ChevronRight, Hash, BarChart3, Crown, MapPin, Vote, Layers, Grid3x3,
} from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/GlassCard";
import {
  getCandidates, getOfficialResults, getAdvanceResults,
  type Candidate, type OfficialResult, type AdvanceResult,
} from "@/lib/election-results";

type ChartType = "number" | "barV" | "barH" | "pie";
type ViewMode = "unit" | "area" | "overall";

// ผู้สมัคร 3 คน (fallback ถ้าดึงจาก DB ไม่ได้) — ฉัตร=ทีมเรา
const CAND = [
  { key: "v_chatr" as const, num: 7, label: "ฉัตร", color: "#15803D" },
  { key: "v_kongkiat" as const, num: 9, label: "ก้องเกียรติ", color: "#F59E0B" },
  { key: "v_prasert" as const, num: 11, label: "ประเสริฐ", color: "#DC2626" },
];
type VoteRow = { name: string; value: number; fill: string; num: number; isOurs: boolean; key: string };
type Totals = { eligible: number; voted: number; v_chatr: number; v_kongkiat: number; v_prasert: number };

const fmt = (n: number) => Math.round(n).toLocaleString("th-TH");
const ZERO: Totals = { eligible: 0, voted: 0, v_chatr: 0, v_kongkiat: 0, v_prasert: 0 };
function sumRows(arr: { eligible: number; voted: number; v_chatr: number; v_kongkiat: number; v_prasert: number }[]): Totals {
  return arr.reduce((a, r) => ({
    eligible: a.eligible + r.eligible, voted: a.voted + r.voted,
    v_chatr: a.v_chatr + r.v_chatr, v_kongkiat: a.v_kongkiat + r.v_kongkiat, v_prasert: a.v_prasert + r.v_prasert,
  }), { ...ZERO });
}

// ---------- mini chart (แท่งตั้ง/แท่งนอน/วงกลม) ----------
function MiniChart({ data, type, height = 160 }: { data: VoteRow[]; type: ChartType; height?: number }) {
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={height * 0.4} label>
            {data.map((d) => <Cell key={d.key} fill={d.fill} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  const horizontal = type === "barH";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 14, right: 20, left: horizontal ? 4 : 0, bottom: 0 }}>
        {horizontal ? (
          <>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
          </>
        )}
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
        <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.key} fill={d.fill} />)}
          <LabelList dataKey="value" position={horizontal ? "right" : "top"} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- ตัวเลข: แถวคะแนนผู้สมัคร + แถบสัดส่วน ----------
function NumberBreakdown({ rows, voted }: { rows: VoteRow[]; voted: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const winnerNum = rows.reduce((m, r) => (r.value > m.value ? r : m), rows[0])?.num;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="flex items-center gap-1.5 font-semibold text-aviva-text">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.fill }} />
              {r.name} <span className="text-aviva-secondary font-normal">เบอร์ {r.num}</span>
              {r.num === winnerNum && <Crown size={12} className="text-amber-500" />}
            </span>
            <span className="font-bold tabular-nums" style={{ color: r.fill }}>{fmt(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-black/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.fill }} />
          </div>
        </div>
      ))}
      {voted > 0 && (
        <p className="text-[10px] text-aviva-secondary pt-0.5">
          รวมคะแนน 3 คน {fmt(rows.reduce((s, r) => s + r.value, 0))} · ผู้มาใช้สิทธิ {fmt(voted)}
        </p>
      )}
    </div>
  );
}

export default function ElectionResults() {
  const [results, setResults] = useState<OfficialResult[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [advance, setAdvance] = useState<AdvanceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const [areaFilter, setAreaFilter] = useState<number | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("unit");
  const [chartType, setChartType] = useState<ChartType>("number");
  const [pageSize, setPageSize] = useState(3);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [r, c, a] = await Promise.all([getOfficialResults(), getCandidates(), getAdvanceResults()]);
      if (r.length === 0) setErr(true);
      setResults(r); setCandidates(c); setAdvance(a); setLoading(false);
    })().catch(() => { setErr(true); setLoading(false); });
  }, []);

  useEffect(() => { setPage(0); }, [areaFilter, pageSize, search, viewMode]);

  // meta ผู้สมัคร (override label/color/is_ours จาก DB)
  const cand = useMemo(() => CAND.map((c) => {
    const db = candidates.find((x) => x.number === c.num);
    const label = db?.short_name || db?.name || c.label;
    return { ...c, label: () => label, color: db?.color || c.color, isOurs: db?.is_ours ?? c.num === 7 };
  }), [candidates]);

  const rowsOf = useMemo(() => (t: Pick<Totals, "v_chatr" | "v_kongkiat" | "v_prasert">): VoteRow[] =>
    cand.map((c) => ({ name: c.label(), value: t[c.key], fill: c.color, num: c.num, isOurs: c.isOurs, key: c.key })),
  [cand]);

  const areas = useMemo(() => {
    const m = new Map<number, { code: number; name: string; type: string; count: number }>();
    for (const r of results) {
      if (!m.has(r.area_code)) m.set(r.area_code, { code: r.area_code, name: r.area_name, type: r.area_type, count: 0 });
      m.get(r.area_code)!.count++;
    }
    return [...m.values()].sort((a, b) => a.code - b.code);
  }, [results]);

  const scope = useMemo(() => {
    let arr = results;
    if (areaFilter !== "all") arr = arr.filter((r) => r.area_code === areaFilter);
    const q = search.trim();
    if (q) arr = arr.filter((r) => String(r.unit_no).includes(q) || (r.location ?? "").includes(q));
    return arr;
  }, [results, areaFilter, search]);

  if (loading) return <div className="h-72 rounded-2xl bg-aviva-card/60 animate-pulse" />;
  if (err || results.length === 0) return (
    <GlassCard className="p-6 text-center">
      <p className="text-sm text-aviva-secondary">ยังไม่มีข้อมูลผลเลือกตั้ง หรือโหลดไม่สำเร็จ</p>
    </GlassCard>
  );

  const scopeTotals = sumRows(scope);
  const scopeRows = rowsOf(scopeTotals);
  const scopeWinner = scopeRows.reduce((m, r) => (r.value > m.value ? r : m), scopeRows[0]);
  const scopeTurnout = scopeTotals.eligible ? (scopeTotals.voted / scopeTotals.eligible) * 100 : 0;
  const areaName = areaFilter === "all" ? "ทุกพื้นที่" : areas.find((a) => a.code === areaFilter)?.name ?? "";

  const pages = Math.max(1, Math.ceil(scope.length / pageSize));
  const pageUnits = scope.slice(page * pageSize, (page + 1) * pageSize);

  const segChart: { v: ChartType; label: React.ReactNode }[] = [
    { v: "number", label: <><Hash size={13} /> ตัวเลข</> },
    { v: "barV", label: <><BarChart3 size={13} /> แท่งตั้ง</> },
    { v: "barH", label: <><BarChart3 size={13} className="rotate-90" /> แท่งนอน</> },
    { v: "pie", label: <>◕ วงกลม</> },
  ];
  const segView: { v: ViewMode; label: React.ReactNode }[] = [
    { v: "unit", label: <><Grid3x3 size={13} /> รายหน่วย</> },
    { v: "area", label: <><Layers size={13} /> รายพื้นที่</> },
    { v: "overall", label: <><Vote size={13} /> ภาพรวม</> },
  ];

  return (
    <div className="space-y-3">
      {/* ===== สรุปตามขอบเขตที่เลือก ===== */}
      <GlassCard gold className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-aviva-secondary">ผลรวม · {areaName} · {scope.length} หน่วย</p>
          <span className="text-[10px] font-bold text-aviva-secondary">turnout {scopeTurnout.toFixed(1)}%</span>
        </div>
        <div className="flex items-end gap-2">
          <Crown size={20} className="text-amber-500 mb-1" />
          <div>
            <p className="text-2xl font-extrabold leading-none" style={{ color: scopeWinner.fill }}>
              {scopeWinner.name} <span className="text-sm">เบอร์ {scopeWinner.num}</span>
            </p>
            <p className="text-[11px] text-aviva-secondary mt-0.5">ชนะด้วย {fmt(scopeWinner.value)} คะแนน</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {scopeRows.map((r) => (
            <div key={r.key} className="rounded-xl p-2 text-center" style={{ background: `${r.fill}14` }}>
              <p className="text-[10px] font-semibold truncate" style={{ color: r.fill }}>{r.name}</p>
              <p className="text-base font-extrabold tabular-nums text-aviva-text">{fmt(r.value)}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ===== ตัวเลือกพื้นที่ ===== */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <AreaChip active={areaFilter === "all"} onClick={() => setAreaFilter("all")} label="ทั้งหมด" count={results.length} />
        {areas.map((a) => (
          <AreaChip key={a.code} active={areaFilter === a.code} onClick={() => setAreaFilter(a.code)}
            label={a.name.replace("เทศบาลนครฯ ", "").replace("ตำบล", "ต.")} count={a.count} />
        ))}
      </div>

      {/* ===== มุมมอง + รูปแบบ ===== */}
      <Seg options={segView} value={viewMode} onChange={setViewMode} />
      <Seg options={segChart} value={chartType} onChange={setChartType} />

      {/* ===== เนื้อหา ===== */}
      {viewMode === "overall" && (
        <GlassCard className="p-4">
          <p className="text-sm font-bold text-aviva-text mb-2">ภาพรวม · {areaName}</p>
          {chartType === "number"
            ? <NumberBreakdown rows={scopeRows} voted={scopeTotals.voted} />
            : <MiniChart data={scopeRows} type={chartType} height={230} />}
          {areaFilter === "all" && advance.length > 0 && (
            <div className="mt-3 pt-3 border-t border-aviva-gold/10">
              <p className="text-[11px] text-aviva-secondary mb-2">+ เลือกตั้งล่วงหน้า {advance.length} ชุด ({fmt(sumRows(advance.map((a) => ({ ...ZERO, ...a }))).voted || advance.reduce((s, a) => s + a.ballots, 0))} บัตร)</p>
              <NumberBreakdown rows={rowsOf(sumRows(advance.map((a) => ({ ...ZERO, ...a }))))} voted={0} />
            </div>
          )}
        </GlassCard>
      )}

      {viewMode === "area" && (
        <div className="space-y-2">
          {(areaFilter === "all" ? areas : areas.filter((a) => a.code === areaFilter)).map((a) => {
            const t = sumRows(results.filter((r) => r.area_code === a.code));
            const rows = rowsOf(t);
            const w = rows.reduce((m, r) => (r.value > m.value ? r : m), rows[0]);
            const to = t.eligible ? (t.voted / t.eligible) * 100 : 0;
            return (
              <GlassCard key={a.code} className="p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-aviva-text">{a.name}</p>
                  <span className="text-[10px] text-aviva-secondary">{a.count} หน่วย · {to.toFixed(0)}%</span>
                </div>
                {chartType === "number"
                  ? <NumberBreakdown rows={rows} voted={t.voted} />
                  : <MiniChart data={rows} type={chartType} height={170} />}
                <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: w.fill }}>
                  <Crown size={12} /> ชนะ: {w.name} ({fmt(w.value)})
                </p>
              </GlassCard>
            );
          })}
        </div>
      )}

      {viewMode === "unit" && (
        <>
          {/* ค้นหา + ขนาดหน้า */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} inputMode="numeric"
                placeholder="ค้นหน่วย / สถานที่"
                className="w-full bg-aviva-card border border-aviva-gold/15 rounded-xl pl-9 pr-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/50" />
            </div>
            <div className="flex gap-1 bg-aviva-card rounded-xl p-1">
              {[2, 3, 10].map((n) => (
                <button key={n} onClick={() => setPageSize(n)}
                  className={clsx("px-2.5 py-1.5 rounded-lg text-xs font-bold", pageSize === n ? "bg-aviva-gold text-aviva-bg" : "text-aviva-secondary")}>{n}</button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-aviva-secondary">
            แสดง {scope.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, scope.length)} จาก {scope.length} หน่วย
          </p>

          <div className="space-y-2">
            {pageUnits.map((u) => {
              const rows = rowsOf(u);
              const w = rows.reduce((m, r) => (r.value > m.value ? r : m), rows[0]);
              return (
                <GlassCard key={`${u.area_code}-${u.unit_no}`} className="p-3.5" style={{ borderColor: `${w.fill}55` }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-aviva-text">หน่วยที่ {u.unit_no}</p>
                      <p className="text-[11px] text-aviva-secondary flex items-start gap-1 mt-0.5">
                        <MapPin size={11} className="mt-0.5 shrink-0" /><span className="line-clamp-2">{u.location || "—"}</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ color: w.fill, background: `${w.fill}18` }}>
                      🏆 {w.name}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-aviva-secondary mb-2">
                    <span>ผู้มีสิทธิ <b className="text-aviva-text">{fmt(u.eligible)}</b></span>
                    <span>มาใช้สิทธิ <b className="text-aviva-text">{fmt(u.voted)}</b></span>
                    <span>{u.turnout_pct}%</span>
                  </div>
                  {chartType === "number"
                    ? <NumberBreakdown rows={rows} voted={u.voted} />
                    : <MiniChart data={rows} type={chartType} height={150} />}
                </GlassCard>
              );
            })}
            {pageUnits.length === 0 && (
              <GlassCard className="p-4"><p className="text-xs text-aviva-secondary text-center">ไม่พบหน่วยที่ค้นหา</p></GlassCard>
            )}
          </div>

          {/* ตัวแบ่งหน้า */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="flex items-center gap-1 text-xs font-semibold text-aviva-text disabled:opacity-30 bg-aviva-card px-3 py-2 rounded-xl active:scale-95">
                <ChevronLeft size={14} /> ก่อนหน้า
              </button>
              <span className="text-xs font-bold text-aviva-secondary">หน้า {page + 1}/{pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
                className="flex items-center gap-1 text-xs font-semibold text-aviva-text disabled:opacity-30 bg-aviva-card px-3 py-2 rounded-xl active:scale-95">
                ถัดไป <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Seg<T extends string>({ options, value, onChange }: {
  options: { v: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-aviva-card rounded-xl p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={clsx("flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1",
            value === o.v ? "bg-aviva-gold text-aviva-bg" : "text-aviva-secondary")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AreaChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick}
      className={clsx("shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 border",
        active ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/15")}>
      {label} <span className={clsx("text-[10px]", active ? "opacity-80" : "opacity-50")}>{count}</span>
    </button>
  );
}
