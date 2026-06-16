"use client";
import { useState, useEffect } from "react";
import { Users, Plus, X, Eye, EyeOff, User, Shield, Save, ArrowLeft, Trash2, Check, RefreshCw, KeyRound } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const ROLES = [
  { value: "admin",           label: "ผู้ดูแลระบบ (Admin)" },
  { value: "ceo",             label: "CEO / ประธานเจ้าหน้าที่บริหาร" },
  { value: "coo",             label: "COO / ประธานเจ้าหน้าที่ปฏิบัติการ" },
  { value: "director",        label: "ผู้อำนวยการ (Director)" },
  { value: "manager",         label: "ผู้จัดการ" },
  { value: "project_manager", label: "ผู้จัดการโครงการ" },
  { value: "sales",           label: "ฝ่ายขาย" },
  { value: "engineer",        label: "วิศวกร / ก่อสร้าง" },
  { value: "finance",         label: "ฝ่ายการเงิน" },
  { value: "accountant",      label: "ฝ่ายบัญชี" },
  { value: "hr",              label: "ฝ่ายบุคคล" },
  { value: "marketing",       label: "ฝ่ายการตลาด" },
  { value: "after_sales",     label: "ฝ่ายหลังการขาย" },
  { value: "user",            label: "พนักงานทั่วไป" },
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
  const [listError, setListError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetOk, setResetOk] = useState(false);
  const [confirmPw, setConfirmPw] = useState("");        // ยืนยันรหัสผ่านตอนสร้างบัญชี
  const [confirmNewPw, setConfirmNewPw] = useState("");  // ยืนยันรหัสผ่านใหม่ตอนรีเซ็ต

  // Admin/CEO/Director เท่านั้นที่เพิ่ม/แก้ไข/ลบ
  const canManage = ["admin", "ceo", "coo", "director"].includes(currentUser?.role ?? "");

  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.isManager) { router.replace("/dashboard"); return; }
    fetchUsers();
  }, [currentUser, router]);

  async function fetchUsers(delayMs = 0) {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
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
        setUsers([...data.users].sort(
          (a: UserRecord, b: UserRecord) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
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
    setError(""); setSavedOk(false); setConfirmDelete(false);
    setShowPassword(false); setConfirmPw(""); setConfirmNewPw("");
    setShowModal(true);
  }

  function openEdit(u: UserRecord) {
    setEditUser(u);
    setForm({ email: u.email, password: "", full_name: u.full_name, role: u.role, department: u.department || "ฝ่ายบริหาร" });
    setError(""); setSavedOk(false); setConfirmDelete(false);
    setNewPassword(""); setShowNewPassword(false); setResetOk(false);
    setConfirmPw(""); setConfirmNewPw("");
    setShowModal(true);
  }

  async function submit() {
    setSaving(true); setError(""); setSavedOk(false);
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
        setShowModal(false);
        fetchUsers();
      } else {
        if (!form.email || !form.password) { setError("กรุณากรอก Email และรหัสผ่าน"); setSaving(false); return; }
        if (form.password.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); setSaving(false); return; }
        if (form.password !== confirmPw) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); setSaving(false); return; }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSavedOk(true);
        // รอ 1.5 วิ ให้ Supabase Auth sync ก่อน refresh รายการ
        setShowModal(false);
        fetchUsers(1500);
      }
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
      const msg = /already.*registered|already.*exist|duplicate/i.test(raw)
        ? "อีเมลนี้ถูกใช้ไปแล้ว — ผู้ใช้มีอยู่ในระบบแล้ว (ดูที่ด้านบนสุดของรายการ)"
        : raw;
      setError(msg);
    }
    setSaving(false);
  }

  async function resetPassword() {
    if (!editUser || newPassword.length < 6) { setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (newPassword !== confirmNewPw) { setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"); return; }
    setResetting(true); setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setResetting(false); return; }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editUser.id, password: newPassword }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNewPassword(""); setConfirmNewPw(""); setResetOk(true);
      setTimeout(() => setResetOk(false), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    }
    setResetting(false);
  }

  async function deleteUser() {
    if (!editUser) return;
    setSaving(true); setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editUser.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShowModal(false);
      fetchUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "ลบบัญชีไม่สำเร็จ");
    }
    setSaving(false);
  }

  const roleLabel = (r: string) => ROLES.find(x => x.value === r)?.label?.replace(/ \(.*\)/, "") ?? r;

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
          <div className="flex items-center gap-2">
            <button onClick={() => fetchUsers()} disabled={loading}
              className="p-1.5 rounded-lg text-aviva-secondary hover:text-aviva-text transition-colors disabled:opacity-40">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            {canManage && (
              <button onClick={openAdd}
                className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-semibold px-3 py-2 rounded-lg">
                <Plus size={14} />เพิ่มผู้ใช้
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {savedOk && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
            <Check size={16} className="text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-400 font-medium">สร้างบัญชีผู้ใช้สำเร็จ — กำลังโหลดรายการใหม่...</p>
          </div>
        )}
        {!loading && !listError && users.length > 0 && (
          <p className="text-xs text-aviva-secondary px-1">ทั้งหมด {users.length} ผู้ใช้ (เรียงจากที่เพิ่มล่าสุด)</p>
        )}
        {listError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs text-red-400">{listError}</p>
            <button onClick={() => fetchUsers()} className="text-xs text-aviva-gold underline">ลองใหม่</button>
          </div>
        )}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin mx-auto mb-3" />
            <p className="text-aviva-secondary text-sm">กำลังโหลด...</p>
          </div>
        ) : users.length === 0 && !listError ? (
          <p className="text-center text-aviva-secondary text-sm py-8">ไม่พบข้อมูลผู้ใช้</p>
        ) : (
          users.map(u => (
            <GlassCard key={u.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                  {["admin", "ceo", "coo"].includes(u.role)
                    ? <Shield size={14} className="text-aviva-gold" />
                    : <User size={14} className="text-aviva-secondary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aviva-text truncate">{u.full_name || "(ไม่มีชื่อ)"}</p>
                  <p className="text-xs text-aviva-secondary truncate">{u.email}</p>
                  {u.last_sign_in_at && (
                    <p className="text-[10px] text-aviva-secondary/50">
                      เข้าล่าสุด: {new Date(u.last_sign_in_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 block">
                    {roleLabel(u.role)}
                  </span>
                  <p className="text-[10px] text-aviva-secondary">{u.department}</p>
                </div>
              </div>
              {canManage && (
                <button onClick={() => openEdit(u)}
                  className="mt-3 w-full text-xs text-aviva-secondary border border-aviva-gold/10 rounded-lg py-1.5 hover:border-aviva-gold/30 transition-all">
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
              <h2 className="font-bold text-aviva-text">{editUser ? "แก้ไขข้อมูลผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              {!editUser && (
                <>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">Email</label>
                    <input value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      type="email" placeholder="user@example.com"
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">รหัสผ่านเริ่มต้น</label>
                    <div className="relative">
                      <input value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        type={showPassword ? "text" : "password"}
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50 pr-10" />
                      <button type="button" onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aviva-secondary">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">ยืนยันรหัสผ่าน (กรอกอีกครั้ง)</label>
                    <input value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      placeholder="กรอกรหัสผ่านซ้ำให้ตรงกัน"
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
                    {confirmPw.length > 0 && form.password !== confirmPw && (
                      <p className="text-[11px] text-red-400 mt-1">รหัสผ่านยังไม่ตรงกัน</p>
                    )}
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อ-นามสกุล</label>
                <input value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">บทบาท</label>
                  <select value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ฝ่าย</label>
                  <select value={form.department}
                    onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <span className="text-red-400 text-lg leading-none mt-0.5">⚠</span>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
              <button onClick={submit} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-semibold py-3 rounded-xl text-sm disabled:opacity-60 transition-opacity">
                <Save size={14} />
                {saving ? "กำลังบันทึก..." : editUser ? "บันทึกการแก้ไข" : "สร้างบัญชีผู้ใช้"}
              </button>

              {editUser && (
                <div className="pt-3 mt-1 border-t border-aviva-gold/10 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <KeyRound size={13} className="text-aviva-secondary" />
                    <label className="text-xs text-aviva-secondary">รีเซ็ตรหัสผ่าน</label>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <input value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        type={showNewPassword ? "text" : "password"}
                        placeholder="รหัสใหม่ อย่างน้อย 6 ตัวอักษร"
                        className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50 pr-10" />
                      <button type="button" onClick={() => setShowNewPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aviva-secondary">
                        {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input value={confirmNewPw}
                        onChange={e => setConfirmNewPw(e.target.value)}
                        type={showNewPassword ? "text" : "password"}
                        placeholder="ยืนยันรหัสใหม่ (กรอกอีกครั้ง)"
                        className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
                      <button onClick={resetPassword} disabled={resetting || newPassword.length < 6 || newPassword !== confirmNewPw}
                        className="flex-shrink-0 text-xs font-semibold text-aviva-gold border border-aviva-gold/30 rounded-lg px-3 disabled:opacity-40 hover:bg-aviva-gold/5 transition-all">
                        {resetting ? "กำลัง..." : "ตั้งใหม่"}
                      </button>
                    </div>
                    {confirmNewPw.length > 0 && newPassword !== confirmNewPw && (
                      <p className="text-[11px] text-red-400">รหัสผ่านใหม่ยังไม่ตรงกัน</p>
                    )}
                  </div>
                  {resetOk && <p className="text-xs text-green-400">✓ ตั้งรหัสผ่านใหม่เรียบร้อย</p>}
                </div>
              )}

              {editUser && editUser.id !== currentUser?.id && (
                <div className="pt-3 mt-1 border-t border-red-500/10">
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center justify-center gap-2 text-xs text-red-400 border border-red-500/20 rounded-xl py-2.5 hover:bg-red-500/5 transition-all">
                      <Trash2 size={13} /> ลบบัญชีผู้ใช้นี้
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-red-400 text-center leading-relaxed">
                        ⚠️ ยืนยันลบ &ldquo;{editUser.full_name || editUser.email}&rdquo;?<br />ลบแล้วกู้คืนไม่ได้
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDelete(false)} disabled={saving}
                          className="flex-1 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl py-2.5">
                          ยกเลิก
                        </button>
                        <button onClick={deleteUser} disabled={saving}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-red-500 rounded-xl py-2.5 disabled:opacity-60">
                          <Trash2 size={13} /> {saving ? "กำลังลบ..." : "ยืนยันลบ"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
