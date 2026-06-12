-- =====================================================================
--  AVIVA ONE — Phase 2 migration
--  Project: lpxerxxcbxwsjimzougk (ap-southeast-1)
--
--  Run this whole file once in the Supabase SQL Editor
--  (Dashboard ▸ SQL Editor ▸ New query ▸ paste ▸ Run).
--  It is idempotent — safe to re-run.
--
--  Sections:
--    1. DDL  — new columns on construction_logs + qc_defects
--    2. Backfill due_date for existing defects
--    3. Seed — Phase-2 audit defects (A02 / V31 / A01)
--    4. RLS  — let the app (anon key) read/write these two tables
-- =====================================================================

-- ----------------------------------------------------------------------
-- 1. DDL
-- ----------------------------------------------------------------------

-- construction_logs : draft → submit-for-approval workflow
alter table public.construction_logs add column if not exists notes         text;
alter table public.construction_logs add column if not exists draft_report  text;
alter table public.construction_logs add column if not exists submit_status text default 'draft';
alter table public.construction_logs add column if not exists submitted_by  text;
alter table public.construction_logs add column if not exists submitted_at  timestamptz;

alter table public.construction_logs drop constraint if exists construction_logs_submit_status_chk;
alter table public.construction_logs add  constraint construction_logs_submit_status_chk
  check (submit_status in ('draft', 'submitted', 'approved'));

-- qc_defects : severity / SLA / escalation
alter table public.qc_defects add column if not exists severity  text    default 'medium';
alter table public.qc_defects add column if not exists sla_days  integer default 7;
alter table public.qc_defects add column if not exists due_date  date;
alter table public.qc_defects add column if not exists priority  integer default 3;
alter table public.qc_defects add column if not exists escalated boolean default false;

alter table public.qc_defects drop constraint if exists qc_defects_severity_chk;
alter table public.qc_defects add  constraint qc_defects_severity_chk
  check (severity in ('low', 'medium', 'high', 'critical'));

-- ----------------------------------------------------------------------
-- 2. Backfill due_date for rows that don't have one yet
--    (created_at + sla_days)
-- ----------------------------------------------------------------------
update public.qc_defects
   set due_date = (created_at::date + (coalesce(sla_days, 7) || ' days')::interval)::date
 where due_date is null;

-- ----------------------------------------------------------------------
-- 3. Seed — Phase-2 audit defects
--    house_id resolved by house_number so we never hard-code a UUID.
--    Mapping used (audit code -> house_number):
--      A02 -> 'A2 - AVA …'            (AVA unit 2)
--      V31 -> 'แปลงที่ 31 … / VIVA'   (VIVA plot 31)
--      A01 -> 'A1 - AVA …'            (AVA unit 1)
--    Deterministic ids -> re-running just refreshes the rows.
-- ----------------------------------------------------------------------
insert into public.qc_defects
  (id, house_id, defect_type, defect_detail, severity, sla_days, status, priority, escalated, created_at, due_date)
values
  ('22222222-1001-4001-b001-000000000001',
   (select id from public.houses where house_number ilike 'A2 - AVA%' limit 1),
   'หลังคา', 'หลังคารั่วหลังฝนตก', 'critical', 3, 'open', 1, false,
   now(), (current_date + 3)),

  ('22222222-1002-4002-b002-000000000002',
   (select id from public.houses where house_number ilike 'แปลงที่ 31%VIVA%' limit 1),
   'ระบบไฟฟ้า', 'ไฟฟ้าติดตั้งไม่เสร็จ ~80%', 'high', 5, 'in_progress', 2, false,
   now(), (current_date + 5)),

  ('22222222-1003-4003-b003-000000000003',
   (select id from public.houses where house_number ilike 'A1 - AVA%' limit 1),
   'งานทั่วไป', 'แปลง 30 มีข้อบกพร่องหลายจุด', 'medium', 7, 'open', 3, false,
   now(), (current_date + 7))
on conflict (id) do update set
  house_id      = excluded.house_id,
  defect_type   = excluded.defect_type,
  defect_detail = excluded.defect_detail,
  severity      = excluded.severity,
  sla_days      = excluded.sla_days,
  status        = excluded.status,
  priority      = excluded.priority,
  due_date      = excluded.due_date;

-- ----------------------------------------------------------------------
-- 4. RLS — allow the app to read & write these two tables.
--    This is an internal executive tool whose only credential is the
--    public anon key, so anon is treated as the app identity. If a
--    SUPABASE_SERVICE_ROLE_KEY is later added to .env.local, server-side
--    writes use it and bypass RLS anyway — these policies can then be
--    tightened without touching the app.
-- ----------------------------------------------------------------------
alter table public.construction_logs enable row level security;
alter table public.qc_defects        enable row level security;

drop policy if exists "app_read_construction_logs"   on public.construction_logs;
drop policy if exists "app_insert_construction_logs"  on public.construction_logs;
drop policy if exists "app_update_construction_logs"  on public.construction_logs;
create policy "app_read_construction_logs"   on public.construction_logs
  for select to anon, authenticated using (true);
create policy "app_insert_construction_logs"  on public.construction_logs
  for insert to anon, authenticated with check (true);
create policy "app_update_construction_logs"  on public.construction_logs
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "app_read_qc_defects"   on public.qc_defects;
drop policy if exists "app_update_qc_defects"  on public.qc_defects;
create policy "app_read_qc_defects"   on public.qc_defects
  for select to anon, authenticated using (true);
create policy "app_update_qc_defects"  on public.qc_defects
  for update to anon, authenticated using (true) with check (true);

-- done.
