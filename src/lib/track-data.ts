import "server-only";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface ContractorTrack {
  name: string;
  ref_code: string;
  houses: { plot_number: string | null; status: string | null; progress: number | null }[];
}

/** Public read-only lookup by ref_code via service role (no login). */
export async function getContractorTrack(refCode: string): Promise<ContractorTrack | null> {
  if (!refCode) return null;
  const db = admin();
  const { data: c } = await db.from("contractors").select("name, ref_code").eq("ref_code", refCode).maybeSingle();
  if (!c) return null;
  const { data: houses } = await db
    .from("houses")
    .select("plot_number, construction_status, construction_progress, contractor_line_id")
    .eq("contractor_line_id", refCode);
  const mapped = (houses ?? []).map((h: Record<string, unknown>) => ({
    plot_number: (h.plot_number as string) ?? null,
    status: (h.construction_status as string) ?? null,
    progress: (h.construction_progress as number) ?? null,
  }));
  return { name: c.name as string, ref_code: c.ref_code as string, houses: mapped };
}
