"use client";

import { useState, useEffect } from "react";
import { Plus, X, Trash2, Users, ShieldCheck, Eye, EyeOff } from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface SystemUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  created_at: string;
}

const DEPARTMENTS = [
  "ฝ่ายบริหาร", "ฝ่ายขาย", "ฝ่ายก่อสร้าง",
  "ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายบุคคล",
];
const ROLES = ["admin", "manager", "user"];

const emptyForm = {
  email: "", password: "", full_name: "",
  role: "user", department: "ฝ่ายขาย",
};

export default function AdminPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (!error) setUsers((data as SystemUser[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = user?.user_metadata?.role ?? "user";
      setCurrentUserRole(role);
      if (role !== "admin") {
        router.replace("/dashboard");
        return;
      }
      fetchUsers();
    });
  }, [router]);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("admin_create_user", {
      p_email: form.email,
      p_password: form.password,
      p_full_name: form.full_name,
      p_role: form.role,
      p_department: form.department,
    });
    setSaving(false);
    if (rpcError || data?.error) {
      setError(data?.error ?? rpcError?.message ?? "เกิดข้อผิดพลาด");
      return;
    }
    setShowModal(false);
    setForm(emptyForm);
    fetchUsers();
  };

  const handleDelete = async (userId: string, email: string) => {
    if (email === "joyus818@gmail.com") {
      alert("ไม่สามารถลบบัญชี Admin หลักได้");
      return;
    }
    if (!confirm(`ต้องการลบผู้ใช้ ${email} ใช่หรือไม่?`)) return;
    setDeleting(userId);
    await supabase.rpc("admin_delete_user", { p_user_id: userId });
    setDeleting(null);
    fetchUsers();
  };

  if (currentUserRole === null) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
      </div>
    );
  }

  const roleColor: Record<string, string> = {
    admin:   "bg-aviva-gold/20 text-aviva-gold",
    manager: "bg-blue-500/20 text-blue-400",
    user:    "bg-gray-500/20 text-gray-400",
  };
  const roleLabel: Record<string, string> = {
    admin:   "Admin", manager: "Manager", user: "User",
  };

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-aviva-text">จัดการผู้ใช้</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {loading ? "กำลังโหลด..." : `${users.length} บัญชี · Admin only`}
            </p>
          </div>
          <button
            onClick={() => { setShowModal(true); setError(""); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl"
          >
            <Plus size={14} /> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <GlassCard gold className="p-4 flex items-start gap-3">
          <ShieldCheck size={18} className="text-aviva-gold flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-aviva-gold">Admin Panel</p>
            <p className="text-xs text-aviva-secondary mt-0.5">
              เพิ่ม / ลบ ผู้ใช้งานระบบ AVIVA ONE ได้ที่หน้านี้ เฉพาะ Admin เท่านั้น
            </p>
          </div>
        </GlassCard>

        <SectionHeader title={`ผู้ใช้ทั้งหมด (${users.length})`} subtitle="แตะถังขยะเพื่อลบ" />
        <div className="space-y-3">
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            : users.map(u => (
              <GlassCard key={u.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-aviva-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-aviva-text">
                        {u.full_name || u.email}
                      </p>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        roleColor[u.role] ?? roleColor.user)}>
                        {roleLabel[u.role] ?? u.role}
                      </span>
                    </div>
                    <p className="text-xs text-aviva-secondary mt-0.5">{u.email}</p>
                    {u.department && (
                      <p className="text-[10px] text-aviva-secondary/60">{u.department}</p>
                    )}
                  </div>
                  {u.email !== "joyus818@gmail.com" && (
                    <button
                      onClick={() => handleDelete(u.id, u.email)}
                      disabled={deleting === u.id}
                      className="p-2 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </GlassCard>
            ))
          }
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เพิ่มผู้ใช้ใหม่</h2>
              <button onClick={() => setShowModal(false)}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 rounded-xl py-2 px-3">{error}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อ-นามสกุล *</label>
                <input type="text" value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="ชื่อจริง นามสกุล"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">Email *</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="relative">
                <label className="text-xs text-aviva-secondary mb-1 block">รหัสผ่าน *</label>
                <input type={showPass ? "text" : "password"} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 pr-10 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 bottom-3 text-aviva-secondary">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">สิทธิ์</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ROLES.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ฝ่าย</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button onClick={handleCreate}
              disabled={saving || !form.email || !form.password || !form.full_name}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังสร้าง..." : "สร้างบัญชีผู้ใช้"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
