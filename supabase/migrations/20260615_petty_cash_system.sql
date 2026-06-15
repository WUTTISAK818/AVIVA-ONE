-- ระบบเงินสดย่อย (Petty Cash) สำหรับค่าใช้จ่ายสำนักงานเล็ก ๆ น้อย ๆ
-- เช่น น้ำดื่ม/กาแฟบริการลูกค้า, น้ำยาทำความสะอาด, ล้างแอร์/ซ่อมสำนักงานเล็กน้อย
create table if not exists public.petty_cash_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  entry_type text not null check (entry_type in ('replenish','expense')),
  category text,
  description text not null,
  amount numeric not null check (amount > 0),
  balance_after numeric not null,
  receipt_url text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_petty_cash_created on public.petty_cash_entries(project_id, created_at desc);

alter table public.petty_cash_entries enable row level security;

drop policy if exists authenticated_read_petty on public.petty_cash_entries;
create policy authenticated_read_petty on public.petty_cash_entries
  for select to authenticated using (true);

drop policy if exists authenticated_insert_petty on public.petty_cash_entries;
create policy authenticated_insert_petty on public.petty_cash_entries
  for insert to authenticated with check (true);

-- ผังบัญชี: เพิ่มบัญชีเงินสดย่อย (สินทรัพย์) + ค่าใช้จ่ายสำนักงาน (ค่าใช้จ่าย)
insert into public.chart_of_accounts (code, name_th, account_type, parent_code, is_header, is_active)
values ('1130', 'เงินสดย่อย', 'asset', '1000', false, true)
on conflict (code) do nothing;

insert into public.chart_of_accounts (code, name_th, account_type, parent_code, is_header, is_active)
values ('6600', 'ค่าใช้จ่ายสำนักงาน', 'expense', '6000', false, true)
on conflict (code) do nothing;
