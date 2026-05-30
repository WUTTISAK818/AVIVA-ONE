import { supabase } from "@/lib/supabase";

export type DocPrefix = "FIN" | "PO" | "INST" | "DOC" | "LEAVE" | "BOOK" | "CONTRACT" | "MKTG";

/** Generates sequential document numbers like FIN-2026-001 */
export async function generateDocNumber(prefix: DocPrefix): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("approval_logs")
    .select("*", { count: "exact", head: true })
    .like("source_doc_index", `${prefix}-${year}-%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}-${year}-${seq}`;
}
