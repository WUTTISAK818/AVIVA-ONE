"use client";
import { useState, useEffect } from "react";
import { Users, Plus, X, Eye, EyeOff, User, Shield, Save, ArrowLeft } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const ROLES = [
  { value: "admin", label: "ผู้ดูแลระบบ" },
  { value: "ceo", label: "ประธานเจ้าหน้าที่บริหาร (CEO)" },
  { value: "director", label: "ผู้อำนวยการ" },
  { value: "manager", label: "ผู้จัดการ" },
  { value: "project_manager", label: "ผู้จัดการโครงการ" },
  { value: "sales", label: "พนักงานขาย" },
  { value: "marketing", label: "เจ้าหน้าที่การตลาด" },
  { value: "engineer", label: "วิศวกร / ผู้ควบคุมงาน" },
  { value: "finance", label: "เจ้าหน้าที่การเงิน" },
  { value: "accountant", label: "เจ้าหน้าที่บัญชี" },
  { value: "hr", label: "เจ้าหน้าที่ฝ่ายบุคคล" },
  { value: "after_sales", label: "เจ้าหน้าที่หลังการขาย" },
  { value: "user", label: "พนักงานทั่วไป" },
];

const DEPARTMENTS = [
  "ฝ่ายบริหาร", "ฝ่ายขาย", "ฝ่ายก่อสร้าง", "ฝ่ายการเงิน",
  "ฝ่ายบัญชี", "ฝ่ายบุคคล", "ฝ่ายการตลาด", "ฝ่ายหลังการขาย",
];

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  created_at: string;
  last_sign_in_at: string | null;
}

const BLANK_FORM = { email: "", password: "", full_name: "", role: "user", department: "ฝ่ายบริหาร" };

export default function UsersPage() {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [form, setForm] = useState({ ...BLANK_FORM });

  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.isManager) { router.replace("/dashboard"); return; }
    fetchUsers();
  }, [currentUser, router]);

  async function fetchUsers() {
    setLoading(true);
    setListError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
      });
      const data = await res.json();
      if (Array.isArray(data.users)) {
        // Newest first so freshly added users always show at the top of the list.
        const sorted = [...data.users].sort(
          (a: UserRecord, b: UserRecord) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setUsers(sorted);
      } else {
        setListError(data.error ?? "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
      }
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
    }
    setLoading(false);
  }

  function openAdd() {
    setEditUser(null);
    setForm({ ...BLANK_FORM });
    setError("");
    setShowPassword(false);
    setShowModal(true);
  }

  function openEdit(u: UserRecord) {
    setEditUser(u);
    setForm({ email: u.email, password: "", full_name: u.full_name, role: u.role, department: u.department || "ฝ่ายบริหาร" });
    setError("");
    setShowModal(true);
  }

  async function submit() {
    setSaving(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    try {
      if (editUser) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ userId: editUser.id, full_name: form.full_name, role: form.role, department: form.department }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      } else {
        if (!form.email || !form.password) { setError("กรุณากรอก Email และรหัสผ่าน"); setSaving(false); return; }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }
      setShowModal(false);
      await fetchUsers();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
      const friendly = /already.*registered|already.*exist|duplicate/i.test(raw)
        ? "อีเมลนี้ถูกใช้ลงทะเบียนไปแล้ว — ผู้ใช้มีอยู่ในระบบ (ดูได้ที่ด้านบนสุดของรายการ)"
        : raw;
      setError(friendly);
    }
    setSaving(false);
  }

  const roleLabel = (r: string) => ROLES.find(x => x.value === r)?.label ?? r;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="p-1.5 rounded-lg text-aviva-secondary hover:text-aviva-text transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-aviva-gold" />
              <h1 className="text-lg font-bold text-aviva-text">จัดการผู้ใช้</h1>
            </div>
          </div>
          {currentUser?.isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-semibold px-3 py-2 rounded-lg"
            >
              <Plus size={14} />เพิ่มผู้ใช้
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {!loading && !listError && users.length > 0 && (
          <p className="text-xs text-aviva-secondary px-1">ทั้งหมด {users.length} ผู้ใช้ (เรียงจากที่เพิ่มล่าสุด)</p>
        )}
        {listError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {listError}
          </p>
        )}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin mx-auto mb-3" />
            <p className="text-aviva-secondary text-sm">กำลังโหลด...</p>
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-aviva-secondary text-sm py-8">ไม่พบข้อมูลผู้ใช้</p>
        ) : (
          users.map(u => (
            <GlassCard key={u.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                  {["admin", "ceo"].includes(u.role)
                    ? <Shield size={14} className="text-aviva-gold" />
                    : <User size={14} className="text-aviva-secondary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aviva-text truncate">{u.full_name || "(ไม่มีชื่อ)"}</p>
                  <p className="text-xs text-aviva-secondary truncate">{u.email}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 block">
                    {roleLabel(u.role)}
                  </span>
                  <p className="text-[10px] text-aviva-secondary">{u.department}</p>
                </div>
              </div>
              {currentUser?.isAdmin && (
                <button
                  onClick={() => openEdit(u)}
                  className="mt-3 w-full text-xs text-aviva-secondary border border-aviva-gold/10 rounded-lg py-1.5 hover:border-aviva-gold/30 transition-all"
                >
                  แก้ไขข้อมูล
                </button>
              )}
            </GlassCard>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="bg-aviva-card w-full max-w-lg mx-auto rounded-t-2xl p-5 pb-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-aviva-text">{editUser ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              {!editUser && (
                <>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">Email</label>
                    <input
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      type="email"
                      placeholder="user@example.com"
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">รหัสผ่าน</label>
                    <div className="relative">
                      <input
                        value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        type={showPassword ? "text" : "password"}
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aviva-secondary"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อ-นามสกุล</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ตำแหน่ง</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50"
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ฝ่าย</label>
                  <select
                    value={form.department}
                    onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <button
                onClick={submit}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-semibold py-3 rounded-xl text-sm disabled:opacity-60 transition-opacity"
              >
                <Save size={14} />
                {saving ? "กำลังบันทึก..." : editUser ? "บันทึกการแก้ไข" : "สร้างผู้ใช้"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
