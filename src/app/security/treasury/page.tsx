"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Plus, X, BookOpen, TrendingUp, TrendingDown, Wallet, Building2, AlertCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import KPICard from "@/components/KPICard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Account { id: string; code: string; name_th: string; account_type: string; balance: number }
interface Journal { id: string; entry_date: string; description: string | null }
interface JournalLine { id: string; debit: number; credit: number; account_id: string; memo: string | null; journal_id: string }

function fmtBaht(n: number) {
  return `฿${Math.abs(Number(n)).toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
}

const TYPE_ORDER: Record<string, number> = { asset: 1, liability: 2, equity: 3, revenue: 4, expense: 5 };
const TYPE_TH: Record<string, string> = {
  asset: "สินทรัพย์", liability: "หนี้สิน", equity: "ส่วนของกองทุน", revenue: "รายรับ", expense: "ค่าใช้จ่าย",
};

const empty = {
  description: "",
  entry_date: new Date().toISOString().slice(0, 10),
  lines: [
    { account_id: "", debit: "", credit: "" },
    { account_id: "", debit: "", credit: "" },
  ] as { account_id: string; debit: string; credit: string }[],
};

export default function TreasuryPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [recentLines, setRecentLines] = useState<JournalLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      supabase.from("ledger_balances").select("*").order("code"),
      supabase.from("juristic_journals").select("id, entry_date, description").order("entry_date", { ascending: false }).limit(20),
    ]).then(([a, j]) => {
      setAccounts((a.data as Account[]) ?? []);
      setJournals((j.data as Journal[]) ?? []);
      const journalIds = ((j.data as Journal[]) ?? []).map(jj => jj.id);
      if (journalIds.length > 0) {
        supabase.from("juristic_journal_lines")
          .select("id, debit, credit, account_id, memo, journal_id")
          .in("journal_id", journalIds)
          .then(({ data }) => {
            setRecentLines((data as JournalLine[]) ?? []);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  };
  useEffect(load, []);

  // ฝั่ง revenue + equity ใช้สัญลักษณ์ credit เป็นบวก สำหรับ display
  const displayBalance = (a: Account) => {
    if (a.account_type === "revenue" || a.account_type === "liability" || a.account_type === "equity") return -a.balance;
    return a.balance;
  };

  const cashBalance = accounts
    .filter(a => a.code === "1010" || a.code === "1020" || a.code === "1030" || a.code === "1040")
    .reduce((s, a) => s + Number(a.balance), 0);
  const receivable = accounts.find(a => a.code === "1100")?.balance ?? 0;
  const ytdRevenue = accounts.filter(a => a.account_type === "revenue").reduce((s, a) => s - Number(a.balance), 0);
  const ytdExpense = accounts.filter(a => a.account_type === "expense").reduce((s, a) => s + Number(a.balance), 0);

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    (acc[a.account_type] ||= []).push(a);
    return acc;
  }, {});
  const types = Object.keys(grouped).sort((a, b) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99));

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { account_id: "", debit: "", credit: "" }] }));
  const setLine = (i: number, patch: Partial<{ account_id: string; debit: string; credit: string }>) =>
    setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  const removeLine = (i: number) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const submit = async () => {
    setError(null);
    const cleaned = form.lines.filter(l => l.account_id && (l.debit || l.credit))
      .map(l => ({
        account_id: l.account_id,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      }));
    if (cleaned.length < 2) { setError("ต้องมีอย่างน้อย 2 บรรทัด"); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/juristic-journals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({
        entry_date: form.entry_date,
        description: form.description,
        lines: cleaned,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setForm(empty);
      setShowForm(false);
      load();
    } else {
      setError(json.error ?? `error ${res.status}`);
    }
  };

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name_th ?? id.slice(0, 8);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">บัญชีนิติบุคคล</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">งบรับ-จ่าย · กองทุนกลาง · ความโปร่งใส</p>
            </div>
          </div>
          <button onClick={() => { setForm(empty); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> ลงรายการ
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <KPICard icon={Wallet} label="เงินสด + ธนาคาร" value={loading ? "…" : fmtBaht(cashBalance)} />
          <KPICard icon={Building2} label="ลูกหนี้ค้างค่าส่วนกลาง" value={loading ? "…" : fmtBaht(receivable)} />
          <KPICard icon={TrendingUp} label="รายรับสะสม" value={loading ? "…" : fmtBaht(ytdRevenue)} />
          <KPICard icon={TrendingDown} label="ค่าใช้จ่ายสะสม" value={loading ? "…" : fmtBaht(ytdExpense)} />
        </div>

        <Link href="/security/treasury/budget" className="block">
          <GlassCard className="p-4 active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-aviva-text">งบประมาณ vs ใช้จริง</p>
                <p className="text-xs text-aviva-secondary mt-0.5">ตั้งงบรายปี · ติดตามทุกหมวด</p>
              </div>
              <BookOpen size={18} className="text-aviva-gold" />
            </div>
          </GlassCard>
        </Link>

        <div>
          <SectionHeader title="ผังบัญชี &amp; ยอดคงเหลือ" subtitle={`${accounts.length} บัญชี`} />
          {loading ? (
            <div className="h-32 rounded-2xl bg-aviva-card/50 animate-pulse" />
          ) : (
            <div className="space-y-3">
              {types.map(t => (
                <div key={t}>
                  <p className="text-xs uppercase tracking-wider text-aviva-secondary/70 mb-1">{TYPE_TH[t] ?? t}</p>
                  <GlassCard className="divide-y divide-aviva-gold/10">
                    {grouped[t]
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map(a => (
                        <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                          <div>
                            <p className="text-aviva-text font-medium">{a.name_th}</p>
                            <p className="text-xs text-aviva-secondary font-mono">{a.code}</p>
                          </div>
                          <p className={clsx("font-bold font-mono",
                            displayBalance(a) > 0 ? "text-aviva-gold" : displayBalance(a) < 0 ? "text-red-300" : "text-aviva-secondary"
                          )}>{fmtBaht(displayBalance(a))}</p>
                        </div>
                      ))}
                  </GlassCard>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader title="รายการล่าสุด" subtitle={`${journals.length} entry · double-entry`} />
          {loading ? (
            <div className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />
          ) : journals.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="text-aviva-secondary text-sm">ยังไม่มีรายการ — แตะ "ลงรายการ" เพื่อเริ่มต้น</p>
            </GlassCard>
          ) : (
            journals.map(j => {
              const lines = recentLines.filter(l => l.journal_id === j.id);
              const totDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
              return (
                <GlassCard key={j.id} className="p-4 mb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-aviva-secondary">{j.entry_date}</p>
                      <p className="text-sm font-semibold text-aviva-text">{j.description ?? "—"}</p>
                    </div>
                    <p className="text-sm font-mono text-aviva-gold">{fmtBaht(totDebit)}</p>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {lines.map(l => (
                      <div key={l.id} className="flex items-center justify-between text-xs text-aviva-secondary">
                        <span>{accountName(l.account_id)}</span>
                        <span className="font-mono">
                          {Number(l.debit) > 0 && <span className="text-aviva-text">Dr {fmtBaht(l.debit)}</span>}
                          {Number(l.credit) > 0 && <span className="text-aviva-text">Cr {fmtBaht(l.credit)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ลงรายการบัญชี</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && (
              <div className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="วันที่">
                <input type="date" value={form.entry_date}
                  onChange={e => setForm({ ...form, entry_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </Field>
            </div>
            <Field label="คำอธิบาย">
              <input type="text" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="เช่น รับชำระค่าส่วนกลาง 2568 ยูนิต B12/01"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-aviva-secondary">บรรทัดบัญชี</p>
                <button onClick={addLine} className="text-xs text-aviva-gold flex items-center gap-1">
                  <Plus size={11} /> เพิ่มบรรทัด
                </button>
              </div>
              <div className="space-y-2">
                {form.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 items-start">
                    <select value={l.account_id} onChange={e => setLine(i, { account_id: e.target.value })}
                      className="col-span-6 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none">
                      <option value="">— บัญชี —</option>
                      {accounts.sort((a, b) => a.code.localeCompare(b.code)).map(a => (
                        <option key={a.id} value={a.id}>{a.code} {a.name_th}</option>
                      ))}
                    </select>
                    <input type="number" placeholder="Dr" value={l.debit}
                      onChange={e => setLine(i, { debit: e.target.value })}
                      className="col-span-2 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none font-mono" />
                    <input type="number" placeholder="Cr" value={l.credit}
                      onChange={e => setLine(i, { credit: e.target.value })}
                      className="col-span-3 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-2 text-xs text-aviva-text outline-none font-mono" />
                    {form.lines.length > 2 && (
                      <button onClick={() => removeLine(i)} className="col-span-1 text-red-400 text-xs"><X size={12} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={submit} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "บันทึก (Debit ต้องเท่ากับ Credit)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-aviva-secondary mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
