-- ตาราง notification_reads — เก็บสถานะ "อ่านแล้ว" แบบต่อคนต่อแจ้งเตือน
-- คนละคนมีสถานะอ่านของตัวเอง ไม่กระทบคนอื่น (per-user read state)
create table if not exists public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique(notification_id, user_id)
);

create index if not exists idx_notification_reads_user
  on public.notification_reads(user_id, read_at desc);
create index if not exists idx_notification_reads_notification
  on public.notification_reads(notification_id);

alter table public.notification_reads enable row level security;

-- RLS: ผู้ใช้อ่านได้เฉพาะ read state ของตัวเอง
drop policy if exists notification_reads_select_own on public.notification_reads;
create policy notification_reads_select_own on public.notification_reads
  for select to authenticated using (user_id = auth.uid());

-- RLS: ผู้ใช้แทรกได้เฉพาะ read state ของตัวเอง
drop policy if exists notification_reads_insert_own on public.notification_reads;
create policy notification_reads_insert_own on public.notification_reads
  for insert to authenticated with check (user_id = auth.uid());
