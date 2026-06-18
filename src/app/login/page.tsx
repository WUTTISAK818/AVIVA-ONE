"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, Eye, EyeOff, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";

const DEMO_ACCOUNTS = [
  { email: "ceo.test@aviva.th",           label: "CEO",         dept: "ฝ่ายบริหาร",      color: "text-yellow-300   bg-yellow-500/10   border-yellow-500/20" },
  { email: "demo.admin@aviva.th",        label: "Admin",       dept: "ฝ่ายบริหาร",      color: "text-aviva-gold   bg-aviva-gold/10   border-aviva-gold/20" },
  { email: "demo.sales@aviva.th",         label: "นายหน้า",     dept: "ฝ่ายขาย",          color: "text-blue-400     bg-blue-500/10     border-blue-500/20" },
  { email: "demo.finance@aviva.th",       label: "การเงิน",     dept: "ฝ่ายการเงิน",      color: "text-green-400    bg-green-500/10    border-green-500/20" },
  { email: "demo.construction@aviva.th",  label: "ก่อสร้าง",    dept: "ฝ่ายก่อสร้าง",     color: "text-orange-400   bg-orange-500/10   border-orange-500/20" },
  { email: "demo.accounting@aviva.th",    label: "บัญชี",       dept: "ฝ่ายบัญชี",        color: "text-purple-400   bg-purple-500/10   border-purple-500/20" },
  { email: "demo.hr@aviva.th",            label: "บุคคล",       dept: "ฝ่ายบุคคล",        color: "text-pink-400     bg-pink-500/10     border-pink-500/20" },
  { email: "demo.marketing@aviva.th",     label: "การตลาด",     dept: "ฝ่ายการตลาด",      color: "text-cyan-400     bg-cyan-500/10     border-cyan-500/20" },
  { email: "demo.aftersales@aviva.th",    label: "หลังการขาย",  dept: "ฝ่ายหลังการขาย",   color: "text-teal-400     bg-teal-500/10     border-teal-500/20" },
];

const DEMO_PASSWORD = "Demo1234";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  // Restore email from localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("aviva_remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  async function handleLogin(e?: React.FormEvent, demoEmail?: string, demoPass?: string) {
    e?.preventDefault();
    setLoading(true);
    setError("");

    const loginEmail = demoEmail ?? email;

    // Handle localStorage for remember email
    if (rememberEmail) {
      localStorage.setItem("aviva_remembered_email", loginEmail);
    } else {
      localStorage.removeItem("aviva_remembered_email");
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: demoPass ?? password,
    });

    if (authError) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function loginAsDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    handleLogin(undefined, demoEmail, DEMO_PASSWORD);
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

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="rememberEmail"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              className="w-4 h-4 accent-aviva-gold cursor-pointer rounded"
            />
            <label htmlFor="rememberEmail" className="text-xs text-aviva-secondary cursor-pointer hover:text-aviva-text transition-colors">
              จดจำอีเมล
            </label>
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

      {/* Demo Accounts */}
      <div className="mt-6 w-full max-w-sm">
        <button
          onClick={() => setShowDemo((p) => !p)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-aviva-gold/20 bg-aviva-card/50 text-sm text-aviva-secondary hover:border-aviva-gold/40 transition-all"
        >
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-aviva-gold" />
            <span className="font-medium text-aviva-text">บัญชีทดสอบ</span>
            <span className="text-[10px] bg-aviva-gold/10 text-aviva-gold px-1.5 py-0.5 rounded-full border border-aviva-gold/20">
              Demo
            </span>
          </div>
          {showDemo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showDemo && (
          <div className="mt-2 bg-aviva-card border border-aviva-gold/10 rounded-2xl p-3 space-y-2">
            <p className="text-[10px] text-aviva-secondary/60 text-center pb-1">
              กดเพื่อเข้าสู่ระบบด้วยบัญชีทดสอบ
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => loginAsDemo(acc.email)}
                  disabled={loading}
                  className={`flex flex-col items-start p-2.5 rounded-xl border transition-all active:scale-[0.97] disabled:opacity-50 ${acc.color}`}
                >
                  <span className="text-xs font-bold">{acc.label}</span>
                  <span className="text-[10px] opacity-70 mt-0.5">{acc.dept}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 w-full max-w-sm text-center">
        <p className="text-[10px] text-aviva-secondary/30">
          ติดต่อผู้ดูแลระบบเพื่อขอรับบัญชีผู้ใช้งาน
        </p>
      </div>
    </div>
  );
}
