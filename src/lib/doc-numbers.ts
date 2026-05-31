import { supabase } from "@/lib/supabase";

export type DocPrefix = "FIN" | "PO" | "INST" | "DOC" | "LEAVE" | "BOOK" | "CONTRACT" | "MKTG" | "WR";

const PREFIX_TO_WORKFLOW: Record<DocPrefix, string> = {
  FIN:      "Finance_Approval",
  PO:       "Material_Purchase",
  INST:     "Installment_Review",
  DOC:      "Document_Approval",
  LEAVE:    "Leave_Request",
  BOOK:     "Booking_Deposit",
  CONTRACT: "Contract_Approval",
  MKTG:     "Marketing_Budget",
  WR:       "Warranty_Claim",
};

/** Generates sequential doc numbers like FIN-2602-001 using atomic RPC with count-based fallback */
export async function generateDocNumber(prefix: DocPrefix): Promise<string> {
  const { data, error } = await supabase.rpc("next_doc_number", {
    p_workflow_type: PREFIX_TO_WORKFLOW[prefix],
  });
  if (!error && data) return data as string;

  // Fallback (non-atomic — race condition possible if RPC unavailable)
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { count } = await supabase
    .from("approval_logs")
    .select("*", { count: "exact", head: true })
    .like("source_doc_index", `${prefix}-${yymm}-%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}-${yymm}-${seq}`;
}
