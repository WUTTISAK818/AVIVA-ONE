-- ============================================================
-- WinVote — บัญชีรายชื่อผู้มีสิทธิ์เลือกตั้ง (voter_roll)  [แก้ช่องวิกฤต C1]
-- ราชการส่งมาทุกครั้ง: เลข 13 หลัก + แยกเขต/หน่วย
-- ใช้เทียบ "ผู้มีสิทธิ์จริง / นอกเขต" + ดึงชื่อทางการ (สะกดถูก 100%)
-- รันบน project WinVote (gfnelofmgzqfwvlbaabd) เมื่อ ACTIVE — ทดสอบก่อนใช้จริง
-- ============================================================

create table if not exists winvote.voter_roll (
  id uuid primary key default gen_random_uuid(),
  election text not null default '2568',
  national_id text not null,
  full_name text not null,
  district_code int not null,
  polling_unit_no text not null,          -- เก็บแบบ '001' ให้ตรง polling_units.unit_no
  created_at timestamptz not null default now(),
  unique (election, national_id)
);
create index if not exists winvote_voter_roll_nid  on winvote.voter_roll(election, national_id);
create index if not exists winvote_voter_roll_unit on winvote.voter_roll(election, district_code, polling_unit_no);

alter table winvote.voter_roll enable row level security;
grant select, insert, update, delete on winvote.voter_roll to authenticated, service_role;
-- import บัญชีทำด้วย service_role; authenticated อ่านได้ (คุมเขตเพิ่มใน 02-rls-district-scoping.sql)
drop policy if exists voter_roll_read on winvote.voter_roll;
create policy voter_roll_read on winvote.voter_roll for select to authenticated using (true);

-- ฟังก์ชันเทียบบัญชี: คืน in_unit / other_unit / not_found + ชื่อทางการ
create or replace function winvote.check_voter_roll(
  p_national_id text, p_election text, p_district_code int, p_unit_no text
) returns table(roll_status text, official_name text, roll_district int, roll_unit text)
language sql stable security invoker as $$
  select
    case
      when vr.national_id is null then 'not_found'
      when vr.district_code = p_district_code and vr.polling_unit_no = p_unit_no then 'in_unit'
      else 'other_unit'
    end,
    vr.full_name, vr.district_code, vr.polling_unit_no
  from (select 1) d
  left join winvote.voter_roll vr
    on vr.election = p_election and vr.national_id = p_national_id;
$$;

-- การใช้งานในแอป (หน้าเก็บข้อมูล):
--   not_found  -> เตือน "ไม่มีสิทธิ์ครั้งนี้" ไม่บันทึก (เก็บแค่ตัวนับ)
--   other_unit -> บันทึกเข้า list_type='special' (บัญชีพิเศษ ไม่เสียเสียง)
--   in_unit    -> บันทึก list_type='main' + ใช้ official_name แทนชื่อจาก OCR
