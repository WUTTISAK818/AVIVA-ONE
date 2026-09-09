"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAccess } from "@/lib/security";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.replace("/login"); });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 8) { setError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"); return; }
    if (pw !== pw2) { setError("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
    setLoading(true);
    const { error: e1 } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } });
    if (e1) { setError("เปลี่ยนรหัสไม่สำเร็จ: " + e1.message); setLoading(false); return; }
    await logAccess("password_change");
    router.push("/winvote");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-aviva-bg flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center">
          <ShieldCheck size={26} className="text-aviva-gold" />
        </div>
        <h1 className="text-lg font-bold text-aviva-text">ตั้งรหัสผ่านส่วนตัว</h1>
        <p className="text-xs text-aviva-secondary text-center max-w-xs">เพื่อความปลอดภัย กรุณาเปลี่ยนจากรหัสเริ่มต้นเป็นรหัสของคุณเอง (อย่าแชร์ให้ผู้อื่น)</p>
      </div>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="relative">
          <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-aviva-secondary" />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" required
            className="w-full bg-aviva-card border border-aviva-gold/10 rounded-2xl pl-11 pr-4 py-4 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/50" />
        </div>
        <div className="relative">
          <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-aviva-secondary" />
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="ยืนยันรหัสผ่านใหม่" required
            className="w-full bg-aviva-card border border-aviva-gold/10 rounded-2xl pl-11 pr-4 py-4 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/50" />
        </div>
        {error && <p className="text-red-500 text-xs text-center bg-red-400/10 rounded-xl py-2 px-3">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-aviva-gold text-aviva-bg font-bold py-4 rounded-2xl text-sm hover:bg-aviva-gold-soft transition-colors disabled:opacity-60">
          {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
        </button>
      </form>
    </div>
  );
}
