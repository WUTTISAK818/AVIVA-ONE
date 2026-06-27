"use client";
import { useState, useEffect } from "react";
import { MessageCircle, CheckCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";

const OA_ID = process.env.NEXT_PUBLIC_LINE_OA_ID;
// ลิงก์แอดเพื่อน LINE OA (แตะบนมือถือเปิด LINE + เพิ่มเพื่อนทันที)
const addFriendUrl = OA_ID ? `https://line.me/R/ti/p/${OA_ID.startsWith("@") ? OA_ID : "@" + OA_ID}` : null;

export default function LineLinkCard() {
  const user = useCurrentUser();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null); // null = กำลังเช็ค

  // เช็คว่าผูก LINE ไว้แล้วหรือยัง
  useEffect(() => {
    if (!user?.email) return;
    supabase.from("line_links").select("linked_at").eq("user_email", user.email).not("linked_at", "is", null).maybeSingle()
      .then(({ data }) => setLinked(!!data));
  }, [user?.email]);

  async function getCode() {
    setBusy(true); setErr(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBusy(false); setErr("กรุณาเข้าสู่ระบบใหม่"); return; }
    const res = await fetch("/api/line/link-code", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.code) setCode(j.code);
    else setErr(j.error ?? "ขอรหัสไม่สำเร็จ");
  }

  // ผูกแล้ว — แสดงสถานะเขียว
  if (linked) {
    return (
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-aviva-text">ผูกบัญชี LINE แล้ว</p>
            <p className="text-xs text-aviva-secondary mt-0.5">คุณจะได้รับแจ้งเตือน (อนุมัติ/เคลม/กิจกรรม/หมุดหมายขาย) ทาง LINE</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3 mb-1">
        <MessageCircle size={18} className="text-green-400 flex-shrink-0" />
        <div className="text-sm font-medium text-aviva-text">ผูกบัญชี LINE เพื่อรับแจ้งเตือน</div>
      </div>
      <p className="text-xs text-aviva-secondary mb-3">รับแจ้งเตือนงานอนุมัติ/เคลม/กิจกรรม/หมุดหมายขาย เข้า LINE ส่วนตัวทันที</p>

      {!code ? (
        <button onClick={getCode} disabled={busy}
          className="text-xs font-bold px-4 py-2 rounded-full bg-green-500 text-white disabled:opacity-50">
          {busy ? "กำลังขอรหัส..." : "เริ่มผูกบัญชี LINE"}
        </button>
      ) : (
        <div className="space-y-3">
          {/* ขั้นที่ 1 — เพิ่มเพื่อน */}
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-aviva-text">เพิ่มเพื่อน LINE ของบริษัท {OA_ID && <span className="text-aviva-gold font-semibold">{OA_ID}</span>}</p>
              {addFriendUrl ? (
                <div className="mt-2 flex items-center gap-3">
                  <a href={addFriendUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-green-500 text-white">+ เพิ่มเพื่อน</a>
                  <div className="bg-white p-1.5 rounded-lg">
                    <QRCodeSVG value={addFriendUrl} size={72} />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-aviva-secondary/70 mt-1">ค้นหา LINE OA ของบริษัทเพื่อเพิ่มเพื่อน</p>
              )}
            </div>
          </div>
          {/* ขั้นที่ 2 — พิมพ์รหัส */}
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <div className="flex-1">
              <p className="text-xs text-aviva-text">พิมพ์รหัสนี้ในแชต LINE ของบริษัท:</p>
              <p className="text-2xl font-bold tracking-[0.3em] text-aviva-gold mt-1">{code}</p>
              <p className="text-[11px] text-aviva-secondary/70 mt-1">เมื่อผูกสำเร็จจะได้รับข้อความยืนยันใน LINE ✅</p>
            </div>
          </div>
        </div>
      )}
      {err && <div className="mt-2 text-xs text-red-400">{err}</div>}
    </GlassCard>
  );
}
