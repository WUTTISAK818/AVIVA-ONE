"use client";
// รายละเอียดทั้งหมดของแปลงหนึ่งแปลง — ใช้ในผังโครงการหน้า CRM
//
// Pom สั่ง 14 ต.ค. 69: "ผังโครงการแต่ละแปลง กดเข้าไปแล้วให้แสดงรายละเอียดทั้งหมดที่เกี่ยวข้อง"
//
// ที่มาของความต้องการ: วันก่อนหน้า ตรวจนัดโอน 2 แปลงแล้วพบว่าข้อมูลขาดหลายช่อง
// (แปลง 15 ไม่มีแม้แต่ราคาขายและวันนัดโอน) แต่หน้าผังเดิมแสดงแค่ชื่อ/เบอร์/สถานะ
// จึงมองไม่เห็นว่าขาดอะไร ต้องไปไล่เปิดหลายหน้าถึงจะรู้
//
// แผงนี้ดึงของที่กระจายอยู่ 4 ตารางมารวมในที่เดียว: leads · houses ·
// customer_installments · transfer_tasks แล้วชี้ให้เห็นเลยว่าช่องไหนยังว่าง

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { contactLine } from "@/lib/contact-channel";

interface PlotLead {
  id: string;
  customer_name: string;
  phone: string;
  status: string;
  source?: string | null;
  assigned_to?: string | null;
  contact_channel?: string | null;
  contact_handle?: string | null;
  budget?: number | null;
  contract_price?: number | null;
  booking_deposit?: number | null;
  financing_type?: string | null;
  visit_date?: string | null;
  booking_date?: string | null;
  contract_appointment_date?: string | null;
  contract_signed_date?: string | null;
  loan_approved_date?: string | null;
  delivery_date?: string | null;
  transfer_appointment_date?: string | null;
  transfer_date?: string | null;
  notes?: string | null;
}

interface HouseRow {
  id: string;
  plot_code?: string | null;
  house_model?: string | null;
  land_size?: number | null;
  price?: number | null;
  status?: string | null;
  construction_status?: string | null;
  progress?: number | null;
  contractor?: string | null;
  planned_completion_date?: string | null;
  updated_at?: string | null;
}

interface Installment { id: string; name: string | null; amount: number | null; due_date: string | null; paid_date: string | null; status: string | null }
interface TransferTask { item_key: string; done: boolean }

const CONSTRUCTION_TH: Record<string, string> = {
  not_started: "ยังไม่เริ่ม", in_progress: "กำลังก่อสร้าง",
  completed: "ก่อสร้างเสร็จ", on_hold: "หยุดชั่วคราว",
};

const baht = (v: number | null | undefined) =>
  v == null ? null : `฿${Number(v).toLocaleString("th-TH")}`;

const thDate = (v: string | null | undefined) =>
  !v ? null : new Date(v).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

function Row({ label, value, warn }: { label: string; value: string | null; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[11px] text-aviva-secondary flex-shrink-0">{label}</span>
      <span className={`text-[11px] text-right ${value ? "text-aviva-text" : warn ? "text-amber-400 font-semibold" : "text-aviva-secondary/50"}`}>
        {value ?? (warn ? "ยังไม่ได้กรอก" : "—")}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-aviva-bg rounded-xl p-3">
      <p className="text-[10px] font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-1.5">{title}</p>
      {children}
    </div>
  );
}

