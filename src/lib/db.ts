import { supabase } from "./supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function getProject() {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", PROJECT_ID)
    .single();
  return data;
}

export async function getLeads() {
  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("project_id", PROJECT_ID)
    .order("created_at_default", { ascending: false });
  return data ?? [];
}

export async function getHouses() {
  const { data } = await supabase
    .from("houses")
    .select("*")
    .eq("project_id", PROJECT_ID)
    .order("house_number");
  return data ?? [];
}

export async function getTransactions() {
  const { data } = await supabase
    .from("finance_transactions")
    .select("*")
    .eq("project_id", PROJECT_ID)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export async function insertLead(lead: {
  customer_name: string;
  phone: string;
  budget: number;
  source: string;
  notes?: string;
}) {
  return supabase.from("leads").insert({
    ...lead,
    project_id: PROJECT_ID,
    status: "New Lead",
    ai_score: 0,
  });
}

export async function updateLeadStatus(id: string, status: string) {
  return supabase.from("leads").update({ status }).eq("id", id);
}
