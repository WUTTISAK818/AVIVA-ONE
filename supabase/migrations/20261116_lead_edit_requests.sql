-- v8.11→v8.12 · คำขอแก้ไขข้อมูลลูกค้า (Pom สั่ง 16 พ.ย. 69)
-- ขั้นตอน: พนักงานขอ (pending) → ผู้บริหารอนุมัติส่วนที่แก้ได้ + ระยะเวลา (editing)
--         → พนักงานแก้แล้วส่งตรวจ หรือครบเวลาระบบส่งเอง (submitted)
--         → ผู้บริหารตรวจ: อนุมัติ (approved) · ตีกลับให้แก้ใหม่ (editing อีกรอบ) · คืนค่าเดิม (reverted)
--         หรือผู้บริหารไม่อนุมัติคำขอตั้งแต่แรก (rejected) · ผู้ขอยกเลิกเอง (cancelled)
create table if not exists public.lead_edit_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  lead_id uuid not null references public.leads(id) on delete cascade,
  requested_by_email text not null,
  requested_by_name text,
  requested_groups text[] not null default '{}',
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending','editing','submitted','approved','rejected','reverted','cancelled')),
  allowed_groups text[] not null default '{}',
  edit_until timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  snapshot jsonb,            -- ค่าเดิมของทุกช่องในส่วนที่อนุญาต ณ ตอนอนุมัติ (ใช้เทียบ/คืนค่า)
  after_snapshot jsonb,      -- ค่าตอนส่งตรวจ
  submitted_at timestamptz,
  auto_submitted boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  return_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_edit_requests_lead_idx on public.lead_edit_requests (lead_id);
create index if not exists lead_edit_requests_status_idx on public.lead_edit_requests (status);

alter table public.lead_edit_requests enable row level security;

-- อ่าน: ผู้ขอเห็นของตัวเอง · ผู้บริหารเห็นทั้งหมด
create policy lead_edit_requests_select on public.lead_edit_requests for select to authenticated
  using (requested_by_email = ((select auth.jwt()) ->> 'email') or (select public.is_app_manager()));

-- ยื่นคำขอ: ต้องเป็นอีเมลตัวเอง และเริ่มที่ pending เท่านั้น
create policy lead_edit_requests_insert on public.lead_edit_requests for insert to authenticated
  with check (requested_by_email = ((select auth.jwt()) ->> 'email') and status = 'pending');

-- แก้สถานะ: ผู้บริหารทำได้ทุกขั้น · ผู้ขอทำได้เฉพาะ "ส่งตรวจ" ตอนอยู่ในช่วงแก้ไข และ "ยกเลิก" ตอนยังรออนุมัติ
create policy lead_edit_requests_update on public.lead_edit_requests for update to authenticated
  using ((select public.is_app_manager())
         or (requested_by_email = ((select auth.jwt()) ->> 'email') and status in ('pending','editing')))
  with check ((select public.is_app_manager())
         or (requested_by_email = ((select auth.jwt()) ->> 'email') and status in ('submitted','cancelled')));
