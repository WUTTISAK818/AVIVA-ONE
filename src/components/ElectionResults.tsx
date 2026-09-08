"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, PieChart, Pie, Tooltip, LabelList,
} from "recharts";
import {
  Search, ChevronLeft, ChevronRight, Hash, BarChart3, Crown, MapPin, Vote, Layers, Grid3x3,
  Users, Gauge, ChevronDown, Star,
} from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/GlassCard";
import {
  loadElectionData, type Candidate, type OfficialResult, type AdvanceResult,
  type Responsible, type UnitResponsible,
} from "@/lib/election-results";

type ChartType = "number" | "barV" | "barH" | "pie";
type ViewMode = "unit" | "area" | "overall" | "efficiency";

const CAND = [
  { key: "v_chatr" as const, num: 7, label: "ฉัตร", color: "#15803D" },
  { key: "v_kongkiat" as const, num: 9, label: "ก้องเกียรติ", color: "#F59E0B" },
  { key: "v_prasert" as const, num: 11, label: "ประเสริฐ", color: "#DC2626" },
];
const GRADE_COLOR: Record<string, string> = { A: "#15803D", B: "#F59E0B", C: "#DC2626", "N/A": "#94A3B8" };
const GRADE_LABEL: Record<string, string> = { A: "ทำได้ตามเป้า", B: "เกือบถึงเป้า", C: "ต่ำกว่าเป้า", "N/A": "ไม่มีข้อมูลฐานเสียง" };

type VoteRow = { name: string; value: number; fill: string; num: number; key: string };
type Totals = { eligible: number; voted: number; v_chatr: number; v_kongkiat: number; v_prasert: number };
const ZERO: Totals = { eligible: 0, voted: 0, v_chatr: 0, v_kongkiat: 0, v_prasert: 0 };
const fmt = (n: number) => Math.round(n).toLocaleString("th-TH");
function sumRows(arr: Partial<Totals>[]): Totals {
  return arr.reduce<Totals>((a, r) => ({
    eligible: a.eligible + (r.eligible ?? 0), voted: a.voted + (r.voted ?? 0),
    v_chatr: a.v_chatr + (r.v_chatr ?? 0), v_kongkiat: a.v_kongkiat + (r.v_kongkiat ?? 0), v_prasert: a.v_prasert + (r.v_prasert ?? 0),
  }), { ...ZERO });
}

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
        {horizontal
          ? (<><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /></>)
          : (<><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis hide /></>)}
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
        <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.key} fill={d.fill} />)}
          <LabelList dataKey="value" position={horizontal ? "right" : "top"} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

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
      {voted > 0 && <p className="text-[10px] text-aviva-secondary pt-0.5">รวม 3 คน {fmt(rows.reduce((s, r) => s + r.value, 0))} · ผู้มาใช้สิทธิ {fmt(voted)}</p>}
    </div>
  );
}

function GradeBadge({ grade, size = "sm" }: { grade: string; size?: "sm" | "lg" }) {
  const c = GRADE_COLOR[grade];
  return (
    <span className={clsx("inline-flex items-center justify-center font-extrabold rounded-lg",
      size === "lg" ? "w-9 h-9 text-lg" : "w-6 h-6 text-xs")}
      style={{ color: c, background: `${c}1a`, border: `1.5px solid ${c}55` }}>
      {grade}
    </span>
  );
}

