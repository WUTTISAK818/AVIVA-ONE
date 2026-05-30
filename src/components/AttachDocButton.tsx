"use client";
import { useState, useRef } from "react";
import { Paperclip, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { attachDocumentToEntity, getEntityDocuments, type EntityType } from "@/lib/doc-attach";

interface Props {
  entityType: EntityType;
  entityId: string;
  attachedBy: string;
  onAttached?: () => void;
}

export default function AttachDocButton({ entityType, entityId, attachedBy, onAttached }: Props) {
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<{ id: string; file_url: string | null; file_name: string | null; created_at: string }[]>([]);
  const [showDocs, setShowDocs] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    const result = await getEntityDocuments(entityType, entityId);
    setDocs(result);
    setShowDocs(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `entity-docs/${entityType}/${entityId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("document-attachments").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("document-attachments").getPublicUrl(path);
      await attachDocumentToEntity(entityType, entityId, publicUrl, file.name, attachedBy);
      onAttached?.();
      await loadDocs();
    }
    setUploading(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button onClick={() => showDocs ? setShowDocs(false) : loadDocs()}
          className="flex items-center gap-1 text-[10px] text-aviva-secondary border border-aviva-gold/10 px-2 py-1 rounded-lg hover:border-aviva-gold/30 transition-all">
          <Paperclip size={10} />
          เอกสาร{docs.length > 0 ? ` (${docs.length})` : ""}
        </button>
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
      {showDocs && docs.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 bg-aviva-card border border-aviva-gold/20 rounded-xl p-2 z-50 w-56 shadow-xl space-y-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-aviva-secondary font-semibold">เอกสารแนบ</p>
            <button onClick={() => setShowDocs(false)}><X size={10} className="text-aviva-secondary" /></button>
          </div>
          {docs.map(d => (
            <a key={d.id} href={d.file_url ?? "#"} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-[10px] text-aviva-gold hover:underline truncate">
              <Paperclip size={9} />
              {d.file_name ?? "ไฟล์แนบ"}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
