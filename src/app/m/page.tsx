"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ShieldCheck, Gift, Megaphone, Send, LogIn, CheckCircle2, Clock, XCircle, AlertTriangle,
} from "lucide-react";
import {
  memberPortal, memberSend, MEMBER_STATUS_LABEL, areaName, benefitCategoryLabel,
  type PortalData, type MemberStatus,
} from "@/lib/members";

const inputCls =
  "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

const STATUS_UI: Record<MemberStatus, { icon: typeof CheckCircle2; cls: string }> = {
  verified: { icon: CheckCircle2, cls: "text-green-600 bg-green-50 border-green-200" },
  pending: { icon: Clock, cls: "text-amber-600 bg-amber-50 border-amber-200" },
  rejected: { icon: XCircle, cls: "text-red-600 bg-red-50 border-red-200" },
  suspended: { icon: AlertTriangle, cls: "text-slate-600 bg-slate-100 border-slate-200" },
};

function PortalInner() {
  const sp = useSearchParams();
  const [code, setCode] = useState((sp.get("code") ?? "").trim());
  const [last4, setLast4] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const msgEndRef = useRef<HTMLDivElement | null>(null);

  async function login() {
    if (!code.trim() || last4.length !== 4) { setError("กรอกรหัสสมาชิก และเลขท้ายบัตร 4 หลัก"); return; }
    setLoading(true); setError(null);
    const res = await memberPortal(code, last4);
    setLoading(false);
    if (!res.ok) { setError(res.reason ?? "เข้าสู่ระบบไม่สำเร็จ"); setData(null); return; }
    setData(res);
  }

  async function refresh() {
    const res = await memberPortal(code, last4);
    if (res.ok) setData(res);
  }

  async function send() {
    if (!msg.trim()) return;
    setSending(true);
    const res = await memberSend(code, last4, msg.trim());
    setSending(false);
    if (res.ok) { setMsg(""); await refresh(); }
    else setError(res.reason ?? "ส่งข้อความไม่สำเร็จ");
  }

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.messages?.length]);

  // ---------- ยังไม่ได้เข้าสู่ระบบ ----------
  if (!data?.ok) {
    return (
      <Shell>
        <div className="flex items-center gap-2 mb-1">
          <LogIn size={22} className="text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">เข้าสู่ระบบสมาชิก</h1>
        </div>
        <p className="text-sm text-slate-500 mb-4">ทีมโคราชชาติพัฒนา (CPN)</p>

        <label className="text-sm font-medium text-slate-700 mb-1 block">รหัสสมาชิก</label>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          className={`${inputCls} font-mono`} placeholder="เช่น CPN1-AB12CD" />

        <label className="text-sm font-medium text-slate-700 mb-1 block mt-3">เลขท้ายบัตรประชาชน 4 หลัก</label>
        <input value={last4} inputMode="numeric"
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className={`${inputCls} font-mono`} placeholder="1234" />

        {error && <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {error}</p>}

        <button onClick={login} disabled={loading}
          className="mt-4 w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={18} className="animate-spin" /> กำลังเข้าสู่ระบบ...</> : "เข้าสู่ระบบ"}
        </button>
        <div className="mt-6 text-center">
          <Link href="/join" className="text-sm text-blue-600 font-medium">ยังไม่เป็นสมาชิก? สมัครที่นี่</Link>
        </div>
      </Shell>
    );
  }

  // ---------- เข้าสู่ระบบแล้ว ----------
  const m = data.member!;
  const st = STATUS_UI[m.status];
  const StIcon = st.icon;

  return (
    <Shell>
      {/* การ์ดสมาชิก */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-blue-100">สมาชิก ทีมโคราชชาติพัฒนา</p>
            <p className="text-lg font-bold leading-tight mt-0.5">{m.full_name}</p>
          </div>
          <ShieldCheck size={28} className="text-blue-200" />
        </div>
        <p className="text-2xl font-extrabold font-mono tracking-wide mt-3">{m.member_code}</p>
        <div className="flex items-center gap-2 mt-2 text-[12px] text-blue-100">
          <span>{areaName(m.area_code)}</span>
          {m.community ? <span>· {m.community}</span> : null}
        </div>
      </div>

      {/* สถานะ + trust */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className={`rounded-xl border p-3 flex items-center gap-2 ${st.cls}`}>
          <StIcon size={18} />
          <div>
            <p className="text-[11px] opacity-70">สถานะ</p>
            <p className="text-sm font-bold">{MEMBER_STATUS_LABEL[m.status]}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">ระดับความน่าเชื่อถือ</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${m.trust_score}%` }} />
            </div>
            <span className="text-sm font-bold text-slate-700">{m.trust_score}</span>
          </div>
        </div>
      </div>
      {m.status === "pending" && (
        <p className="mt-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
          อยู่ระหว่างการยืนยันตัวตนโดยเจ้าหน้าที่ เมื่อยืนยันแล้วจะได้รับสิทธิประโยชน์เต็มรูปแบบ
        </p>
      )}

      {/* ประกาศ */}
      <Section icon={Megaphone} title="ประกาศจากทีม">
        {(data.announcements ?? []).length === 0 ? (
          <Empty text="ยังไม่มีประกาศ" />
        ) : (
          <div className="space-y-2">
            {data.announcements!.map((a, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                <p className="text-[13px] text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                <p className="text-[11px] text-slate-400 mt-1.5">{new Date(a.at).toLocaleDateString("th-TH")}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* สิทธิประโยชน์ */}
      <Section icon={Gift} title="สิทธิประโยชน์">
        {(data.benefits ?? []).length === 0 ? (
          <Empty text="ยังไม่มีสิทธิประโยชน์ในพื้นที่ของคุณ" />
        ) : (
          <div className="space-y-2">
            {data.benefits!.map((b, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 flex items-start gap-2">
                <Gift size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{b.title}</p>
                  <span className="inline-block text-[11px] bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 mt-1">
                    {benefitCategoryLabel(b.category)}
                  </span>
                  {b.description && <p className="text-[13px] text-slate-600 mt-1">{b.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {m.status !== "verified" && (data.benefits ?? []).length > 0 && (
          <p className="text-[11px] text-slate-400 mt-2">* ยืนยันตัวตนแล้วจึงจะใช้สิทธิได้</p>
        )}
      </Section>

      {/* แชทกับแอดมิน */}
      <Section icon={Send} title="ติดต่อทีมงาน">
        <div className="border border-slate-200 rounded-xl p-3 max-h-64 overflow-y-auto space-y-2 bg-slate-50">
          {(data.messages ?? []).length === 0 ? (
            <p className="text-[13px] text-slate-400 text-center py-3">เริ่มสนทนากับทีมงานได้เลย</p>
          ) : (
            data.messages!.map((x, i) => (
              <div key={i} className={`flex ${x.sender === "member" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] ${
                  x.sender === "member" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
                  <p className="whitespace-pre-wrap">{x.body}</p>
                  <p className={`text-[10px] mt-0.5 ${x.sender === "member" ? "text-blue-100" : "text-slate-400"}`}>
                    {new Date(x.at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={msgEndRef} />
        </div>
        <div className="flex gap-2 mt-2">
          <input value={msg} onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            className={inputCls} placeholder="พิมพ์ข้อความถึงทีมงาน..." />
          <button onClick={send} disabled={sending || !msg.trim()}
            className="shrink-0 bg-blue-600 text-white px-4 rounded-xl disabled:opacity-50 flex items-center">
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </Section>

      <button onClick={() => { setData(null); setLast4(""); }}
        className="mt-5 w-full text-sm text-slate-500 font-medium py-2">ออกจากระบบ</button>
    </Shell>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Gift; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={16} className="text-blue-600" />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-[13px] text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">{text}</p>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/winvote-logo.png" alt="WinVote" className="h-10 w-10 rounded-lg" />
          <span className="text-lg font-bold text-slate-800">WinVote</span>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">{children}</div>
        <p className="text-center text-[11px] text-slate-400 mt-4">© ทีมโคราชชาติพัฒนา · ระบบสมาชิก</p>
      </div>
    </div>
  );
}

export default function MemberPortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <PortalInner />
    </Suspense>
  );
}
