"use client";
import { useState } from "react";
import { UserPlus, Check, X, Loader2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// แผนก (ไทย) -> role ของแอป
const DEPT_ROLE: Record<string, string> = {
  "ฝ่ายขาย": "sales",
  "ฝ่ายก่อสร้าง": "engineer",
  "ฝ่ายการเงิน": "finance",
  "ฝ่ายบัญชี": "accountant",
  "ฝ่ายบุคคล": "hr",
  "ฝ่ายการตลาด": "marketing",
  "ฝ่ายหลังการขาย": "after_sales",
  "ฝ่ายบริหาร": "manager",
};

function mapRole(dept?: string | null, position?: string | null): string {
  const p = position ?? "";
  if (/ผู้อำนวยการ/.test(p)) return "director";
  if ((dept ?? "") === "ฝ่ายบริหาร") return /ผู้จัดการ/.test(p) ? "project_manager" : "manager";
  if (/ผู้จัดการ|หัวหน้า/.test(p)) return "manager";
  return DEPT_ROLE[dept ?? ""] ?? "user";
}

const tempPassword = () => "Aviva" + Math.floor(1000 + Math.random() * 9000);

type RowStatus = "" | "creating" | "done" | "skip" | "error";
interface Row {
  emp_id: string; full_name: string; department: string;
  email: string; role: string; password: string;
  autoEmail: boolean; status: RowStatus; msg?: string;
}

interface EmpRow { id: string; full_name: string; email: string | null; department: string | null; position: string | null }

// การ์ด "สร้างบัญชีพนักงานที่ยังไม่มี" — เตรียมบัญชีพนักงาน active ทั้งหมดในคลิกเดียว
export default function SeedPilotAccounts({ existingEmails, onDone }: { existingEmails: string[]; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  const load = async () => {
    setLoading(true); setLoadErr("");
    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name, email, department, position")
      .eq("status", "active")
      .order("department");
    if (error) { setLoadErr("โหลดรายชื่อพนักงานไม่สำเร็จ"); setLoading(false); return; }
    const exist = new Set(existingEmails.map((e) => e.toLowerCase()));
    const roleCount: Record<string, number> = {};
    const r: Row[] = [];
    for (const e of (data as EmpRow[]) ?? []) {
      const email0 = (e.email ?? "").trim().toLowerCase();
      if (email0 && exist.has(email0)) continue; // มีบัญชีอยู่แล้ว
      const role = mapRole(e.department, e.position);
      roleCount[role] = (roleCount[role] ?? 0) + 1;
      const autoEmail = !email0;
      const email = email0 || `${role}${roleCount[role]}@aviva.th`; // เดาอีเมลให้คนที่ยังไม่มี (แก้ได้)
      r.push({ emp_id: e.id, full_name: e.full_name, department: e.department ?? "ฝ่ายบริหาร", email, role, password: tempPassword(), autoEmail, status: "" });
    }
    setRows(r); setLoading(false); setOpen(true);
  };

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const createAll = async () => {
    setRunning(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRunning(false); return; }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status === "done") continue;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email) || row.password.length < 6) {
        update(i, { status: "error", msg: "อีเมล/รหัสผ่านไม่ถูกต้อง" }); continue;
      }
      update(i, { status: "creating", msg: "" });
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email: row.email, password: row.password, full_name: row.full_name, role: row.role, department: row.department }),
        });
        const d = await res.json();
        if (d.error) {
          if (/already|exist|duplicate/i.test(d.error)) update(i, { status: "skip", msg: "มีบัญชีอยู่แล้ว" });
          else update(i, { status: "error", msg: d.error });
        } else update(i, { status: "done" });
      } catch (e) {
        update(i, { status: "error", msg: e instanceof Error ? e.message : "ผิดพลาด" });
      }
    }
    setRunning(false);
    onDone();
  };

  const pending = rows.filter((r) => r.status !== "done" && r.status !== "skip").length;
  const doneCount = rows.filter((r) => r.status === "done").length;

  return (
    <GlassCard className="p-4 border border-aviva-gold/20">
      <button onClick={() => (open ? setOpen(false) : load())} disabled={loading}
        className="w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-aviva-gold" />
          <span className="text-sm font-semibold text-aviva-text">เตรียมบัญชีพนักงาน (Seed)</span>
        </div>
        {loading ? <Loader2 size={16} className="animate-spin text-aviva-secondary" />
          : open ? <ChevronDown size={16} className="text-aviva-secondary" />
          : <ChevronRight size={16} className="text-aviva-secondary" />}
      </button>
      {loadErr && <p className="text-xs text-red-400 mt-2">{loadErr}</p>}

      {open && (
        <div className="mt-3 space-y-2">
          {rows.length === 0 ? (
            <p className="text-xs text-aviva-secondary">พนักงาน active ทุกคนมีบัญชีแล้ว ✓ ไม่มีรายการต้องสร้าง</p>
          ) : (
            <>
              <p className="text-[11px] text-aviva-secondary">
                พบ {rows.length} คนที่ยังไม่มีบัญชี — role/อีเมล/รหัสชั่วคราว เตรียมให้แล้ว (แก้ได้ก่อนกดสร้าง)
              </p>
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={r.emp_id} className="rounded-xl border border-aviva-gold/10 bg-aviva-bg/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-aviva-text truncate">{r.full_name}</span>
                      <span className="text-[10px] text-aviva-secondary flex-shrink-0">{r.department}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      <input value={r.email} onChange={(e) => update(i, { email: e.target.value, autoEmail: false })}
                        placeholder="อีเมล" disabled={r.status === "done"}
                        className={`col-span-2 text-[11px] bg-aviva-card border rounded-lg px-2 py-1 text-aviva-text ${r.autoEmail ? "border-amber-400/40" : "border-aviva-gold/10"}`} />
                      <select value={r.role} onChange={(e) => update(i, { role: e.target.value })} disabled={r.status === "done"}
                        className="text-[11px] bg-aviva-card border border-aviva-gold/10 rounded-lg px-2 py-1 text-aviva-text">
                        {Object.values(DEPT_ROLE).concat(["manager", "project_manager", "director", "user"]).filter((v, idx, a) => a.indexOf(v) === idx).map((rv) => (
                          <option key={rv} value={rv}>{rv}</option>
                        ))}
                      </select>
                      <input value={r.password} onChange={(e) => update(i, { password: e.target.value })} disabled={r.status === "done"}
                        placeholder="รหัสชั่วคราว"
                        className="text-[11px] bg-aviva-card border border-aviva-gold/10 rounded-lg px-2 py-1 text-aviva-text font-mono" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 min-h-[16px]">
                      {r.autoEmail && r.status === "" && <span className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle size={10} /> อีเมลเดาให้ — ตรวจก่อน</span>}
                      {r.status === "creating" && <span className="text-[10px] text-aviva-secondary flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> กำลังสร้าง…</span>}
                      {r.status === "done" && <span className="text-[10px] text-green-400 flex items-center gap-1"><Check size={10} /> สร้างแล้ว</span>}
                      {r.status === "skip" && <span className="text-[10px] text-aviva-secondary flex items-center gap-1"><Check size={10} /> {r.msg}</span>}
                      {r.status === "error" && <span className="text-[10px] text-red-400 flex items-center gap-1"><X size={10} /> {r.msg}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[10px] text-aviva-secondary">
                  {doneCount > 0 && `สร้างแล้ว ${doneCount} · `}แจ้งให้พนักงานเปลี่ยนรหัสเมื่อเข้าครั้งแรก
                </p>
                <button onClick={createAll} disabled={running || pending === 0}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-aviva-gold text-aviva-bg disabled:opacity-40 flex items-center gap-1.5">
                  {running ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  สร้างทั้งหมด ({pending})
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}
