"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldAlert, LogIn, LogOut, KeyRound, AlertTriangle, Smartphone, Monitor } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";

interface LogRow { id: string; email: string | null; action: string; ip: string | null; user_agent: string | null; at: string; }

const ACTION: Record<string, { label: string; color: string; Icon: typeof LogIn }> = {
  login: { label: "เข้าระบบ", color: "#15803D", Icon: LogIn },
  logout: { label: "ออกจากระบบ", color: "#64748B", Icon: LogOut },
  password_change: { label: "เปลี่ยนรหัส", color: "#2563EB", Icon: KeyRound },
  session_kick: { label: "ถูกเตะออก (ล็อกอินซ้อน)", color: "#DC2626", Icon: ShieldAlert },
  export: { label: "ส่งออกข้อมูล", color: "#EA580C", Icon: AlertTriangle },
  reveal: { label: "เปิดข้อมูลอ่อนไหว", color: "#EA580C", Icon: AlertTriangle },
  view: { label: "เปิดดู", color: "#64748B", Icon: Monitor },
};

function device(ua: string | null): { label: string; mobile: boolean } {
  const s = ua || "";
  const mobile = /Mobile|Android|iPhone|iPad/i.test(s);
  let b = "อื่นๆ";
  if (/CriOS|Chrome/i.test(s)) b = "Chrome"; else if (/Safari/i.test(s)) b = "Safari";
  else if (/Firefox/i.test(s)) b = "Firefox"; else if (/Edg/i.test(s)) b = "Edge";
  let os = "";
  if (/Android/i.test(s)) os = "Android"; else if (/iPhone|iPad|iOS/i.test(s)) os = "iOS";
  else if (/Windows/i.test(s)) os = "Windows"; else if (/Mac/i.test(s)) os = "Mac";
  return { label: [os, b].filter(Boolean).join(" · ") || "ไม่ทราบ", mobile };
}

export default function AuditPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (user === null) return;
    if (!user.isAdmin) { setDenied(true); setLoading(false); return; }
    supabase.schema("winvote").from("access_log").select("*").order("at", { ascending: false }).limit(300)
      .then(({ data }) => { setRows((data ?? []) as LogRow[]); setLoading(false); });
  }, [user]);

  // บัญชีที่เข้าจากหลาย IP (สัญญาณแชร์รหัส)
  const multiIp = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) {
      if (r.action !== "login" || !r.email || !r.ip || r.ip === "unknown") continue;
      if (!m.has(r.email)) m.set(r.email, new Set());
      m.get(r.email)!.add(r.ip);
    }
    return [...m.entries()].filter(([, s]) => s.size > 1).map(([email, s]) => ({ email, ips: [...s] }));
  }, [rows]);

  if (denied) return (
    <div className="min-h-screen bg-aviva-bg flex flex-col items-center justify-center gap-3 px-6">
      <ShieldAlert size={40} className="text-red-500" />
      <p className="text-sm text-aviva-secondary">เฉพาะผู้ดูแลระบบเท่านั้น</p>
      <button onClick={() => router.replace("/winvote")} className="text-xs text-aviva-gold underline">กลับหน้าหลัก</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-30 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10">
        <div className="max-w-lg mx-auto px-4 pt-12 pb-3 flex items-center gap-2">
          <button onClick={() => router.push("/winvote")} className="p-1.5 rounded-lg text-aviva-secondary hover:bg-aviva-card"><ChevronLeft size={18} /></button>
          <h1 className="text-lg font-bold text-aviva-text">ประวัติการเข้าใช้ระบบ</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {loading ? <div className="h-40 rounded-2xl bg-aviva-card/60 animate-pulse" /> : (
          <>
            {multiIp.length > 0 && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-3.5">
                <p className="text-sm font-bold text-red-600 flex items-center gap-1.5 mb-2"><AlertTriangle size={15} /> บัญชีที่เข้าจากหลาย IP (อาจมีการแชร์รหัส)</p>
                <div className="space-y-1">
                  {multiIp.map((m) => (
                    <div key={m.email} className="text-xs"><span className="font-semibold text-aviva-text">{m.email}</span> <span className="text-aviva-secondary">— {m.ips.length} IP: {m.ips.join(", ")}</span></div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-aviva-secondary">{rows.length} รายการล่าสุด (บันทึกอัตโนมัติทุกการเข้า/ออก)</p>
            <div className="space-y-1.5">
              {rows.map((r) => {
                const a = ACTION[r.action] ?? { label: r.action, color: "#64748B", Icon: Monitor };
                const dev = device(r.user_agent);
                const t = new Date(r.at).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={r.id} className="flex items-center gap-2.5 bg-aviva-card rounded-xl p-2.5">
                    <a.Icon size={16} style={{ color: a.color }} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-aviva-text truncate">{r.email || "-"}</p>
                      <p className="text-[10px] text-aviva-secondary flex items-center gap-1">
                        {dev.mobile ? <Smartphone size={10} /> : <Monitor size={10} />}{dev.label} · IP {r.ip || "-"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold" style={{ color: a.color }}>{a.label}</p>
                      <p className="text-[10px] text-aviva-secondary">{t}</p>
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && <div className="rounded-2xl bg-aviva-card p-4 text-center"><p className="text-xs text-aviva-secondary">ยังไม่มีบันทึก</p></div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
