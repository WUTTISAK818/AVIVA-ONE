import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import QRCodeDisplay from "@/components/security/QRCodeDisplay";
import { Calendar, Car, Phone, ShieldCheck } from "lucide-react";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_TH: Record<string, string> = {
  pending: "รออนุมัติ",
  checked_in: "อยู่ในโครงการ",
  checked_out: "ออกแล้ว",
  expired: "หมดอายุ",
  blocked: "ถูกบล็อก",
};

export default async function VisitorPassPage({
  params,
}: {
  params: Promise<{ qr_token: string }>;
}) {
  const { qr_token } = await params;

  const { data: pass } = await supabaseAdmin
    .from("visitor_passes")
    .select(`
      id, qr_token, status, checked_in_at, checked_out_at, created_at,
      visitors:visitor_id (
        visitor_name, visitor_phone, license_plate, purpose, expected_at, expires_at,
        residents:host_resident_id ( full_name )
      )
    `)
    .eq("qr_token", qr_token)
    .maybeSingle();

  if (!pass) notFound();

  const v = (pass.visitors as unknown as {
    visitor_name: string;
    visitor_phone: string | null;
    license_plate: string | null;
    purpose: string | null;
    expected_at: string;
    expires_at: string;
    residents: { full_name: string } | null;
  } | null);

  return (
    <div className="min-h-screen bg-aviva-bg flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <header className="flex items-center justify-center gap-2">
          <ShieldCheck size={20} className="text-aviva-gold" />
          <span className="text-aviva-text font-bold">AVIVA Plus · บัตรผ่านชั่วคราว</span>
        </header>

        <div className="rounded-3xl bg-aviva-card border border-aviva-gold/20 p-6 space-y-4 text-center">
          <div className="flex justify-center">
            <QRCodeDisplay value={pass.qr_token} size={220} caption={`#${pass.qr_token.slice(0, 8)}`} />
          </div>
          <div>
            <p className="text-lg font-bold text-aviva-text">{v?.visitor_name ?? "—"}</p>
            <p className="text-xs text-aviva-secondary mt-1">
              เจ้าบ้าน: {v?.residents?.full_name ?? "—"}
            </p>
          </div>
          <span className="inline-block text-xs px-3 py-1 rounded-full bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/30">
            {STATUS_TH[pass.status] ?? pass.status}
          </span>
        </div>

        <div className="rounded-3xl bg-aviva-card border border-aviva-gold/20 p-5 space-y-3">
          <Row icon={Calendar} label="นัดมาถึง" value={fmt(v?.expected_at ?? null)} />
          <Row icon={Calendar} label="หมดอายุ" value={fmt(v?.expires_at ?? null)} />
          {v?.license_plate && <Row icon={Car} label="ทะเบียนรถ" value={v.license_plate} />}
          {v?.visitor_phone && <Row icon={Phone} label="เบอร์โทร" value={v.visitor_phone} />}
          {v?.purpose && <Row icon={Calendar} label="วัตถุประสงค์" value={v.purpose} />}
        </div>

        <p className="text-[11px] text-aviva-secondary/70 text-center px-3">
          แสดง QR นี้ที่ป้อม รปภ. ก่อนเข้าโครงการ · ห้ามแชร์ต่อกับผู้อื่น
        </p>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-aviva-secondary">
        <Icon size={14} className="text-aviva-gold/70" /> {label}
      </span>
      <span className="text-aviva-text font-medium text-right">{value}</span>
    </div>
  );
}
