-- ============================================================
-- WinVote — สร้างผู้ใช้สำหรับล็อกอินจริง (รันเมื่อ DB ตื่นแล้ว)
-- Project: gfnelofmgzqfwvlbaabd (WinVote)
-- วิธีรัน: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
--          (หรือผ่าน MCP execute_sql เมื่อ project กลับมา ACTIVE)
-- ------------------------------------------------------------
-- หมายเหตุ:
--   • รหัสผ่านทุกบัญชี = Demo1234 (ตรงกับหน้า login)
--   • role เก็บใน raw_user_meta_data → หน้าแอปอ่านจาก user_metadata.role
--   • WinVote ให้สิทธิ์เฉพาะ role: admin / manager (ดู user-context.tsx)
--   • รันซ้ำได้ (idempotent) — ถ้ามีอีเมลอยู่แล้วจะข้าม
-- ============================================================

-- ต้องมี extension pgcrypto สำหรับ crypt()/gen_salt()
create extension if not exists pgcrypto;

do $$
declare
  rec record;
  uid uuid;
  accounts jsonb := '[
    {"email":"demo.admin@aviva.th",        "name":"ผู้ดูแลระบบ",      "role":"admin",   "dept":"ฝ่ายบริหาร"},
    {"email":"demo.sales@aviva.th",        "name":"หัวหน้านายหน้า",   "role":"manager", "dept":"ฝ่ายขาย"},
    {"email":"demo.finance@aviva.th",      "name":"หัวหน้าการเงิน",   "role":"manager", "dept":"ฝ่ายการเงิน"},
    {"email":"demo.construction@aviva.th", "name":"หัวหน้าก่อสร้าง",  "role":"manager", "dept":"ฝ่ายก่อสร้าง"},
    {"email":"demo.accounting@aviva.th",   "name":"หัวหน้าบัญชี",     "role":"manager", "dept":"ฝ่ายบัญชี"},
    {"email":"demo.hr@aviva.th",           "name":"หัวหน้าบุคคล",     "role":"manager", "dept":"ฝ่ายบุคคล"},
    {"email":"demo.marketing@aviva.th",    "name":"หัวหน้าการตลาด",   "role":"manager", "dept":"ฝ่ายการตลาด"},
    {"email":"demo.aftersales@aviva.th",   "name":"หัวหน้าหลังการขาย","role":"manager", "dept":"ฝ่ายหลังการขาย"}
  ]'::jsonb;
begin
  for rec in select * from jsonb_array_elements(accounts) as a(obj)
  loop
    -- ข้ามถ้ามีอีเมลนี้แล้ว
    if exists (select 1 from auth.users where email = rec.obj->>'email') then
      continue;
    end if;

    uid := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      rec.obj->>'email',
      crypt('Demo1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', rec.obj->>'name',
        'role',      rec.obj->>'role',
        'department',rec.obj->>'dept'
      ),
      now(), now()
    );

    -- identity สำหรับ provider email (จำเป็นกับ GoTrue เวอร์ชันใหม่)
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, rec.obj->>'email', 'email',
      jsonb_build_object('sub', uid::text, 'email', rec.obj->>'email', 'email_verified', true),
      now(), now(), now()
    );
  end loop;
end $$;

-- ตรวจผล
select email, raw_user_meta_data->>'role' as role, email_confirmed_at is not null as confirmed
from auth.users
where email like 'demo.%@aviva.th'
order by email;
