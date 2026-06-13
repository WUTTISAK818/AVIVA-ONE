"use client";
import { useState, useRef } from "react";
import { Paperclip, Loader2, X, FileText, Printer } from "lucide-react";
import { uploadEntityFile, attachDocumentToEntity, recordGeneratedDocument, getEntityDocuments, type EntityType, type EntityDocument } from "@/lib/doc-attach";
import { toSignedUrl } from "@/lib/storage";
import { generateDocNumber } from "@/lib/doc-numbers";
import { printDocument, type DocTemplate } from "@/lib/doc-templates";

function isImageUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url.split("?")[0]);
}

interface Props {
  entityType: EntityType;
  entityId: string;
  attachedBy: string;
  /** โหมด A — รายการ template ที่สร้างจากแอปได้ (ถ้าไม่ส่ง = มีเฉพาะโหมดแนบไฟล์ เหมือนเดิม) */
  templates?: DocTemplate[];
  onAttached?: () => void;
}

type DocRow = EntityDocument & { signed?: string | null };

export default function AttachDocButton({ entityType, entityId, attachedBy, templates, onAttached }: Props) {
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [showDocs, setShowDocs] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [latestImage, setLatestImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocs = async (open = true) => {
    const result = await getEntityDocuments(entityType, entityId);
    const withSigned = await Promise.all(result.map(async d => ({ ...d, signed: await toSignedUrl(d.file_url) })));
    setDocs(withSigned);
    const img = withSigned.find(d => isImageUrl(d.file_url));
    if (img?.signed) setLatestImage(img.signed);
    if (open) setShowDocs(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const { url, error } = await uploadEntityFile(entityType, entityId, file);
    if (!error && url) {
      await attachDocumentToEntity(entityType, entityId, url, file.name, attachedBy);
      if (isImageUrl(url)) setLatestImage(await toSignedUrl(url));
      onAttached?.();
      await loadDocs(false);
    }
    setUploading(false);
  };

  const handleGenerate = async (tpl: DocTemplate) => {
    setShowTpl(false);
    setGenerating(true);
    try {
      const docNumber = tpl.prefix ? await generateDocNumber(tpl.prefix) : "";
      printDocument(tpl.render(docNumber));
      await recordGeneratedDocument(entityType, entityId, tpl.docType, docNumber, tpl.label, attachedBy);
      onAttached?.();
      await loadDocs(false);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button onClick={() => showDocs ? setShowDocs(false) : loadDocs()}
          className="flex items-center gap-1 text-[10px] text-aviva-secondary border border-aviva-gold/10 px-2 py-1 rounded-lg hover:border-aviva-gold/30 transition-all">
          {latestImage
            ? <img src={latestImage} alt="preview" className="w-[18px] h-[18px] object-cover rounded" />
            : <Paperclip size={10} />}
          เอกสาร{docs.length > 0 ? ` (${docs.length})` : ""}
        </button>

        {/* โหมด A — สร้างจากแอป (เฉพาะเมื่อมี templates) */}
        {templates && templates.length > 0 && (
          <button onClick={() => setShowTpl(v => !v)}
            className="flex items-center gap-1 text-[10px] text-blue-400 border border-blue-400/30 px-2 py-1 rounded-lg">
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Printer size={10} />} สร้าง
          </button>
        )}

        {/* โหมด B — แนบไฟล์ */}
        <label className="cursor-pointer">
          <input ref={inputRef} type="file" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          {uploading
            ? <Loader2 size={12} className="text-aviva-gold animate-spin" />
            : <button onClick={() => inputRef.current?.click()}
                className="text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg">+ แนบ</button>
          }
        </label>
      </div>

      {/* เมนูเลือก template (โหมด A) */}
      {showTpl && templates && (
        <div className="absolute bottom-full left-0 mb-1 bg-aviva-card border border-blue-400/20 rounded-xl p-2 z-50 w-52 shadow-xl space-y-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-aviva-secondary font-semibold">สร้างเอกสาร</p>
            <button onClick={() => setShowTpl(false)}><X size={10} className="text-aviva-secondary" /></button>
          </div>
          {templates.map(t => (
            <button key={t.key} onClick={() => handleGenerate(t)}
              className="w-full flex items-center gap-1.5 text-[11px] text-blue-300 hover:bg-blue-400/10 rounded px-1.5 py-1 text-left">
              <Printer size={10} className="flex-shrink-0" /> {t.label}
            </button>
          ))}
        </div>
      )}

      {/* รายการเอกสารทั้งหมด (ทั้งสองโหมด) */}
      {showDocs && docs.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 bg-aviva-card border border-aviva-gold/20 rounded-xl p-2 z-50 w-60 shadow-xl space-y-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-aviva-secondary font-semibold">เอกสารทั้งหมด</p>
            <button onClick={() => setShowDocs(false)}><X size={10} className="text-aviva-secondary" /></button>
          </div>
          {docs.map(d => d.source === "generated" ? (
            <div key={d.id} className="flex items-center gap-1.5 text-[10px] text-blue-300">
              <Printer size={9} className="flex-shrink-0" />
              <span className="truncate">{d.file_name ?? "เอกสาร"}</span>
              {d.doc_number && <span className="font-mono text-blue-400 flex-shrink-0">{d.doc_number}</span>}
            </div>
          ) : (
            <a key={d.id} href={d.signed ?? d.file_url ?? "#"} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-[10px] text-aviva-gold hover:underline truncate">
              {isImageUrl(d.file_url)
                ? <img src={d.signed ?? d.file_url!} alt={d.file_name ?? "img"} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                : <FileText size={9} className="flex-shrink-0" />}
              <span className="truncate">{d.file_name ?? "ไฟล์แนบ"}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
