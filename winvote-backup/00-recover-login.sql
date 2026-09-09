-- ============================================================
-- WinVote — สคริปต์กู้คืน "login + schema" หลัง DB ถูก pause/wipe (free tier)
-- ผลเลือกตั้ง + ผู้รับผิดชอบ = ข้อมูลนิ่ง อยู่ในไฟล์ public/winvote/election-data.json แล้ว (ไม่หาย)
-- ไฟล์นี้กู้เฉพาะสิ่งที่ต้องใช้ DB จริง ๆ = auth (บัญชีล็อกอิน) + schema exposure
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run  (idempotent รันซ้ำได้)
-- Project: gfnelofmgzqfwvlbaabd (WinVote) เท่านั้น — อย่ารันกับ AVIVA ONE
-- ============================================================

create schema if not exists winvote;
grant usage on schema winvote to authenticated, service_role, anon;
create extension if not exists pgcrypto;
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, winvote';
notify pgrst, 'reload config';

create or replace function winvote.is_admin() returns boolean
language sql stable set search_path='' as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') in ('admin','exec','ceo'), false);
$$;

-- บัญชีล็อกอิน (รหัสทุกบัญชี = Demo1234) — role อยู่ใน app_metadata (แก้เองไม่ได้)
-- ตั้ง token columns เป็น '' กัน GoTrue อ่าน NULL ไม่ได้ (ล็อกอินไม่ผ่าน)
do $$
declare rec record; uid uuid;
  accounts jsonb := '[
    {"email":"demo.admin@winvote.local","name":"ผู้ดูแลระบบ","role":"admin","dept":"ส่วนกลาง"},
    {"email":"demo.district1@winvote.local","name":"หัวหน้าเขต 1","role":"manager","dept":"เขตเลือกตั้ง 1"},
    {"email":"demo.district2@winvote.local","name":"หัวหน้าเขต 2","role":"manager","dept":"เขตเลือกตั้ง 2"},
    {"email":"demo.district3@winvote.local","name":"หัวหน้าเขต 3","role":"manager","dept":"เขตเลือกตั้ง 3"},
    {"email":"demo.district4@winvote.local","name":"หัวหน้าเขต 4","role":"manager","dept":"เขตเลือกตั้ง 4"}
  ]'::jsonb;
begin
  for rec in select * from jsonb_array_elements(accounts) as a(obj) loop
    if exists (select 1 from auth.users where email = rec.obj->>'email') then continue; end if;
    uid := gen_random_uuid();
    insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
    values (uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      rec.obj->>'email', crypt('Demo1234', gen_salt('bf')), now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role',rec.obj->>'role'),
      jsonb_build_object('full_name',rec.obj->>'name','role',rec.obj->>'role','department',rec.obj->>'dept'),
      now(),now(),'','','','','','','','');
    insert into auth.identities (id,user_id,provider_id,provider,identity_data,last_sign_in_at,created_at,updated_at)
    values (gen_random_uuid(),uid,rec.obj->>'email','email',
      jsonb_build_object('sub',uid::text,'email',rec.obj->>'email','email_verified',true), now(),now(),now());
  end loop;
end $$;

select email, raw_app_meta_data->>'role' as role from auth.users where email like 'demo.%@winvote.local' order by email;

-- ===== ความปลอดภัย: audit log + single-session (กู้คืนหลัง wipe) =====
create table if not exists winvote.access_log (
  id uuid primary key default gen_random_uuid(), user_id uuid, email text,
  action text not null, ip text, user_agent text, meta jsonb, at timestamptz not null default now());
create index if not exists winvote_access_at on winvote.access_log(at desc);
alter table winvote.access_log enable row level security;
grant select, insert on winvote.access_log to authenticated, service_role;
drop policy if exists access_insert on winvote.access_log;
create policy access_insert on winvote.access_log for insert to authenticated with check (true);
drop policy if exists access_admin_read on winvote.access_log;
create policy access_admin_read on winvote.access_log for select to authenticated using (winvote.is_admin());
create table if not exists winvote.user_session (
  user_id uuid primary key, email text, session_id text not null, ip text, user_agent text, updated_at timestamptz not null default now());
alter table winvote.user_session enable row level security;
grant select, insert, update, delete on winvote.user_session to authenticated, service_role;
drop policy if exists session_rw on winvote.user_session;
create policy session_rw on winvote.user_session for all to authenticated
  using (user_id = auth.uid() or winvote.is_admin()) with check (user_id = auth.uid());
