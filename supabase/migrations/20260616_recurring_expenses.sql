-- ค่าใช้จ่ายประจำเดือน (ทะเบียน) + ประวัติการบันทึกจ่ายรายเดือน
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  name text not null,
  category text not null default 'อื่น ๆ',
  amount numeric not null default 0 check (amount >= 0),
  due_day int default 1 check (due_day between 1 and 31),
  capitalize boolean not null default false,  -- ดอกเบี้ยช่วงก่อสร้าง → ทุนเข้า WIP
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_recurring_active on public.recurring_expenses(project_id, is_active);

create table if not exists public.recurring_expense_postings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  recurring_id uuid not null references public.recurring_expenses(id) on delete cascade,
  period text not null,            -- 'YYYY-MM'
  amount numeric not null,
  capitalized boolean not null default false,
  jv_id uuid,
  posted_by text,
  posted_at timestamptz not null default now(),
  unique (recurring_id, period)
);

alter table public.recurring_expenses enable row level security;
alter table public.recurring_expense_postings enable row level security;

drop policy if exists rec_exp_read on public.recurring_expenses;
drop policy if exists rec_exp_ins on public.recurring_expenses;
drop policy if exists rec_exp_upd on public.recurring_expenses;
drop policy if exists rec_exp_del on public.recurring_expenses;
create policy rec_exp_read on public.recurring_expenses for select to authenticated using (true);
create policy rec_exp_ins on public.recurring_expenses for insert to authenticated with check (true);
create policy rec_exp_upd on public.recurring_expenses for update to authenticated using (true) with check (true);
create policy rec_exp_del on public.recurring_expenses for delete to authenticated using (true);

drop policy if exists rec_post_read on public.recurring_expense_postings;
drop policy if exists rec_post_ins on public.recurring_expense_postings;
create policy rec_post_read on public.recurring_expense_postings for select to authenticated using (true);
create policy rec_post_ins on public.recurring_expense_postings for insert to authenticated with check (true);

-- บัญชี GL ที่ค่าใช้จ่ายประจำต้องใช้
insert into public.chart_of_accounts (code, name_th, account_type, parent_code, is_header, is_active) values
  ('5300', 'ดอกเบี้ยจ่าย', 'expense', '5000', false, true),
  ('6400', 'ค่าสาธารณูปโภค', 'expense', '6000', false, true),
  ('6500', 'ค่าเช่า', 'expense', '6000', false, true),
  ('6900', 'ค่าเสื่อมราคา', 'expense', '6000', false, true),
  ('1290', 'ค่าเสื่อมราคาสะสม', 'asset', '1000', false, true)
on conflict (code) do nothing;
