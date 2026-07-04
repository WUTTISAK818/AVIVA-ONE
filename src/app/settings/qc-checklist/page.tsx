"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ClipboardCheck, Plus, X, ChevronDown, ChevronUp, Save, Trash2, GripVertical } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import Toast, { type ToastType } from "@/components/Toast";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import { thaiDbError } from "@/lib/db-errors";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Template { id: string; installment_number: number; name: string; description: string | null; is_active: boolean | null; }
interface WorkItem { id: string; template_id: string; item_name: string; category: string | null; criteria: string | null; seq_order: number | null; }

export default function QCChecklistSettingsPage() {
  const user = useCurrentUser();
  const canEdit = user?.isManager || user?.isAdmin;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  // ฟอร์มเพิ่มรายการตรวจใหม่ (ต่อ template)
  const [newItem, setNewItem] = useState<{ template_id: string; category: string; item_name: string; criteria: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: wi }] = await Promise.all([
      supabase.from("installment_templates").select("id, installment_number, name, description, is_active").order("installment_number"),
      supabase.from("installment_work_items").select("id, template_id, item_name, category, criteria, seq_order").order("seq_order"),
    ]);
    setTemplates((t as Template[]) ?? []);
    setItems((wi as WorkItem[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const itemsOf = (tid: string) => items.filter(i => i.template_id === tid).sort((a, b) => (a.seq_order ?? 0) - (b.seq_order ?? 0));

  async function addItem() {
    if (!newItem || !newItem.item_name.trim()) { setToast({ msg: "กรอกชื่อรายการตรวจก่อน", type: "error" }); return; }
    const maxSeq = Math.max(0, ...itemsOf(newItem.template_id).map(i => i.seq_order ?? 0));
    const { error } = await supabase.from("installment_work_items").insert({
      template_id: newItem.template_id,
      item_name: newItem.item_name.trim(),
      category: newItem.category.trim() || null,
      criteria: newItem.criteria.trim() || null,
      seq_order: maxSeq + 1,
    });
    if (error) { setToast({ msg: thaiDbError(error, "เพิ่มรายการ"), type: "error" }); return; }
    setNewItem({ template_id: newItem.template_id, category: newItem.category, item_name: "", criteria: "" }); // คงหมวดไว้กรอกต่อ
    setToast({ msg: "เพิ่มรายการตรวจแล้ว", type: "success" });
    load();
  }

  async function saveItem(it: WorkItem) {
    const { error } = await supabase.from("installment_work_items")
      .update({ item_name: it.item_name, category: it.category || null, criteria: it.criteria || null }).eq("id", it.id);
    if (error) { setToast({ msg: thaiDbError(error, "บันทึก"), type: "error" }); return; }
    setToast({ msg: "บันทึกแล้ว", type: "success" });
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from("installment_work_items").delete().eq("id", id);
    if (error) { setToast({ msg: thaiDbError(error, "ลบ"), type: "error" }); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    setToast({ msg: "ลบรายการแล้ว", type: "info" });
  }

  async function addTemplate() {
    const nextNo = Math.max(0, ...templates.map(t => t.installment_number)) + 1;
    const { error } = await supabase.from("installment_templates").insert({
      project_id: PROJECT_ID, installment_number: nextNo, name: `งวด ${nextNo} — (ตั้งชื่อ)`, is_active: true,
    });
    if (error) { setToast({ msg: thaiDbError(error, "เพิ่มงวด"), type: "error" }); return; }
    setToast({ msg: `เพิ่มงวด ${nextNo} แล้ว`, type: "success" });
    load();
  }

  async function saveTemplate(t: Template) {
    const { error } = await supabase.from("installment_templates").update({ name: t.name, is_active: t.is_active }).eq("id", t.id);
    if (error) { setToast({ msg: thaiDbError(error, "บันทึกงวด"), type: "error" }); return; }
    setToast({ msg: "บันทึกชื่องวดแล้ว", type: "success" });
  }

  if (user && !canEdit) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center px-4 pb-24">
        <p className="text-aviva-secondary text-sm">หน้านี้สำหรับผู้จัดการ/ผู้บริหารเท่านั้น</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/settings" className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10"><ChevronLeft size={18} className="text-aviva-secondary" /></Link>
          <div className="flex items-center gap-2 flex-1"><ClipboardCheck size={18} className="text-aviva-gold" /><h1 className="text-lg font-bold text-aviva-text">รายการตรวจคุณภาพงาน (QC)</h1></div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
        <GlassCard className="p-3">
          <p className="text-xs text-aviva-secondary leading-relaxed">
            กำหนดรายการตรวจคุณภาพต่องวดงานได้เอง — เพิ่ม/แก้/ลบ รายการ · จัดกลุ่มด้วย <b className="text-aviva-text">หมวด</b> · ใส่ <b className="text-aviva-text">เกณฑ์ยอมรับ</b> (เช่น คอนกรีต ≥240 กก./ตร.ซม.) ให้ผู้ตรวจหน้างานเห็นตอนตรวจจริง
          </p>
        </GlassCard>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" /></div>
        ) : (
          <>
            {templates.map(t => {
              const tItems = itemsOf(t.id);
              const cats = Array.from(new Set(tItems.map(i => i.category || "ไม่ระบุหมวด")));
              const isOpen = expanded === t.id;
              return (
                <GlassCard key={t.id} className="p-0 overflow-hidden">
                  <button onClick={() => setExpanded(isOpen ? null : t.id)} className="w-full flex items-center justify-between gap-2 p-3.5 text-left">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-aviva-gold">งวด {t.installment_number}</span>
                      <p className="text-sm font-semibold text-aviva-text truncate">{t.name}</p>
                      <p className="text-[10px] text-aviva-secondary/70">{tItems.length} รายการ · {cats.length} หมวด</p>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-aviva-secondary flex-shrink-0" /> : <ChevronDown size={16} className="text-aviva-secondary flex-shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-3.5 pb-4 space-y-3 border-t border-aviva-gold/10 pt-3">
                      {/* ชื่องวด */}
                      <div className="flex items-center gap-2">
                        <input value={t.name} onChange={e => setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))}
                          className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/50" />
                        <button onClick={() => saveTemplate(t)} className="p-2 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30 text-aviva-gold"><Save size={13} /></button>
                      </div>

                      {/* รายการตรวจจัดกลุ่มตามหมวด */}
                      {cats.map(cat => (
                        <div key={cat} className="space-y-1.5">
                          <p className="text-[10px] font-bold text-aviva-secondary/70 uppercase tracking-wider">{cat}</p>
                          {tItems.filter(i => (i.category || "ไม่ระบุหมวด") === cat).map(it => (
                            <div key={it.id} className="bg-aviva-bg/60 rounded-lg p-2 space-y-1.5">
                              <div className="flex items-start gap-1.5">
                                <GripVertical size={13} className="text-aviva-secondary/30 mt-1.5 flex-shrink-0" />
                                <textarea value={it.item_name} rows={1}
                                  onChange={e => setItems(prev => prev.map(x => x.id === it.id ? { ...x, item_name: e.target.value } : x))}
                                  className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50 resize-none" />
                                <button onClick={() => saveItem(it)} className="p-1.5 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30 text-aviva-gold"><Save size={12} /></button>
                                <button onClick={() => deleteItem(it.id)} className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"><Trash2 size={12} /></button>
                              </div>
                              <div className="flex gap-1.5 pl-5">
                                <input value={it.category ?? ""} placeholder="หมวด" onChange={e => setItems(prev => prev.map(x => x.id === it.id ? { ...x, category: e.target.value } : x))}
                                  className="w-28 bg-aviva-bg border border-aviva-gold/15 rounded px-2 py-1 text-[10px] text-aviva-secondary outline-none focus:border-aviva-gold/40" />
                                <input value={it.criteria ?? ""} placeholder="เกณฑ์ยอมรับ (เช่น ≥240 ksc)" onChange={e => setItems(prev => prev.map(x => x.id === it.id ? { ...x, criteria: e.target.value } : x))}
                                  className="flex-1 bg-aviva-bg border border-aviva-gold/15 rounded px-2 py-1 text-[10px] text-aviva-secondary outline-none focus:border-aviva-gold/40" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}

                      {/* เพิ่มรายการใหม่ */}
                      {newItem?.template_id === t.id ? (
                        <div className="bg-aviva-gold/5 border border-aviva-gold/20 rounded-lg p-2.5 space-y-2">
                          <input value={newItem.category} placeholder="หมวด (เช่น งานเทคอนกรีต)" onChange={e => setNewItem(n => n && { ...n, category: e.target.value })}
                            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50" />
                          <textarea value={newItem.item_name} rows={2} placeholder="ชื่อรายการตรวจ *" onChange={e => setNewItem(n => n && { ...n, item_name: e.target.value })}
                            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50 resize-none" />
                          <input value={newItem.criteria} placeholder="เกณฑ์ยอมรับ (ถ้ามี)" onChange={e => setNewItem(n => n && { ...n, criteria: e.target.value })}
                            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50" />
                          <div className="flex gap-2">
                            <button onClick={addItem} className="flex-1 py-2 bg-aviva-gold text-aviva-bg font-bold rounded-lg text-xs">เพิ่มรายการ</button>
                            <button onClick={() => setNewItem(null)} className="px-3 py-2 bg-aviva-bg border border-aviva-gold/20 text-aviva-secondary rounded-lg text-xs">ปิด</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setNewItem({ template_id: t.id, category: "", item_name: "", criteria: "" })}
                          className="w-full py-2 border border-dashed border-aviva-gold/30 rounded-lg text-xs text-aviva-gold flex items-center justify-center gap-1">
                          <Plus size={13} /> เพิ่มรายการตรวจ
                        </button>
                      )}
                    </div>
                  )}
                </GlassCard>
              );
            })}

            <button onClick={addTemplate} className="w-full py-3 border border-dashed border-aviva-gold/40 rounded-2xl text-sm text-aviva-gold font-semibold flex items-center justify-center gap-1.5">
              <Plus size={15} /> เพิ่มงวดงานใหม่
            </button>
          </>
        )}
      </div>
    </div>
  );
}
