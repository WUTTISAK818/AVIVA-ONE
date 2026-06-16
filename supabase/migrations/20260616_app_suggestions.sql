-- ข้อเสนอแนะการทำงาน/ปรับปรุงแอป จากผู้ใช้ทุกคน → ผู้บริหารอนุมัติ → คิวผู้พัฒนา
-- บันทึก: ใครเสนอ / เสนออะไร / วันที่ + เวลา (created_at)
create table if not exists public.app_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  submitter text,
  submitter_email text,
  submitter_dept text,
  category text not null default 'ปรับปรุงการทำงาน',
  title text not null,
  detail text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','done')),
  reviewer text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_suggestions_status on public.app_suggestions(project_id, status, created_at desc);

alter table public.app_suggestions enable row level security;

drop policy if exists authenticated_read_sugg on public.app_suggestions;
create policy authenticated_read_sugg on public.app_suggestions
  for select to authenticated using (true);

drop policy if exists authenticated_insert_sugg on public.app_suggestions;
create policy authenticated_insert_sugg on public.app_suggestions
  for insert to authenticated with check (true);

drop policy if exists authenticated_update_sugg on public.app_suggestions;
create policy authenticated_update_sugg on public.app_suggestions
  for update to authenticated using (true) with check (true);
