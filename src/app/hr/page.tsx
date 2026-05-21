"use client";

import { useState, useEffect } from "react";
import { Plus, X, Users, Phone, Briefcase, Pencil } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/audit";

interface Employee {
  id: string;
  full_name: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  position: string;
  base_salary: number;
  commission_rate: number;
  start_date: string;
  status: string;
}

const DEPARTMENTS = ["ฝ่ายขาย", "ฝ่ายก่อสร้าง", "ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายบุคคล", "ฝ่ายบริหาร"];

const deptColor: Record<string, string> = {
  "ฝ่ายขาย": "bg-blue-500/20 text-blue-400",
  "ฝ่ายก่อสร้าง": "bg-orange-500/20 text-orange-400",
  "ฝ่ายการเงิน": "bg-green-500/20 text-green-400",
  "ฝ่ายบัญชี": "bg-purple-500/20 text-purple-400",
  "ฝ่ายบุคคล": "bg-pink-500/20 text-pink-400",
  "ฝ่ายบริหาร": "bg-aviva-gold/20 text-aviva-gold",
};

const emptyForm = {
  full_name: "", nickname: "", phone: "", email: "",
  department: "ฝ่ายขาย", position: "", base_salary: "", commission_rate: "",
  start_date: new Date().toISOString().split("T")[0], status: "active",
};

function formatThb(n: number) { return n.toLocaleString("th-TH"); }

export default function HRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterDept, setFilterDept] = useState("ทั้งหมด");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const fetchEmployees = () => {
    supabase.from("employees").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setEmployees((data as Employee[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchEmployees(); }, []);

  const active = employees.filter(e => e.status === "active");
  const totalSalary = active.reduce((s, e) => s + Number(e.base_salary), 0);
  const filtered = filterDept === "ทั้งหมด" ? employees : employees.filter(e => e.department === filterDept);

  const openAdd = () => { setEditingEmployee(null); setForm(emptyForm); setError(""); setShowModal(true); };

  const openEdit = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEmployee(emp);
    setForm({
      full_name: emp.full_name, nickname: emp.nickname ?? "", phone: emp.phone ?? "",
      email: emp.email ?? "", department: emp.department, position: emp.position ?? "",
      base_salary: String(emp.base_salary), commission_rate: String(emp.commission_rate),
      start_date: emp.start_date ?? new Date().toISOString().split("T")[0], status: emp.status,
    });
    setError(""); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.phone) { setError("กรุณากรอกข้อมูลให้ครบ"); return; }
    setSaving(true); setError("");
    const payload = {
      full_name: form.full_name, nickname: form.nickname, phone: form.phone, email: form.email,
      department: form.department, position: form.position,
      base_salary: Number(form.base_salary) || 0, commission_rate: Number(form.commission_rate) || 0,
      start_date: form.start_date, status: form.status, updated_at: new Date().toISOString(),
    };
    if (editingEmployee) {
      await supabase.from("employees").update(payload).eq("id", editingEmployee.id);
      await logAction("hr", "edit_employee", `แก้ไขพนักงาน ${form.full_name} ฝ่าย${form.department}`);
    } else {
      await supabase.from("employees").insert({ ...payload });
      await logAction("hr", "add_employee", `เพิ่มพนักงาน ${form.full_name} ฝ่าย${form.department}`);
    }
    setSaving(false); setShowModal(false); setEditingEmployee(null); setForm(emptyForm); fetchEmployees();
  };

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">บุคคล (HR)</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${active.length} คน · เงินเดือนรวม ฿${formatThb(totalSalary)}`}
              </p>
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Plus size={14} /> เพิ่มพนักงาน
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <GlassCard className="p-3 text-center">
            <p className="text-xl font-bold text-aviva-text">{active.length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">พนักงานทั้งหมด</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <p className="text-xl font-bold text-aviva-gold">{employees.filter(e => e.department === "ฝ่ายขาย").length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">ฝ่ายขาย</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <p className="text-xl font-bold text-orange-400">{employees.filter(e => e.department === "ฝ่ายก่อสร้าง").length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">ก่อสร้าง</p>
          </GlassCard>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {["ทั้งหมด", ...DEPARTMENTS].map(dept => (
            <button key={dept} onClick={() => setFilterDept(dept)}
              className={clsx("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                filterDept === dept ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{dept}</button>
          ))}
        </div>

        <div>
          <SectionHeader title="รายชื่อพนักงาน" subtitle="กดปุ่ม + เพื่อเพิ่ม" />
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            ) : filtered.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <Users size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีพนักงาน กดเพิ่มพนักงานใหม่</p>
              </GlassCard>
            ) : (
              filtered.map(emp => (
                <GlassCard key={emp.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-aviva-gold font-bold text-sm">{emp.nickname || emp.full_name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-aviva-text">{emp.full_name}</p>
                        {emp.nickname && <span className="text-xs text-aviva-secondary">({emp.nickname})</span>}
                        <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full", deptColor[emp.department] ?? "bg-gray-500/20 text-gray-400")}>{emp.department}</span>
                      </div>
                      {emp.position && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Briefcase size={10} className="text-aviva-secondary" />
                          <p className="text-xs text-aviva-secondary">{emp.position}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {emp.phone && <span className="flex items-center gap-1 text-xs text-aviva-secondary"><Phone size={10} />{emp.phone}</span>}
                        {emp.base_salary > 0 && <span className="text-xs text-aviva-gold font-medium">฿{formatThb(emp.base_salary)}/เดือน</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={(e) => openEdit(emp, e)}
                        className="p-1.5 rounded-lg text-aviva-secondary/60 hover:text-aviva-gold hover:bg-aviva-gold/10 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <span className={clsx("text-[10px] px-2 py-1 rounded-full",
                        emp.status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400")}>
                        {emp.status === "active" ? "ทำงานอยู่" : "ลาออก"}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">{editingEmployee ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}</h2>
              <button onClick={() => { setShowModal(false); setEditingEmployee(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ชื่อ-นามสกุล *</label>
                  <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="ชื่อจริง นามสกุล"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเล่น</label>
                  <input type="text" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                    placeholder="ชื่อเล่น"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร *</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ฝ่าย</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ตำแหน่ง</label>
                  <input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="เช่น พนักงานขาย"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เงินเดือน (บาท)</label>
                  <input type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                    placeholder="15000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ค่าคอม (%)</label>
                  <input type="number" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                    placeholder="1.5" step="0.1"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันเริ่มงาน</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              {editingEmployee && (
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="active">ทำงานอยู่</option>
                    <option value="inactive">ลาออก</option>
                  </select>
                </div>
              )}
            </div>
            <button onClick={handleSave} disabled={saving || !form.full_name || !form.phone}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : editingEmployee ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
