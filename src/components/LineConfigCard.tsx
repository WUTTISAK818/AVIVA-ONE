"use client";
import { useState, useEffect } from "react";
import { MessageCircle, CheckCircle, AlertTriangle, Copy, Check } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import clsx from "clsx";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const WEBHOOK_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/line-webhook` : "";

// การ์ดตั้งค่า LINE OA (เฉพาะผู้บริหาร) — วาง Channel Access Token + คัดลอก Webhook URL
export default function LineConfigCard() {
  const user = useCurrentUser();
  const [status, setStatus] = useState<{ configured: boolean; suffix: string | null } | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const callApi = async (body: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ key: "line_channel_access_token", ...body }),
    });
    return res.json();
  };

  useEffect(() => {
    if (!user?.isManager) return;
    callApi({ action: "status" }).then(s => setStatus({ configured: !!s.configured, suffix: s.suffix ?? null })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user?.isManager) return null;

  const save = async () => {
    const v = input.trim();
    if (!v) return;
    setBusy(true); setResult(null);
    const setRes = await callApi({ action: "set", value: v });
    if (setRes.error) { setResult({ ok: false, msg: setRes.error }); setBusy(false); return; }
    const testRes = await callApi({ action: "test" });
    if (testRes.ok) {
      setResult({ ok: true, msg: `เชื่อมต่อ LINE สำเร็จ${testRes.info ? ` — ${testRes.info}` : ""} 🎉` });
      setStatus({ configured: true, suffix: v.slice(-6) });
      setInput("");
    } else {
      setResult({ ok: false, msg: testRes.error ?? "ทดสอบไม่ผ่าน — ตรวจสอบ token อีกครั้ง" });
    }
    setBusy(false);
  };

  const copyUrl = () => {
    navigator.clipboard?.writeText(WEBHOOK_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <GlassCard className="p-4 space-y-3 border border-green-500/25">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-aviva-text flex items-center gap-2">
          <MessageCircle size={15} className="text-green-400" /> ตั้งค่า LINE OA (ผู้บริหาร)
        </p>
        {status && (
          status.configured ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/30 flex items-center gap-1">
              <CheckCircle size={10} /> ตั้งแล้ว{status.suffix ? ` (…${status.suffix})` : ""}
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 flex items-center gap-1">
              <AlertTriangle size={10} /> ยังไม่ได้ตั้ง
            </span>
          )
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="วาง Channel Access Token"
          autoComplete="off"
          className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-green-500/60"
        />
        <button onClick={save} disabled={busy || !input.trim()}
          className="bg-green-500 text-aviva-bg font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-50 flex-shrink-0">
          {busy ? "กำลังทดสอบ..." : "บันทึก"}
        </button>
      </div>
      {result && (
        <p className={clsx("text-xs flex items-center gap-1.5", result.ok ? "text-green-400" : "text-red-400")}>
          {result.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />} {result.msg}
        </p>
      )}

      {WEBHOOK_URL && (
        <div className="bg-aviva-bg/50 rounded-xl p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-aviva-secondary/90">Webhook URL (วางใน LINE Developers → Messaging API):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[10px] text-green-300 break-all bg-aviva-bg rounded-lg px-2 py-1.5 border border-aviva-gold/10">{WEBHOOK_URL}</code>
            <button onClick={copyUrl} className="flex-shrink-0 p-2 rounded-lg border border-aviva-gold/20 text-aviva-secondary">
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      )}

      <div className="text-[11px] text-aviva-secondary leading-relaxed space-y-1">
        <p className="font-semibold text-aviva-secondary/90">วิธีตั้งค่า (ทำครั้งเดียว):</p>
        <p>1. LINE Developers Console → เลือก channel ของ OA → แท็บ Messaging API</p>
        <p>2. คัดลอก <span className="text-green-300">Channel Access Token (long-lived)</span> มาวางช่องด้านบน แล้วกดบันทึก</p>
        <p>3. ช่อง Webhook URL → วาง URL ด้านบน → กด Verify แล้วเปิด <span className="text-green-300">Use webhook</span></p>
        <p>4. เปิด Allow bot to join group chats (ถ้าจะส่งเข้ากลุ่ม)</p>
      </div>
    </GlassCard>
  );
}
