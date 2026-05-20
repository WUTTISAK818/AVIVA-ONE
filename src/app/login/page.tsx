"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-aviva-bg flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <div className="w-16 h-16 rounded-2xl bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center">
          <Sparkles size={28} className="text-aviva-gold" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-aviva-gold tracking-widest">AVIVA ONE</h1>
          <p className="text-xs text-aviva-secondary mt-1">Executive Operating System</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-aviva-secondary" />
            <input
              type="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-aviva-card border border-aviva-gold/10 rounded-2xl pl-11 pr-4 py-4 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/50 transition-colors"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-aviva-secondary" />
            <input
              type={showPass ? "text" : "password"}
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-aviva-card border border-aviva-gold/10 rounded-2xl pl-11 pr-12 py-4 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPass((p) => !p)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-aviva-secondary"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-xl py-2 px-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-aviva-gold text-aviva-bg font-bold py-4 rounded-2xl text-sm hover:bg-aviva-gold-soft transition-colors disabled:opacity-60"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>

      <p className="text-xs text-aviva-secondary/50 mt-8 text-center">
        AVIVA ONE © 2026 · Powered by AI
      </p>
    </div>
  );
}