export default function PlotDetailPanel({ projectId, plotNumber, lead }: {
  projectId: string; plotNumber: number; lead: PlotLead | null;
}) {
  // เก็บผลโหลดเป็นก้อนเดียวพร้อม key ของแปลง แล้ว derive สถานะ "กำลังโหลด" จาก key
  // (แทนการ setLoading(true) ซ้อนในตัว effect ซึ่งทำให้ render ซ้ำโดยไม่จำเป็น)
  const key = `${projectId}:${plotNumber}:${lead?.id ?? ""}`;
  const [data, setData] = useState<{ key: string; house: HouseRow | null; insts: Installment[]; tasks: TransferTask[] } | null>(null);
  const loading = data?.key !== key;
  const house = data?.house ?? null;
  const insts = data?.insts ?? [];
  const tasks = data?.tasks ?? [];

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: h } = await supabase.from("houses")
        .select("id, plot_code, house_model, land_size, price, status, construction_status, progress, contractor, planned_completion_date, updated_at")
        .eq("project_id", projectId).eq("plot_number", plotNumber).maybeSingle();

      const houseRow = (h as HouseRow | null) ?? null;

      const ci = houseRow?.id
        ? (await supabase.from("customer_installments")
            .select("id, name, amount, due_date, paid_date, status")
            .eq("house_id", houseRow.id).order("due_date")).data
        : null;

      const tt = lead?.id
        ? (await supabase.from("transfer_tasks")
            .select("item_key, done").eq("lead_id", lead.id)).data
        : null;

      if (!active) return;
      setData({
        key,
        house: houseRow,
        insts: (ci as Installment[] | null) ?? [],
        tasks: (tt as TransferTask[] | null) ?? [],
      });
    })();
    return () => { active = false; };
  }, [key, projectId, plotNumber, lead?.id]);

  // ช่องที่ควรมีแต่ยังว่าง — แสดงรวมไว้ให้เห็นในที่เดียว ไม่ต้องไล่อ่านทีละบรรทัด
  const missing: string[] = [];
  if (lead) {
    if (lead.contract_price == null) missing.push("ราคาขายที่ตกลง");
    if (lead.booking_deposit == null) missing.push("เงินจองที่รับจริง");
    if (!lead.contract_signed_date) missing.push("วันเซ็นสัญญา");
    if (!lead.loan_approved_date && lead.financing_type !== "เงินสด") missing.push("วันอนุมัติสินเชื่อ");
    if (!lead.transfer_appointment_date && !lead.transfer_date) missing.push("วันนัดโอนกรรมสิทธิ์");
    if (!lead.assigned_to?.trim()) missing.push("พนักงานขายที่ดูแล");
    if (insts.length === 0) missing.push("ตารางงวดชำระ");
    if (tasks.length === 0) missing.push("เช็คลิสต์โอนกรรมสิทธิ์");
  }

  // ราคาขายต่ำผิดปกติ = เกือบแน่นอนว่าใส่ยอดเงินจองผิดช่อง (เจอจริงที่แปลง 16: ฿50,000)
  const priceLooksWrong =
    lead?.contract_price != null && Number(lead.contract_price) > 0 && Number(lead.contract_price) < 100000;

  const paidTotal = insts.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const instTotal = insts.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const doneTasks = tasks.filter(t => t.done).length;

  if (loading) return <div className="h-40 rounded-xl bg-aviva-bg/50 animate-pulse" />;

  return (
    <div className="space-y-2">
      {lead && (
        <Section title="ผู้ซื้อ">
          <Row label="ชื่อลูกค้า" value={lead.customer_name} />
          <Row label="ติดต่อ" value={contactLine(lead)} />
          <Row label="พนักงานที่ดูแล" value={lead.assigned_to?.trim() || null} warn />
          <Row label="ช่องทางที่รู้จักโครงการ" value={lead.source ?? null} />
          <Row label="วิธีชำระ" value={lead.financing_type && lead.financing_type !== "ไม่ระบุ" ? lead.financing_type : null} />
        </Section>
      )}

      {lead && (
        <Section title="ตัวเงิน">
          <Row label="ราคาขายที่ตกลง" value={baht(lead.contract_price)} warn />
          <Row label="เงินจองที่รับจริง" value={baht(lead.booking_deposit)} warn />
          {Number(lead.budget) > 0 && <Row label="งบลูกค้า (อ้างอิง เท่านั้น)" value={baht(lead.budget)} />}
          <Row label="งวดชำระ"
            value={insts.length > 0 ? `ชำระแล้ว ${baht(paidTotal)} จาก ${baht(instTotal)} (${insts.filter(i => i.status === "paid").length}/${insts.length} งวด)` : null}
            warn />
        </Section>
      )}

      {lead && (
        <Section title="กำหนดการ">
          <Row label="เยี่ยมชมโครงการ" value={thDate(lead.visit_date)} />
          <Row label="วันจอง" value={thDate(lead.booking_date)} />
          <Row label="นัดทำสัญญา" value={thDate(lead.contract_appointment_date)} />
          <Row label="เซ็นสัญญาแล้ว" value={thDate(lead.contract_signed_date)} warn />
          <Row label="อนุมัติสินเชื่อ" value={thDate(lead.loan_approved_date)} warn />
          <Row label="นัดส่งมอบบ้าน" value={thDate(lead.delivery_date)} />
          <Row label="นัดโอนกรรมสิทธิ์" value={thDate(lead.transfer_appointment_date)} warn />
          <Row label="โอนจริงเมื่อ" value={thDate(lead.transfer_date)} />
        </Section>
      )}

      <Section title="ตัวบ้าน / งานก่อสร้าง">
        <Row label="รหัสแปลง" value={house?.plot_code ?? null} />
        <Row label="แบบบ้าน" value={house?.house_model ?? null} />
        <Row label="ขนาดที่ดิน" value={house?.land_size ? `${house.land_size} ตร.วา` : null} />
        <Row label="ราคาตั้งของแบบบ้าน" value={baht(house?.price)} />
        <Row label="สถานะก่อสร้าง"
          value={house?.construction_status
            ? `${CONSTRUCTION_TH[house.construction_status] ?? house.construction_status} ${house.progress ?? 0}%`
            : null} />
        <Row label="ผู้รับเหมา" value={house?.contractor && house.contractor !== "—" ? house.contractor : null} />
        <Row label="กำหนดแล้วเสร็จ" value={thDate(house?.planned_completion_date)} />
        <Row label="ผังอัปเดตล่าสุด" value={thDate(house?.updated_at)} />
      </Section>

      {lead && tasks.length > 0 && (
        <Section title="ความคืบหน้าการโอน">
          <Row label="เช็คลิสต์" value={`${doneTasks}/${tasks.length} รายการ`} />
        </Section>
      )}

      {/* เตือนเฉพาะเมื่อมีผู้ซื้อแล้ว — แปลงว่างไม่ต้องมีข้อมูลพวกนี้ */}
      {lead && missing.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
          <p className="text-[11px] font-bold text-amber-300 mb-1">
            ⚠️ ยังไม่ได้กรอก {missing.length} เรื่อง
          </p>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">{missing.join(" · ")}</p>
          <p className="text-[10px] text-amber-200/60 mt-1.5 leading-relaxed">
            กด &ldquo;แก้ไขข้อมูลลูกค้า&rdquo; ด้านล่างเพื่อกรอกให้ครบ — ช่องเหล่านี้ใช้ออกเอกสาร ตั้งงวดผ่อน และนับยอดขายโครงการ
          </p>
        </div>
      )}

      {priceLooksWrong && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5">
          <p className="text-[11px] font-bold text-red-300">🔴 ราคาขายต่ำผิดปกติ</p>
          <p className="text-[11px] text-red-200/90 mt-0.5 leading-relaxed">
            บันทึกไว้ {baht(lead!.contract_price)} ซึ่งต่ำเกินกว่าจะเป็นราคาบ้านทั้งหลัง
            — น่าจะใส่ยอดเงินจองผิดช่อง · ตัวเลขนี้ไหลไปนับเป็นยอดขายโครงการ
          </p>
        </div>
      )}

      {/* เตือนเมื่อจะโอนแล้วแต่ผังก่อสร้างยังไม่เสร็จ (เจอจริงกับแปลง 7 วันที่ 14 ต.ค. 69) */}
      {lead?.transfer_appointment_date && house && (house.progress ?? 0) < 100 && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5">
          <p className="text-[11px] font-bold text-red-300">🔴 นัดโอนแล้วแต่ผังยังไม่ 100%</p>
          <p className="text-[11px] text-red-200/90 mt-0.5 leading-relaxed">
            นัดโอน {thDate(lead.transfer_appointment_date)} แต่ผังขึ้นว่า {CONSTRUCTION_TH[house.construction_status ?? ""] ?? "—"} {house.progress ?? 0}%
            — ถ้าบ้านเสร็จแล้วจริง ให้แจ้งฝ่ายก่อสร้างอัปเดตผัง
          </p>
        </div>
      )}
    </div>
  );
}
