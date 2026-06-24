-- ตาราง sla_alert_history — บันทึกประวัติการแจ้ง SLA breach
-- เก็บทีละเกร็ดต่อเรื่อง + ช่วงเวลา เพื่อ track ว่า escalation เกิดขึ้นเมื่อไหร่
create table if not exists public.sla_alert_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  house_id uuid,  -- ที่โครงการ
  alert_level text not null  -- warning, critical, severe
    check (alert_level in ('warning', 'critical', 'severe')),
  days_late numeric,  -- เป็นวันหนึ่งไปแล้ว
  message text,  -- เนื้อหาแจ้งเตือน
  notified_roles text[] default array[]::text[],  -- ['project_manager', 'director', 'engineer']
  alert_sent_at timestamptz not null default now()
);

create index if not exists idx_sla_alert_house
  on public.sla_alert_history(project_id, house_id, alert_sent_at desc);
create index if not exists idx_sla_alert_time
  on public.sla_alert_history(project_id, alert_sent_at desc);

alter table public.sla_alert_history enable row level security;

-- RLS: read for managers/admins
drop policy if exists sla_alert_select on public.sla_alert_history;
create policy sla_alert_select on public.sla_alert_history
  for select to authenticated using (project_id = 'aaaaaaaa-0000-0000-0000-000000000001');
