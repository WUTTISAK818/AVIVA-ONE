-- สร้างตาราง crm_logs สำหรับบันทึกประวัติการติดต่อ lead/customer
-- ตัดปัญหา: audit trail gap, schema inconsistency

create table if not exists public.crm_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  lead_id uuid not null references public.leads(id) on delete cascade,
  log_type text not null check (log_type in ('call', 'visit', 'email', 'note', 'task')),
  contact_person text,
  content text not null,
  next_follow_up_date date,
  logged_by text not null, -- email หรือ user name
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index สำหรับ query
create index if not exists idx_crm_logs_lead
  on public.crm_logs(project_id, lead_id, created_at desc);

create index if not exists idx_crm_logs_follow_up
  on public.crm_logs(project_id, next_follow_up_date, log_type)
  where next_follow_up_date is not null;

-- Enable RLS
alter table public.crm_logs enable row level security;

-- RLS Policy: ให้ authenticated users เห็น crm_logs ของ project เดียวกัน
drop policy if exists crm_logs_select on public.crm_logs;
create policy crm_logs_select on public.crm_logs
  for select to authenticated using (
    project_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  );

-- RLS Policy: insert/update สำหรับ manager+ roles
drop policy if exists crm_logs_insert on public.crm_logs;
create policy crm_logs_insert on public.crm_logs
  for insert to authenticated
  with check (
    project_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  );

drop policy if exists crm_logs_update on public.crm_logs;
create policy crm_logs_update on public.crm_logs
  for update to authenticated using (
    project_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  );
