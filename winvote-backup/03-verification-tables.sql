-- ============================================================
-- WinVote — fields + ตารางสำหรับ verification / lifecycle / reconciliation
-- รองรับ: capture mode, roll status, บัญชีพิเศษ, dedup contested, เจตนา,
--          วงจรชีวิต (attrition) + audit log, กระทบยอดรายงวด
-- รันหลัง 02-rls-district-scoping.sql — ทดสอบก่อนใช้จริง
-- ============================================================

-- 1) เพิ่ม field ลง residents
alter table winvote.residents
  add column if not exists capture_method   text check (capture_method in ('chip','photo','manual')),
  add column if not exists roll_status      text check (roll_status in ('in_unit','other_unit','not_found')),
  add column if not exists list_type        text not null default 'main'   check (list_type in ('main','special')),
  add column if not exists claim_status     text not null default 'owned'  check (claim_status in ('owned','duplicate_contested')),
  add column if not exists intent_status    text not null default 'pending' check (intent_status in ('confirmed','pending','rejected')),
  add column if not exists status           text not null default 'active' check (status in ('active','disqualified','withdrawn','pending')),
  add column if not exists status_reason    text,
  add column if not exists last_confirmed_at timestamptz,
  add column if not exists synced           boolean not null default true;

-- 2) dedup: เปลี่ยนจาก unique เด็ดขาด -> partial unique เฉพาะตัว 'owned'
--    (เก็บตัวซ้ำ duplicate_contested ไว้ได้ ไม่ถูกปฏิเสธ ตามดีไซน์ §7)
alter table winvote.residents drop constraint if exists residents_national_id_key;
create unique index if not exists winvote_residents_owned_nid
  on winvote.residents(national_id)
  where claim_status = 'owned' and national_id is not null;
-- index ช่วยงานเจ้าของ (captured_at ก่อน = เจ้าของ) + ค้นซ้ำ
create index if not exists winvote_residents_captured on winvote.residents(captured_at);
create index if not exists winvote_residents_phone   on winvote.residents(phone);

-- 3) audit log การเปลี่ยนสถานะ (ห้ามลบจริง — soft status + ประวัติ)
create table if not exists winvote.resident_status_log (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references winvote.residents(id) on delete cascade,
  from_status text,
  to_status   text not null,
  reason      text,
  by_user     text,
  at          timestamptz not null default now()
);
create index if not exists winvote_status_log_resident on winvote.resident_status_log(resident_id);

-- 4) กระทบยอดรายงวด (เซ็นรับสองฝั่ง) — funnel เก็บเป็น snapshot ตอนปิดยอด
create table if not exists winvote.reconciliation_snapshot (
  member_id        uuid not null references winvote.members(id) on delete cascade,
  period           text not null,                 -- เช่น '2026-W26'
  captured  int not null default 0,
  synced    int not null default 0,
  accepted  int not null default 0,
  confirmed int not null default 0,
  gross     int not null default 0,
  effective int not null default 0,
  leader_signoff   boolean not null default false,
  central_approved boolean not null default false,
  at        timestamptz not null default now(),
  primary key (member_id, period)
);

-- 5) RLS + grants ตารางใหม่
alter table winvote.resident_status_log     enable row level security;
alter table winvote.reconciliation_snapshot enable row level security;
grant select, insert, update, delete on winvote.resident_status_log     to authenticated, service_role;
grant select, insert, update, delete on winvote.reconciliation_snapshot to authenticated, service_role;
-- (policy แยกเขตของ 2 ตารางนี้ผูกผ่าน resident/member — เพิ่มภายหลังตามรูปแบบใน 02-*)

-- หมายเหตุ trust_score: ไม่เก็บเป็น column (กัน stale) — คำนวณเป็น view/generated ภายหลัง
--   = identity (chip/in_roll) + presence (selfie/GPS) + intent (confirmed)
