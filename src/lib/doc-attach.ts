import { supabase } from "./supabase";

export type EntityType = 'approval_log' | 'accounting_entry' | 'lead' | 'contractor_installment' | 'customer_installment' | 'leave_request' | 'receipt' | 'purchase_order';

export async function attachDocumentToEntity(
  entityType: EntityType,
  entityId: string,
  fileUrl: string,
  fileName: string,
  attachedBy: string,
  notes?: string
) {
  const { data, error } = await supabase.from("entity_documents").insert({
    entity_type: entityType,
    entity_id: entityId,
    file_url: fileUrl,
    file_name: fileName,
    attached_by: attachedBy,
    notes: notes ?? null,
  }).select().single();
  return { data, error };
}

export async function getEntityDocuments(entityType: EntityType, entityId: string) {
  const { data } = await supabase.from("entity_documents")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  return (data ?? []) as { id: string; file_url: string | null; file_name: string | null; attached_by: string | null; notes: string | null; created_at: string }[];
}