export default function ElectionResults() {
  const [results, setResults] = useState<OfficialResult[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [advance, setAdvance] = useState<AdvanceResult[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [unitResp, setUnitResp] = useState<UnitResponsible[]>([]);
  const [thresh, setThresh] = useState({ A: 1.0, B: 0.7 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const [areaFilter, setAreaFilter] = useState<number | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("unit");
  const [chartType, setChartType] = useState<ChartType>("number");
  const [pageSize, setPageSize] = useState(3);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadElectionData().then((d) => {
      setResults(d.results); setCandidates(d.candidates); setAdvance(d.advance);
      setResponsibles(d.responsibles); setUnitResp(d.unitResponsibles);
      if (d.grade_thresholds) setThresh(d.grade_thresholds);
      setLoading(false);
    }).catch(() => { setErr(true); setLoading(false); });
  }, []);
  useEffect(() => { setPage(0); }, [areaFilter, pageSize, search, viewMode, gradeFilter]);

  const cand = useMemo(() => CAND.map((c) => {
    const db = candidates.find((x) => x.number === c.num);
    const label = db?.short_name || db?.name || c.label;
    return { ...c, label, color: db?.color || c.color };
  }), [candidates]);
  const rowsOf = useMemo(() => (t: Pick<Totals, "v_chatr" | "v_kongkiat" | "v_prasert">): VoteRow[] =>
    cand.map((c) => ({ name: c.label, value: t[c.key], fill: c.color, num: c.num, key: c.key })), [cand]);

  const respByCode = useMemo(() => new Map(responsibles.map((r) => [r.reg_code, r])), [responsibles]);
  const unitRespMap = useMemo(() => {
    const m = new Map<string, UnitResponsible[]>();
    for (const u of unitResp) {
      const k = `${u.area_code}-${u.unit_no}`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(u);
    }
    return m;
  }, [unitResp]);

  // ผู้รับผิดชอบ + ประสิทธิภาพต่อหน่วย
  const effOf = useMemo(() => (u: OfficialResult) => {
    const links = unitRespMap.get(`${u.area_code}-${u.unit_no}`) ?? [];
    const heads: Responsible[] = [];
    const assist: { r: Responsible; cap: number }[] = [];
    for (const l of links) {
      const r = respByCode.get(l.reg_code); if (!r) continue;
      if (r.level === "head") heads.push(r); else assist.push({ r, cap: l.capacity ?? 0 });
    }
    const capTotal = assist.reduce((s, a) => s + a.cap, 0);
    const pct = capTotal ? (u.v_chatr / capTotal) * 100 : null;
    const grade = !capTotal ? "N/A" : u.v_chatr >= capTotal * thresh.A ? "A" : u.v_chatr >= capTotal * thresh.B ? "B" : "C";
    return { heads, assist, capTotal, pct, grade, count: heads.length + assist.length };
  }, [unitRespMap, respByCode, thresh]);

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
    <GlassCard className="p-6 text-center"><p className="text-sm text-aviva-secondary">โหลดข้อมูลผลเลือกตั้งไม่สำเร็จ</p></GlassCard>
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
    { v: "pie", label: <>◕ วง</> },
  ];
  const segView: { v: ViewMode; label: React.ReactNode }[] = [
    { v: "unit", label: <><Grid3x3 size={13} /> รายหน่วย</> },
    { v: "area", label: <><Layers size={13} /> รายพื้นที่</> },
    { v: "overall", label: <><Vote size={13} /> ภาพรวม</> },
    { v: "efficiency", label: <><Gauge size={13} /> ประสิทธิภาพ</> },
  ];

  function ResponsibleBlock({ u }: { u: OfficialResult }) {
    const e = effOf(u);
    const key = `${u.area_code}-${u.unit_no}`;
    const open = expanded === key;
    if (e.count === 0) return <p className="text-[10px] text-aviva-secondary mt-2">— ยังไม่มีข้อมูลผู้รับผิดชอบ</p>;
    return (
      <div className="mt-2 pt-2 border-t border-aviva-gold/10">
        <button onClick={() => setExpanded(open ? null : key)} className="w-full flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-aviva-text font-semibold">
            <Users size={12} className="text-aviva-secondary" /> ผู้รับผิดชอบ {e.count} คน
            {e.heads[0] && <span className="text-aviva-secondary font-normal">· หัวหน้า {e.heads[0].full_name}</span>}
          </span>
          <ChevronDown size={13} className={clsx("text-aviva-secondary transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-2 space-y-1.5">
            {e.heads.map((h) => (
              <div key={h.reg_code} className="flex items-center gap-1.5 text-[11px]">
                <Star size={11} className="text-amber-500 shrink-0" />
                <span className="font-semibold text-aviva-text">{h.full_name}</span>
                <span className="text-aviva-secondary">หัวหน้า (สท.)</span>
              </div>
            ))}
            {e.assist.map(({ r, cap }) => (
              <div key={r.reg_code} className="flex items-center justify-between text-[11px]">
                <span className="min-w-0 truncate">
                  <span className="text-aviva-secondary/60 tabular-nums mr-1">{r.reg_code}</span>
                  <span className="text-aviva-text">{r.full_name}</span>
                  {r.role_title && <span className="text-aviva-secondary"> · {r.role_title}</span>}
                </span>
                <span className="text-aviva-secondary shrink-0 ml-1">ฐาน {cap}</span>
              </div>
            ))}
            {e.capTotal > 0 && (
              <p className="text-[10px] pt-1" style={{ color: GRADE_COLOR[e.grade] }}>
                ศักยภาพรวม {fmt(e.capTotal)} · ฉัตรได้จริง {fmt(u.v_chatr)} · ทำได้ {e.pct?.toFixed(0)}% → เกรด {e.grade}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* สรุปตามขอบเขต */}
      <GlassCard gold className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-aviva-secondary">ผลรวม · {areaName} · {scope.length} หน่วย</p>
          <span className="text-[10px] font-bold text-aviva-secondary">turnout {scopeTurnout.toFixed(1)}%</span>
        </div>
        <div className="flex items-end gap-2">
          <Crown size={20} className="text-amber-500 mb-1" />
          <div>
            <p className="text-2xl font-extrabold leading-none" style={{ color: scopeWinner.fill }}>{scopeWinner.name} <span className="text-sm">เบอร์ {scopeWinner.num}</span></p>
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

      {/* พื้นที่ */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <AreaChip active={areaFilter === "all"} onClick={() => setAreaFilter("all")} label="ทั้งหมด" count={results.length} />
        {areas.map((a) => (
          <AreaChip key={a.code} active={areaFilter === a.code} onClick={() => setAreaFilter(a.code)}
            label={a.name.replace("เทศบาลนครฯ ", "").replace("ตำบล", "ต.")} count={a.count} />
        ))}
      </div>

      <Seg options={segView} value={viewMode} onChange={setViewMode} />
      {viewMode !== "efficiency" && <Seg options={segChart} value={chartType} onChange={setChartType} />}

      {/* ===== ภาพรวม ===== */}
      {viewMode === "overall" && (
        <GlassCard className="p-4">
          <p className="text-sm font-bold text-aviva-text mb-2">ภาพรวม · {areaName}</p>
          {chartType === "number" ? <NumberBreakdown rows={scopeRows} voted={scopeTotals.voted} /> : <MiniChart data={scopeRows} type={chartType} height={230} />}
          {areaFilter === "all" && advance.length > 0 && (
            <div className="mt-3 pt-3 border-t border-aviva-gold/10">
              <p className="text-[11px] text-aviva-secondary mb-2">+ เลือกตั้งล่วงหน้า {advance.length} ชุด ({fmt(advance.reduce((s, a) => s + a.ballots, 0))} บัตร)</p>
              <NumberBreakdown rows={rowsOf(sumRows(advance))} voted={0} />
            </div>
          )}
        </GlassCard>
      )}

      {/* ===== รายพื้นที่ ===== */}
      {viewMode === "area" && (
        <div className="space-y-2">
          {(areaFilter === "all" ? areas : areas.filter((a) => a.code === areaFilter)).map((a) => {
            const units = results.filter((r) => r.area_code === a.code);
            const t = sumRows(units); const rows = rowsOf(t);
            const w = rows.reduce((m, r) => (r.value > m.value ? r : m), rows[0]);
            const capTotal = units.reduce((s, u) => s + effOf(u).capTotal, 0);
            const aPct = capTotal ? (t.v_chatr / capTotal) * 100 : null;
            const aGrade = !capTotal ? "N/A" : t.v_chatr >= capTotal * thresh.A ? "A" : t.v_chatr >= capTotal * thresh.B ? "B" : "C";
            return (
              <GlassCard key={a.code} className="p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-aviva-text">{a.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-aviva-secondary">{a.count} หน่วย</span>
                    {capTotal > 0 && <GradeBadge grade={aGrade} />}
                  </div>
                </div>
                {chartType === "number" ? <NumberBreakdown rows={rows} voted={t.voted} /> : <MiniChart data={rows} type={chartType} height={170} />}
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span style={{ color: w.fill }} className="flex items-center gap-1"><Crown size={12} /> ชนะ: {w.name} ({fmt(w.value)})</span>
                  {aPct != null && <span className="text-aviva-secondary">ประสิทธิภาพ {aPct.toFixed(0)}%</span>}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ===== ประสิทธิภาพ (สำหรับประชุม) ===== */}
      {viewMode === "efficiency" && (() => {
        const withEff = scope.map((u) => ({ u, e: effOf(u) }));
        const graded = withEff.filter((x) => x.e.grade !== "N/A");
        const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
        graded.forEach((x) => { counts[x.e.grade]++; });
        const shown = withEff
          .filter((x) => gradeFilter === "all" || x.e.grade === gradeFilter)
          .sort((a, b) => (a.e.pct ?? 9999) - (b.e.pct ?? 9999));
        return (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(["A", "B", "C"] as const).map((g) => (
                <button key={g} onClick={() => setGradeFilter(gradeFilter === g ? "all" : g)}
                  className={clsx("rounded-xl p-2.5 text-center border transition-all active:scale-95",
                    gradeFilter === g ? "ring-2" : "")}
                  style={{ background: `${GRADE_COLOR[g]}12`, borderColor: `${GRADE_COLOR[g]}40` }}>
                  <p className="text-2xl font-extrabold" style={{ color: GRADE_COLOR[g] }}>{counts[g]}</p>
                  <p className="text-[10px] font-semibold" style={{ color: GRADE_COLOR[g] }}>เกรด {g}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-aviva-secondary">
              เกรด = คะแนนฉัตรจริง ÷ ศักยภาพที่ทีมประเมิน · A ≥100% · B 70–99% · C &lt;70% · เรียงจากต่ำสุด (ต้องดูก่อน)
              {gradeFilter !== "all" && <> · กรอง {gradeFilter} · <button className="underline" onClick={() => setGradeFilter("all")}>ล้าง</button></>}
            </p>
            <div className="space-y-2">
              {shown.map(({ u, e }) => (
                <GlassCard key={`${u.area_code}-${u.unit_no}`} className="p-3" style={{ borderColor: `${GRADE_COLOR[e.grade]}44` }}>
                  <div className="flex items-center gap-3">
                    <GradeBadge grade={e.grade} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-aviva-text">หน่วยที่ {u.unit_no} <span className="text-[10px] font-normal text-aviva-secondary">{u.area_name.replace("เทศบาลนครฯ ", "").replace("ตำบล", "ต.")}</span></p>
                      <p className="text-[10px] text-aviva-secondary truncate">{u.location}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {e.pct != null
                        ? <p className="text-sm font-extrabold" style={{ color: GRADE_COLOR[e.grade] }}>{e.pct.toFixed(0)}%</p>
                        : <p className="text-[10px] text-aviva-secondary">ไม่มีฐาน</p>}
                      <p className="text-[10px] text-aviva-secondary">ฉัตร {fmt(u.v_chatr)} / ฐาน {fmt(e.capTotal)}</p>
                    </div>
                  </div>
                  <ResponsibleBlock u={u} />
                </GlassCard>
              ))}
              {shown.length === 0 && <GlassCard className="p-4"><p className="text-xs text-aviva-secondary text-center">ไม่มีหน่วยในเกณฑ์นี้</p></GlassCard>}
            </div>
          </>
        );
      })()}

      {/* ===== รายหน่วย ===== */}
      {viewMode === "unit" && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} inputMode="numeric" placeholder="ค้นหน่วย / สถานที่"
                className="w-full bg-aviva-card border border-aviva-gold/15 rounded-xl pl-9 pr-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/50" />
            </div>
            <div className="flex gap-1 bg-aviva-card rounded-xl p-1">
              {[2, 3, 10].map((n) => (
                <button key={n} onClick={() => setPageSize(n)}
                  className={clsx("px-2.5 py-1.5 rounded-lg text-xs font-bold", pageSize === n ? "bg-aviva-gold text-aviva-bg" : "text-aviva-secondary")}>{n}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-aviva-secondary">แสดง {scope.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, scope.length)} จาก {scope.length} หน่วย</p>
          <div className="space-y-2">
            {pageUnits.map((u) => {
              const rows = rowsOf(u); const w = rows.reduce((m, r) => (r.value > m.value ? r : m), rows[0]);
              const e = effOf(u);
              return (
                <GlassCard key={`${u.area_code}-${u.unit_no}`} className="p-3.5" style={{ borderColor: `${w.fill}55` }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-aviva-text flex items-center gap-1.5">หน่วยที่ {u.unit_no}
                        {e.grade !== "N/A" && <GradeBadge grade={e.grade} />}</p>
                      <p className="text-[11px] text-aviva-secondary flex items-start gap-1 mt-0.5"><MapPin size={11} className="mt-0.5 shrink-0" /><span className="line-clamp-2">{u.location || "—"}</span></p>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ color: w.fill, background: `${w.fill}18` }}>🏆 {w.name}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-aviva-secondary mb-2">
                    <span>ผู้มีสิทธิ <b className="text-aviva-text">{fmt(u.eligible)}</b></span>
                    <span>มาใช้สิทธิ <b className="text-aviva-text">{fmt(u.voted)}</b></span>
                    <span>{u.turnout_pct}%</span>
                  </div>
                  {chartType === "number" ? <NumberBreakdown rows={rows} voted={u.voted} /> : <MiniChart data={rows} type={chartType} height={150} />}
                  <ResponsibleBlock u={u} />
                </GlassCard>
              );
            })}
            {pageUnits.length === 0 && <GlassCard className="p-4"><p className="text-xs text-aviva-secondary text-center">ไม่พบหน่วยที่ค้นหา</p></GlassCard>}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="flex items-center gap-1 text-xs font-semibold text-aviva-text disabled:opacity-30 bg-aviva-card px-3 py-2 rounded-xl active:scale-95"><ChevronLeft size={14} /> ก่อนหน้า</button>
              <span className="text-xs font-bold text-aviva-secondary">หน้า {page + 1}/{pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
                className="flex items-center gap-1 text-xs font-semibold text-aviva-text disabled:opacity-30 bg-aviva-card px-3 py-2 rounded-xl active:scale-95">ถัดไป <ChevronRight size={14} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Seg<T extends string>({ options, value, onChange }: { options: { v: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 bg-aviva-card rounded-xl p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={clsx("flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1",
            value === o.v ? "bg-aviva-gold text-aviva-bg" : "text-aviva-secondary")}>{o.label}</button>
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
