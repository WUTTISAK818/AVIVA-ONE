-- ================================================================
-- AVIVA ONE — Phase 2: Loan/สินเชื่อ tracking
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP apply_migration
-- ================================================================
-- บริบท: ดีลหลุดบ่อยช่วงยื่นกู้ — เดิมมีแค่ field loan_approved_date
-- เพิ่ม: ตารางติดตามการยื่นกู้หลายธนาคารต่อลูกค้า 1 ราย (สถานะ/วงเงิน/ผล)
-- ================================================================

create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  bank_name text not null,
  requested_amount numeric,
  approved_amount numeric,
  status text not null default 'submitted',   -- submitted | approved | rejected
  submitted_date date,
  result_date date,
  rejection_reason text,
  notes text,
  created_by text,
  created_at timestamptz default now()
);

alter table public.loan_applications enable row level security;

drop policy if exists loan_app_auth_all on public.loan_applications;
create policy loan_app_auth_all on public.loan_applications
  for all to authenticated using (true) with check (true);

create index if not exists idx_loan_app_lead on public.loan_applications(lead_id);
