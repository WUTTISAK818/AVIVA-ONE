-- ระบบขออนุมัติก่อนซื้อ (Purchase Request) — เกณฑ์อนุมัติ 2,000 บาท
-- ขั้นตอน: เปิดคำขอ + ราคา → (≥2,000 ต้องอนุมัติ) → ผู้บริหารอนุมัติ → การเงินบันทึกจ่าย + ลงบัญชี
create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  pr_number text,
  category text not null default 'อื่น ๆ',
  item text not null,
  reason text,
  estimated_amount numeric not null default 0 check (estimated_amount >= 0),
  quote_url text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','purchased')),
  requester text,
  requester_dept text,
  approver text,
  approved_at timestamptz,
  reject_reason text,
  paid_amount numeric,
  paid_at timestamptz,
  paid_by text,
  needs_approval boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_pr_status on public.purchase_requests(project_id, status, created_at desc);

alter table public.purchase_requests enable row level security;

drop policy if exists authenticated_read_pr on public.purchase_requests;
create policy authenticated_read_pr on public.purchase_requests
  for select to authenticated using (true);

drop policy if exists authenticated_insert_pr on public.purchase_requests;
create policy authenticated_insert_pr on public.purchase_requests
  for insert to authenticated with check (true);

drop policy if exists authenticated_update_pr on public.purchase_requests;
create policy authenticated_update_pr on public.purchase_requests
  for update to authenticated using (true) with check (true);
