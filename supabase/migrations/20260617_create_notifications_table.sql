-- สร้างตาราง notifications — ระบบแจ้งเตือนแบบรวมศูนย์
-- Replace notification_log (legacy) ด้วยตาราง notifications ครอบคลุมทุกประเภทแจ้งเตือน
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  type text not null default 'info'
    check (type in ('approval', 'claim', 'document', 'success', 'info', 'ai_briefing', 'ai_meeting', 'workflow_update')),
  title text not null,
  message text,
  from_dept text,  -- ส่งมาจากแผนกไหน (เช่น "ฝ่ายก่อสร้าง", "ผู้บริหาร")
  to_dept text,    -- ส่งไปถึงแผนกไหน (เช่น "ฝ่ายการเงิน", "ฝ่ายขาย")
  is_read boolean not null default false,  -- global read status (legacy, for UI uniformity)
  record_id uuid,  -- FK ไปยัง source record (purchase_requests.id, approvals.id, etc.)
  link text,       -- direct navigation link (ปลายทาง URL เมื่อกดแจ้งเตือน)
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_project_created
  on public.notifications(project_id, created_at desc);
create index if not exists idx_notifications_dept
  on public.notifications(project_id, to_dept, created_at desc);

alter table public.notifications enable row level security;

-- RLS: ทุกคนอ่าน (filtered by app logic via to_dept/from_dept)
drop policy if exists notifications_select_all on public.notifications;
create policy notifications_select_all on public.notifications
  for select to authenticated using (project_id = 'aaaaaaaa-0000-0000-0000-000000000001');

-- RLS: insert โดยระบบเท่านั้น (service role) — ห้าม user insert เอง
drop policy if exists notifications_insert_system on public.notifications;
create policy notifications_insert_system on public.notifications
  for insert to authenticated with check (false);  -- users cannot insert; only service role can

-- RLS: update เฉพาะ is_read เท่านั้น (by individual per-user reads)
drop policy if exists notifications_update_read on public.notifications;
create policy notifications_update_read on public.notifications
  for update to authenticated using (true) with check (true);
