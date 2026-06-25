-- ============================================================
-- WinVote — PDPA: บันทึกความยินยอม + นโยบายลบข้อมูล  [แก้ช่องวิกฤต C4 ส่วน DB]
-- เก็บเลขบัตร/รูป/GPS ของประชาชน ต้องมีฐานทางกฎหมาย (consent) + กำหนดเวลาลบ
-- รันบน project WinVote เมื่อ ACTIVE — ทดสอบก่อนใช้จริง
-- ============================================================

-- 1) บันทึกความยินยอม (ผูกกับ resident) — 1 คนยินยอมได้หลายเวอร์ชันประกาศ
create table if not exists winvote.consents (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references winvote.residents(id) on delete cascade,
  notice_version text not null,                  -- เวอร์ชันหนังสือแจ้ง/ขอความยินยอม
  lawful_basis text not null default 'consent',  -- ฐานทางกฎหมาย
  channel text,                                  -- line | onsite | sms ...
  granted boolean not null default true,         -- true=ยินยอม, false=ถอนความยินยอม
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  by_user text                                   -- ลูกทีม/สตาฟที่บันทึก
);
create index if not exists winvote_consents_resident on winvote.consents(resident_id);

alter table winvote.consents enable row level security;
grant select, insert, update, delete on winvote.consents to authenticated, service_role;

-- 2) นโยบายเก็บรักษา/ลบ (retention) — บันทึกกำหนดวันลบต่อการเลือกตั้ง
create table if not exists winvote.retention_policy (
  election text primary key,
  delete_after date not null,                    -- ลบข้อมูล PII หลังวันนี้
  note text,
  created_at timestamptz not null default now()
);

-- 3) ฟังก์ชันลบ PII ตามนโยบาย (เรียกจาก cron/edge function หลังเลือกตั้ง)
--    ลบเฉพาะข้อมูลอ่อนไหว คงสถิติรวมไว้ได้ (anonymize)
create or replace function winvote.purge_expired_pii() returns int
language plpgsql security definer as $$
declare n int := 0;
begin
  update winvote.residents r
     set national_id = null, date_of_birth = null, address = null, phone = null,
         selfie_path = null, capture_lat = null, capture_lng = null, line_user_id = null,
         full_name = 'ลบตามนโยบาย PDPA'
   from winvote.members m
   join winvote.communities c on c.id = m.community_id
   join winvote.districts d on d.id = c.district_id
  where r.member_id = m.id
    and exists (
      select 1 from winvote.retention_policy rp
      where rp.delete_after < current_date
    )
    and r.national_id is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- การใช้งาน:
--   • บันทึก consent ตอนเจ้าตัวกดยืนยันเจตนา (double opt-in) — granted=true + notice_version
--   • ถอนความยินยอม -> granted=false, withdrawn_at=now()
--   • ตั้ง retention_policy('2568', '<วันลบ>') แล้วตั้ง cron เรียก winvote.purge_expired_pii()
-- หมายเหตุ: การส่งรูปบัตรไป OpenAI (ข้ามประเทศ) ต้องมี DPA + ระบุใน notice — หรือย้าย OCR มา in-house
