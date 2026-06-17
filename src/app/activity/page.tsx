"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { ClipboardList, Plus, X, Trash2, Sparkles, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import { useCurrentUser } from "@/lib/user-context";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const CATEGORIES = ["ลูกค้า/ขาย", "ก่อสร้าง", "บัญชี", "การเงิน", "การตลาด", "บุคคล", "ประชุม", "เอกสาร", "อื่นๆ"];

const CAT_COLOR: Record<string, string> = {
  "ลูกค้า/ขาย": "bg-green-500/15 text-green-400",
  "ก่อสร้าง": "bg-orange-500/15 text-orange-400",
  "บัญชี": "bg-blue-500/15 text-blue-400",
  "การเงิน": "bg-yellow-500/15 text-yellow-400",
  "การตลาด": "bg-pink-500/15 text-pink-400",
  "บุคคล": "bg-teal-500/15 text-teal-400",
  "ประชุม": "bg-purple-500/15 text-purple-400",
  "เอกสาร": "bg-indigo-500/15 text-indigo-400",
  "อื่นๆ": "bg-aviva-gold/15 text-aviva-gold",
};

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string | null;
  department: string | null;
  activity_date: string;
  activity_time: string | null;
  category: string | null;
  title: string;
  detail: string | null;
  source: string;
}

