"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/community/announcements");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-aviva-bg text-aviva-text">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold text-center mb-2 text-aviva-gold">AVIVA Plus</h1>
        <p className="text-center text-aviva-secondary/70 mb-8">ระบบบริการลูกบ้าน AVIVA Private</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            required
            placeholder="อีเมล"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-aviva-gold/20 focus:border-aviva-gold/60 outline-none"
          />
          <input
            type="password"
            required
            placeholder="รหัสผ่าน"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-aviva-gold/20 focus:border-aviva-gold/60 outline-none"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-aviva-gold text-aviva-bg font-medium disabled:opacity-50 active:scale-95 transition"
          >
            {loading ? "กำลังเข้าระบบ..." : "เข้าระบบ"}
          </button>
        </form>

        <p className="text-center text-sm text-aviva-secondary/60 mt-6">
          ยังไม่มีบัญชี?{" "}
          <Link href="/signup" className="text-aviva-gold hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </main>
  );
}
