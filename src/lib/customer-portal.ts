import "server-only";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface CustomerInstallment {
  installment_no: number | null;
  name: string | null;
  amount: number | null;
  due_date: string | null;
  paid_date: string | null;
  status: string | null;
}

export interface CustomerPortal {
  project_name: string;
  customer_name: string;
  plot_number: number | null;
  house_model: string | null;
  status: string;
  contract_price: number | null;
  budget: number | null;
  progress: number | null;
  phase: string | null;
  planned_completion_date: string | null;
  milestones: { key: string; label: string; date: string | null }[];
  installments: CustomerInstallment[];
}

/** Public read-only ดูสถานะลูกค้าผ่าน portal_token (ไม่ต้องล็อกอิน) ผ่าน service role */
export async function getCustomerPortal(token: string): Promise<CustomerPortal | null> {
  if (!token) return null;
  const db = admin();
  const { data: lead } = await db
    .from("leads")
    .select("id,customer_name,plot_number,status,budget,contract_price,booking_date,contract_signed_date,loan_approved_date,delivery_date,transfer_date,project_id")
    .eq("portal_token", token)
    .maybeSingle();
  if (!lead) return null;
  const l = lead as Record<string, unknown>;

  let project_name = "AVIVA Private";
  const { data: proj } = await db.from("projects").select("project_name").eq("id", l.project_id as string).maybeSingle();
  if (proj && (proj as { project_name?: string }).project_name) project_name = (proj as { project_name: string }).project_name;

  let house: Record<string, unknown> | null = null;
  if (l.plot_number != null) {
    const { data: h } = await db
      .from("houses")
      .select("progress,phase,house_model,status,planned_completion_date")
      .eq("project_id", l.project_id as string)
      .eq("plot_number", l.plot_number as number)
      .maybeSingle();
    house = (h as Record<string, unknown>) ?? null;
  }

  const { data: insts } = await db
    .from("customer_installments")
    .select("installment_no,name,amount,due_date,paid_date,status")
    .eq("lead_id", l.id as string)
    .order("installment_no", { ascending: true });

  return {
    project_name,
    customer_name: (l.customer_name as string) ?? "",
    plot_number: (l.plot_number as number) ?? null,
    house_model: (house?.house_model as string) ?? null,
    status: (l.status as string) ?? "",
    contract_price: (l.contract_price as number) ?? null,
    budget: (l.budget as number) ?? null,
    progress: (house?.progress as number) ?? null,
    phase: (house?.phase as string) ?? null,
    planned_completion_date: (house?.planned_completion_date as string) ?? null,
    milestones: [
      { key: "booking", label: "จอง", date: (l.booking_date as string) ?? null },
      { key: "contract", label: "ทำสัญญา", date: (l.contract_signed_date as string) ?? null },
      { key: "loan", label: "อนุมัติสินเชื่อ", date: (l.loan_approved_date as string) ?? null },
      { key: "transfer", label: "โอนกรรมสิทธิ์", date: (l.transfer_date as string) ?? null },
    ],
    installments: (insts as CustomerInstallment[]) ?? [],
  };
}
