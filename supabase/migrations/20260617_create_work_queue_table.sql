-- ตาราง work_queue — กล่องงานแบบแผนก + role (ผู้จัดการ, ฝ่ายการเงิน, ผู้บริหาร)
-- ใช้สำหรับ track งานที่กำลังค้างลงนาม/อนุมัติต่างๆ + SLA tracking
create table if not exists public.work_queue (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  workflow_type text not null,  -- Installment_Review, Finance_Approval, Purchase_Request, etc.
  source_record_id uuid not null,  -- FK ไปยัง record ที่ต้องประมวลผล (construction_unit_progress.id, purchase_requests.id, etc.)
  doc_index text,  -- เลขที่เอกสาร (PR-2024-00001, INS-2024-00123, etc.)
  title text not null,  -- display name เมื่อแสดงในกล่องงาน
  amount numeric,  -- จำนวนเงิน (สำหรับสถิติ + SLA escalation)
  assigned_role text not null,  -- ใครต้องทำ (manager, admin, finance, engineer, etc.)
  status text not null default 'open'
    check (status in ('open', 'done', 'escalated')),
  sla_due_at timestamptz,  -- deadline เมื่อต้องเสร็จ
  done_at timestamptz,     -- when closed/completed
  done_by text,            -- who marked as done
  created_at timestamptz not null default now()
);

create index if not exists idx_work_queue_project_status
  on public.work_queue(project_id, status, created_at desc);
create index if not exists idx_work_queue_assigned_role
  on public.work_queue(project_id, assigned_role, status);
create index if not exists idx_work_queue_sla_due
  on public.work_queue(project_id, sla_due_at)
  where status = 'open';

alter table public.work_queue enable row level security;

-- RLS: authenticated users read (filtered by role in app)
drop policy if exists work_queue_select on public.work_queue;
create policy work_queue_select on public.work_queue
  for select to authenticated using (project_id = 'aaaaaaaa-0000-0000-0000-000000000001');

-- RLS: insert/update โดยระบบเท่านั้น
drop policy if exists work_queue_insert on public.work_queue;
create policy work_queue_insert on public.work_queue
  for insert to authenticated with check (false);

drop policy if exists work_queue_update on public.work_queue;
create policy work_queue_update on public.work_queue
  for update to authenticated using (false);
