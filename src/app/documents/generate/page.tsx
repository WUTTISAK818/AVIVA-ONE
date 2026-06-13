"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, FileText, Search, Save, Loader2, Check } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { PLOTS, findPlot, PAYMENT_DEFAULTS, PROJECT, todayISO, makeContractNo } from "@/lib/aviva-doc-data";
import { recordGeneratedDocument } from "@/lib/doc-attach";
import { generateDocNumber } from "@/lib/doc-numbers";
import { useCurrentUser } from "@/lib/user-context";
import { DocData, emptyDocData } from "@/components/docs/types";
import QuotationDoc from "@/components/docs/QuotationDoc";
import BookingDoc from "@/components/docs/BookingDoc";
import ContractDoc from "@/components/docs/ContractDoc";

type DocType = "quotation" | "booking" | "contract";
const DOC_TABS: { key: DocType; label: string }[] = [
  { key: "quotation", label: "ใบเสนอราคา" },
  { key: "booking", label: "หนังสือจอง" },
  { key: "contract", label: "สัญญาจะซื้อจะขาย" },
];

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface LeadLite {
  id: string;
  customer_name: string;
  phone: string | null;
  contact_address: string | null;
  plot_number: number | null;
  budget: number | null;
  contract_price: number | null;
  contract_signed_date: string | null;
}

function GenerateInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [docType, setDocType] = useState<DocType>((params.get("type") as DocType) || "quotation");
  const [d, setD] = useState<DocData>({
    ...emptyDocData,
    docDate: todayISO(),
    contractDate: todayISO(),
    contractNo: makeContractNo(1),
    bookingFee: PAYMENT_DEFAULTS.bookingFee,
    contractFee: PAYMENT_DEFAULTS.contractFee,
  });
  const [leadResults, setLeadResults] = useState<LeadLite[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [showLeadList, setShowLeadList] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(params.get("lead"));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const user = useCurrentUser();

  const set = useCallback((patch: Partial<DocData>) => setD((p) => ({ ...p, ...patch })), []);

  // คำนวณยอดอัตโนมัติ
  const computed = useMemo(() => {
    const sale = (d.price || 0) - (d.specialDiscount || 0);
    const downTotal = d.downTotal || (d.downInstallments || 0) * (d.downPerInstallment || 0);
    const remaining = sale - (d.bookingFee || 0) - (d.contractFee || 0) - downTotal;
    return { downTotal, remaining: remaining > 0 ? remaining : 0 };
  }, [d.price, d.specialDiscount, d.bookingFee, d.contractFee, d.downInstallments, d.downPerInstallment, d.downTotal]);

  const docData: DocData = { ...d, downTotal: computed.downTotal, remaining: computed.remaining };

  // เลือกแปลง → เติมข้อมูลอัตโนมัติ
  const applyPlot = useCallback((code: string) => {
    const p = findPlot(code);
    if (!p) { set({ plot: code }); return; }
    set({ plot: p.plot, model: p.model, landSize: p.landSize, usableArea: p.usableArea, price: p.price });
  }, [set]);

  // ค้นหา lead
  useEffect(() => {
    if (!leadSearch.trim()) { setLeadResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("leads")
        .select("id,customer_name,phone,contact_address,plot_number,budget,contract_price,contract_signed_date")
        .eq("project_id", PROJECT_ID)
        .ilike("customer_name", `%${leadSearch.trim()}%`)
        .limit(8);
      setLeadResults((data as LeadLite[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [leadSearch]);

  const applyLead = useCallback((l: LeadLite) => {
    setLeadId(l.id);
    set({
      customerName: l.customer_name,
      customerPhone: l.phone ?? "",
      customerAddress: l.contact_address ?? "",
      contractDate: l.contract_signed_date || todayISO(),
      ...(l.contract_price ? { price: Number(l.contract_price) } : {}),
    });
    if (l.plot_number != null) {
      const byNum = PLOTS.find((p) => p.plotNo.replace(/\D/g, "") === String(l.plot_number) || p.plot.replace(/\D/g, "") === String(l.plot_number));
      if (byNum) applyPlot(byNum.plot);
    }
    setShowLeadList(false);
    setLeadSearch(l.customer_name);
  }, [set, applyPlot]);

  // prefill จาก query (?lead=&plot=)
  useEffect(() => {
    const plot = params.get("plot");
    const leadId = params.get("lead");
    if (plot) applyPlot(plot);
    if (leadId) {
      (async () => {
        const { data } = await supabase
          .from("leads")
          .select("id,customer_name,phone,contact_address,plot_number,budget,contract_price,contract_signed_date")
          .eq("id", leadId)
          .maybeSingle();
        if (data) applyLead(data as LeadLite);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const num = (v: string) => (v === "" ? 0 : Number(v.replace(/,/g, "")) || 0);

  // บันทึกเอกสารที่สร้าง (โหมด A) เข้าประวัติลูกค้า — รวมกับไฟล์ที่แนบในระบบเดียว
  const saveToHistory = async () => {
    if (!leadId || saving) return;
    setSaving(true);
    try {
      const label = DOC_TABS.find((t) => t.key === docType)?.label ?? "เอกสารขาย";
      const docNumber =
        docType === "contract" ? (d.contractNo || makeContractNo(1))
        : docType === "booking" ? await generateDocNumber("BOOK")
        : await generateDocNumber("DOC");
      await recordGeneratedDocument("lead", leadId, docType, docNumber, label, user?.full_name ?? user?.email ?? "ฝ่ายขาย");
      setSavedMsg(`บันทึก ${label} (${docNumber}) เข้าประวัติลูกค้าแล้ว`);
      setTimeout(() => setSavedMsg(""), 3500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-aviva-nav border-b border-aviva-gold/20 no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-aviva-secondary active:scale-90"><ArrowLeft size={20} /></button>
          <FileText size={18} className="text-aviva-gold" />
          <h1 className="text-base font-bold text-aviva-text">ออกเอกสารขาย</h1>
          {leadId && (
            <button onClick={saveToHistory} disabled={saving}
              className="ml-auto flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/30 text-aviva-gold font-bold text-sm px-3 py-1.5 rounded-lg active:scale-95 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} บันทึกเข้าประวัติ
            </button>
          )}
          <button onClick={() => window.print()}
            className={clsx("flex items-center gap-1.5 bg-aviva-gold text-aviva-bg font-bold text-sm px-3 py-1.5 rounded-lg active:scale-95", !leadId && "ml-auto")}>
            <Printer size={15} /> พิมพ์ / PDF
          </button>
        </div>
        {savedMsg && (
          <div className="max-w-5xl mx-auto px-4 pb-2 flex items-center gap-1.5 text-xs text-emerald-400">
            <Check size={13} /> {savedMsg}
          </div>
        )}
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-2">
          {DOC_TABS.map((t) => (
            <button key={t.key} onClick={() => setDocType(t.key)}
              className={clsx("px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                docType === t.key ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 grid lg:grid-cols-2 gap-5">
        {/* ── ฟอร์ม ── */}
        <div className="space-y-4 no-print">
          <Section title="ลูกค้า (ดึงจาก CRM)">
            <div className="relative">
              <div className="flex items-center gap-2 bg-aviva-card rounded-lg px-3 py-2 border border-aviva-gold/10">
                <Search size={15} className="text-aviva-secondary" />
                <input value={leadSearch} onChange={(e) => { setLeadSearch(e.target.value); setShowLeadList(true); }}
                  placeholder="พิมพ์ชื่อลูกค้าเพื่อค้นหา..." className="bg-transparent flex-1 text-sm text-aviva-text outline-none" />
              </div>
              {showLeadList && leadResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-aviva-card border border-aviva-gold/20 rounded-lg shadow-xl overflow-hidden">
                  {leadResults.map((l) => (
                    <button key={l.id} onClick={() => applyLead(l)}
                      className="w-full text-left px-3 py-2 text-sm text-aviva-text hover:bg-aviva-gold/10 border-b border-aviva-gold/5">
                      {l.customer_name} {l.plot_number ? <span className="text-aviva-secondary text-xs">· แปลง {l.plot_number}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Field label="ชื่อ-นามสกุล" value={d.customerName} onChange={(v) => set({ customerName: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="อายุ (ปี)" value={d.customerAge} onChange={(v) => set({ customerAge: v })} />
              <Field label="เลขบัตรประชาชน" value={d.customerIdCard} onChange={(v) => set({ customerIdCard: v })} />
            </div>
            <Field label="เบอร์โทร" value={d.customerPhone} onChange={(v) => set({ customerPhone: v })} />
            <Field label="ที่อยู่" value={d.customerAddress} onChange={(v) => set({ customerAddress: v })} />
          </Section>

          <Section title="แปลง / สิ่งปลูกสร้าง">
            <label className="block text-xs text-aviva-secondary mb-1">เลือกแปลง</label>
            <select value={d.plot} onChange={(e) => applyPlot(e.target.value)}
              className="w-full bg-aviva-card border border-aviva-gold/10 rounded-lg px-3 py-2 text-sm text-aviva-text outline-none">
              <option value="">— เลือกแปลง —</option>
              {PLOTS.map((p) => <option key={p.plot} value={p.plot}>{p.plot} · {p.model} · {p.landSize} ตร.วา · {p.price.toLocaleString()}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Field label="แบบบ้าน" value={d.model} onChange={(v) => set({ model: v })} />
              <Field label="ประเภทอาคาร" value={d.houseType} onChange={(v) => set({ houseType: v })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumField label="เนื้อที่ (ตร.วา)" value={d.landSize} onChange={(v) => set({ landSize: num(v) })} />
              <NumField label="ใช้สอย (ตร.ม.)" value={d.usableArea} onChange={(v) => set({ usableArea: num(v) })} />
              <Field label="โฉนดเลขที่" value={d.titleDeed} onChange={(v) => set({ titleDeed: v })} />
            </div>
          </Section>

          <Section title="ราคา / การชำระเงิน">
            <div className="grid grid-cols-2 gap-2">
              <NumField label="ราคารวม (บาท)" value={d.price} onChange={(v) => set({ price: num(v) })} />
              <NumField label="ส่วนลดพิเศษ" value={d.specialDiscount} onChange={(v) => set({ specialDiscount: num(v) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="เงินจอง" value={d.bookingFee} onChange={(v) => set({ bookingFee: num(v) })} />
              <NumField label="เงินทำสัญญา" value={d.contractFee} onChange={(v) => set({ contractFee: num(v) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="ผ่อนดาวน์ (งวด)" value={d.downInstallments} onChange={(v) => set({ downInstallments: num(v), downTotal: 0 })} />
              <NumField label="งวดละ (บาท)" value={d.downPerInstallment} onChange={(v) => set({ downPerInstallment: num(v), downTotal: 0 })} />
            </div>
            <div className="text-xs text-aviva-secondary">
              รวมดาวน์ <b className="text-aviva-gold">{computed.downTotal.toLocaleString()}</b> · คงเหลือวันโอน <b className="text-aviva-gold">{computed.remaining.toLocaleString()}</b>
            </div>
            <label className="block text-xs text-aviva-secondary mb-1">วิธีชำระเงินจอง</label>
            <div className="flex gap-2">
              {([["cash", "เงินสด"], ["transfer", "โอนธนาคาร"], ["credit", "บัตรเครดิต"]] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => set({ paymentMethod: d.paymentMethod === k ? "" : k })}
                  className={clsx("px-3 py-1.5 rounded-lg text-xs border", d.paymentMethod === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10")}>
                  {lbl}
                </button>
              ))}
            </div>
            {d.paymentMethod === "transfer" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="ธนาคาร" value={d.bankName} onChange={(v) => set({ bankName: v })} />
                <Field label="สาขา" value={d.bankBranch} onChange={(v) => set({ bankBranch: v })} />
              </div>
            )}
          </Section>

          <Section title="วันที่ / เลขที่เอกสาร">
            <div className="grid grid-cols-2 gap-2">
              <DateField label="วันที่จอง/เอกสาร" value={d.docDate} onChange={(v) => set({ docDate: v })} />
              <DateField label="วันทำสัญญา" value={d.contractDate} onChange={(v) => set({ contractDate: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DateField label="กำหนดโอน" value={d.transferDate} onChange={(v) => set({ transferDate: v })} />
              <Field label="เลขที่สัญญา" value={d.contractNo} onChange={(v) => set({ contractNo: v })} />
            </div>
          </Section>
        </div>

        {/* ── พรีวิว ── */}
        <div className="print-area">
          <div className="text-xs text-aviva-secondary mb-2 no-print">ตัวอย่างเอกสาร — {PROJECT.nameEn}</div>
          {docType === "quotation" && <QuotationDoc d={docData} />}
          {docType === "booking" && <BookingDoc d={docData} />}
          {docType === "contract" && <ContractDoc d={docData} />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-aviva-card/40 rounded-xl p-3 border border-aviva-gold/10 space-y-2">
      <div className="text-sm font-bold text-aviva-gold">{title}</div>
      {children}
    </div>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-aviva-secondary mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-aviva-card border border-aviva-gold/10 rounded-lg px-3 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/40" />
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-aviva-secondary mb-1">{label}</label>
      <input inputMode="numeric" value={value === 0 ? "" : value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-aviva-card border border-aviva-gold/10 rounded-lg px-3 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/40" />
    </div>
  );
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-aviva-secondary mb-1">{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-aviva-card border border-aviva-gold/10 rounded-lg px-3 py-2 text-sm text-aviva-text outline-none focus:border-aviva-gold/40" />
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-aviva-bg" />}>
      <GenerateInner />
    </Suspense>
  );
}