const todayBkk = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export default function ActivityPage() {
  const user = useCurrentUser();
  const [date, setDate] = useState(todayBkk());
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "ลูกค้า/ขาย", title: "", detail: "", time: "" });
  const [auto, setAuto] = useState<{ sales: number; calls: number; jv: number; construction: number; installment: number; po: number } | null>(null);
  const [autoAdded, setAutoAdded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // ฟีดกิจกรรม (RLS กรองสิทธิ์ให้แล้ว: ของตัวเอง+แผนก, ผู้บริหารเห็นหมด)
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("activity_date", date)
      .order("activity_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    setItems((data as ActivityLog[]) ?? []);

    // สรุปอัตโนมัติของ "ฉัน" สำหรับวันนี้ (นับจากงานจริงในระบบ)
    if (user?.id) {
      const dStart = `${date}T00:00:00`, dEnd = `${date}T23:59:59`;
      const [sa, calls, jv, cr, inst, po] = await Promise.all([
        supabase.from("sales_activities").select("id", { count: "exact", head: true })
          .eq("created_by", user.id).gte("activity_date", dStart).lte("activity_date", dEnd),
        supabase.from("crm_logs").select("id", { count: "exact", head: true })
          .eq("created_by_id", user.id).gte("created_at", dStart).lte("created_at", dEnd),
        supabase.from("jv_entries").select("id", { count: "exact", head: true })
          .eq("created_by", user.id).eq("jv_date", date),
        supabase.from("construction_reports").select("id", { count: "exact", head: true })
          .eq("created_by", user.id).gte("created_at", dStart).lte("created_at", dEnd),
        supabase.from("contractor_installments").select("id", { count: "exact", head: true })
          .eq("created_by_name", user.full_name ?? "___").gte("updated_at", dStart).lte("updated_at", dEnd),
        supabase.from("purchase_orders").select("id", { count: "exact", head: true })
          .eq("created_by_id", user.id).gte("created_at", dStart).lte("created_at", dEnd),
      ]);
      setAuto({ sales: sa.count ?? 0, calls: calls.count ?? 0, jv: jv.count ?? 0, construction: cr.count ?? 0, installment: inst.count ?? 0, po: po.count ?? 0 });
    }
    setLoading(false);
  }, [date, user?.id, user?.full_name]);

  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => { setAutoAdded(false); }, [date]);

  const departments = useMemo(
    () => Array.from(new Set(items.map((i) => i.department).filter(Boolean))) as string[],
    [items]
  );
  const visible = deptFilter === "all" ? items : items.filter((i) => i.department === deptFilter);

  const autoText = auto
    ? [
        auto.sales ? `บันทึกกิจกรรมขาย ${auto.sales}` : "",
        auto.calls ? `โทร/ติดต่อลูกค้า ${auto.calls}` : "",
        auto.installment ? `ตรวจ/ส่งเบิกงวดงาน ${auto.installment}` : "",
        auto.construction ? `รายงานก่อสร้าง ${auto.construction}` : "",
        auto.po ? `ใบสั่งซื้อ ${auto.po}` : "",
        auto.jv ? `ลงบัญชี (JV) ${auto.jv}` : "",
      ].filter(Boolean).join(" · ")
    : "";

  const addAutoToLog = async () => {
    if (!user || !autoText) return;
    setSaving(true);
    await supabase.from("activity_logs").insert({
      project_id: PROJECT_ID, user_id: user.id, user_name: user.full_name ?? user.email,
      department: user.department, activity_date: date,
      category: "สรุปอัตโนมัติ", title: `สรุปงานระบบ: ${autoText}`, source: "auto",
    });
    setAutoAdded(true); setSaving(false); load();
  };

  const submit = async () => {
    if (!user || !form.title.trim()) return;
    setSaving(true);
    await supabase.from("activity_logs").insert({
      project_id: PROJECT_ID, user_id: user.id, user_name: user.full_name ?? user.email,
      department: user.department, activity_date: date,
      activity_time: form.time || null, category: form.category,
      title: form.title.trim(), detail: form.detail.trim() || null, source: "manual",
    });
    setForm({ category: "ลูกค้า/ขาย", title: "", detail: "", time: "" });
    setShowForm(false); setSaving(false); load();
  };

  const remove = async (id: string) => {
    setItems((p) => p.filter((i) => i.id !== id));
    await supabase.from("activity_logs").delete().eq("id", id);
  };

  const canEdit = (it: ActivityLog) => it.user_id === user?.id || user?.isManager;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">สรุปงานประจำวัน</h1>
          </div>
          <input type="date" value={date} max={todayBkk()} onChange={(e) => setDate(e.target.value)}
            className="bg-aviva-card border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text" />
        </div>
        {user?.isManager && (
          <p className="max-w-lg mx-auto text-[10px] text-aviva-secondary mt-1.5">โหมดผู้บริหาร — เห็นกิจกรรมทุกฝ่าย</p>
        )}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {/* สรุปอัตโนมัติของฉัน */}
        {auto && autoText && (
          <GlassCard className="p-4 border border-aviva-gold/25">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={15} className="text-aviva-gold" />
              <p className="text-sm font-semibold text-aviva-text">ระบบสรุปงานของคุณวันนี้</p>
            </div>
            <p className="text-xs text-aviva-secondary leading-relaxed">{autoText}</p>
            <button onClick={addAutoToLog} disabled={saving || autoAdded}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-aviva-gold/30 text-aviva-gold disabled:opacity-50">
              <Download size={13} /> {autoAdded ? "เพิ่มลงบันทึกแล้ว ✓" : "เพิ่มลงบันทึกประจำวัน"}
            </button>
          </GlassCard>
        )}

        {/* ปุ่มบันทึกเอง */}
        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-aviva-gold/30 text-aviva-gold text-sm font-semibold">
            <Plus size={16} /> บันทึกกิจกรรมของฉัน
          </button>
        ) : (
          <GlassCard className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-aviva-text">บันทึกกิจกรรม</p>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-aviva-secondary" /></button>
            </div>
            <div className="flex gap-2">
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                className="bg-aviva-bg border border-aviva-gold/20 rounded-xl px-2 py-2 text-sm text-aviva-text" />
            </div>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="ทำอะไร เช่น พาลูกค้าดูแปลง 12 / ตรวจงวดที่ 3 บ้าน A1"
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text" />
            <textarea value={form.detail} onChange={(e) => setForm((p) => ({ ...p, detail: e.target.value }))}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" rows={2}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text" />
            <button onClick={submit} disabled={saving || !form.title.trim()}
              className="w-full py-2.5 rounded-xl bg-aviva-gold text-aviva-bg text-sm font-bold disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </GlassCard>
        )}

        {/* ตัวกรองฝ่าย (ผู้บริหาร) */}
        {user?.isManager && departments.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setDeptFilter("all")}
              className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap ${deptFilter === "all" ? "bg-aviva-gold text-aviva-bg font-semibold" : "bg-aviva-card text-aviva-secondary border border-aviva-gold/15"}`}>ทั้งหมด</button>
            {departments.map((d) => (
              <button key={d} onClick={() => setDeptFilter(d)}
                className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap ${deptFilter === d ? "bg-aviva-gold text-aviva-bg font-semibold" : "bg-aviva-card text-aviva-secondary border border-aviva-gold/15"}`}>{d}</button>
            ))}
          </div>
        )}

        {/* ฟีดกิจกรรม */}
        {loading ? (
          <p className="text-center text-xs text-aviva-secondary py-8">กำลังโหลด…</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-10">
            <ClipboardList size={26} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-xs text-aviva-secondary">ยังไม่มีบันทึกกิจกรรมของวันนี้</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((it) => (
              <GlassCard key={it.id} className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CAT_COLOR[it.category ?? ""] ?? "bg-aviva-gold/15 text-aviva-gold"}`}>{it.category ?? "อื่นๆ"}</span>
                      {it.source === "auto" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-aviva-gold/10 text-aviva-gold flex items-center gap-0.5"><Sparkles size={9} />อัตโนมัติ</span>}
                      {it.activity_time && <span className="text-[10px] text-aviva-secondary/60">{it.activity_time.slice(0, 5)} น.</span>}
                    </div>
                    <p className="text-sm text-aviva-text font-medium">{it.title}</p>
                    {it.detail && <p className="text-xs text-aviva-secondary mt-0.5">{it.detail}</p>}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-aviva-gold">{it.user_name ?? "-"}</span>
                      {it.department && <span className="text-[10px] text-aviva-secondary/60">· {it.department}</span>}
                    </div>
                  </div>
                  {canEdit(it) && (
                    <button onClick={() => remove(it.id)} className="flex-shrink-0 p-1 text-aviva-secondary/50 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
