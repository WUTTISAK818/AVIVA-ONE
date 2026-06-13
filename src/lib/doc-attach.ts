import { supabase } from "./supabase";

export type EntityType = 'approval_log' | 'accounting_entry' | 'jv_entry' | 'lead' | 'contractor_installment' | 'customer_installment' | 'leave_request' | 'receipt' | 'purchase_order';

export type DocSource = 'generated' | 'uploaded';

const DOC_BUCKET = "document-attachments";

export interface EntityDocument {
  id: string;
  file_url: string | null;
  file_name: string | null;
  attached_by: string | null;
  notes: string | null;
  source: DocSource;
  doc_type: string | null;
  doc_number: string | null;
  created_at: string;
}

/** อัปโหลดไฟล์เข้า private bucket แล้วคืน URL (เก็บเป็น public-form URL — อ่านผ่าน toSignedUrl) */
export async function uploadEntityFile(
  entityType: EntityType,
  entityId: string,
  file: File
): Promise<{ url: string | null; error: Error | null }> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `entity-docs/${entityType}/${entityId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(DOC_BUCKET).upload(path, file, { upsert: true });
  if (error) return { url: null, error };
  const { data: { publicUrl } } = supabase.storage.from(DOC_BUCKET).getPublicUrl(path);
  return { url: publicUrl, error: null };
}

/** บันทึกเอกสารผูกกับ entity (ใช้ได้ทั้งโหมดแนบไฟล์และโหมดสร้างจากแอป) */
export async function attachDocumentToEntity(
  entityType: EntityType,
  entityId: string,
  fileUrl: string | null,
  fileName: string,
  attachedBy: string,
  notes?: string,
  opts?: { source?: DocSource; docType?: string; docNumber?: string }
) {
  const { data, error } = await supabase.from("entity_documents").insert({
    entity_type: entityType,
    entity_id: entityId,
    file_url: fileUrl,
    file_name: fileName,
    attached_by: attachedBy,
    notes: notes ?? null,
    source: opts?.source ?? "uploaded",
    doc_type: opts?.docType ?? null,
    doc_number: opts?.docNumber ?? null,
  }).select().single();
  return { data, error };
}

/** บันทึกระเบียนเอกสารที่ "สร้างจากแอป" (พิมพ์ผ่าน browser — ไม่มีไฟล์แนบ) */
export async function recordGeneratedDocument(
  entityType: EntityType,
  entityId: string,
  docType: string,
  docNumber: string,
  docTitle: string,
  generatedBy: string
) {
  return attachDocumentToEntity(entityType, entityId, null, docTitle, generatedBy, undefined, {
    source: "generated",
    docType,
    docNumber,
  });
}

export async function getEntityDocuments(entityType: EntityType, entityId: string): Promise<EntityDocument[]> {
  const { data } = await supabase.from("entity_documents")
    .select("id,file_url,file_name,attached_by,notes,source,doc_type,doc_number,created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  return (data ?? []) as EntityDocument[];
}

export async function deleteEntityDocument(id: string) {
  return supabase.from("entity_documents").delete().eq("id", id);
}
