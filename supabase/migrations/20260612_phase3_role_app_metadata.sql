-- ================================================================
-- AVIVA ONE — Phase 3: ย้ายแหล่ง role ของ RLS ไป app_metadata (ปลอดภัยจริง)
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- ปัญหา (advisor ERROR rls_references_user_metadata):
--   user_metadata ผู้ใช้แก้เองได้ (supabase.auth.updateUser({data:{role:'admin'}}))
--   -> escalate เป็น admin -> bypass RLS salary/finance/projects ได้
--   app_metadata เขียนได้เฉพาะ service_role -> ผู้ใช้แก้ไม่ได้ = ปลอดภัย
-- ================================================================

-- backfill (รันครั้งเดียว; idempotent)
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb)
    || jsonb_build_object('role', raw_user_meta_data->>'role',
                          'department', raw_user_meta_data->>'department')
where raw_user_meta_data ? 'role'
  and raw_app_meta_data->>'role' is distinct from raw_user_meta_data->>'role';

-- auth_user_role อ่าน app_metadata (fallback user_metadata เผื่อ transition)
create or replace function public.auth_user_role(uid uuid)
returns text language sql security definer stable
set search_path = '' as $$
  select coalesce(raw_app_meta_data->>'role', raw_user_meta_data->>'role')
  from auth.users where id = uid;
$$;

-- projects: เลิกอ่าน user_metadata ตรงๆ
drop policy if exists "Admin can update projects" on public.projects;
create policy "Admin can update projects" on public.projects for update to authenticated
  using  (public.auth_user_role(auth.uid()) in ('admin','ceo'))
  with check (public.auth_user_role(auth.uid()) in ('admin','ceo'));

-- หมายเหตุ: ผู้ใช้ใหม่ต้องตั้ง role ใน app_metadata (Dashboard > App Metadata หรือ service_role)
--           ห้าม auto-copy จาก user_metadata (จะเปิดช่อง escalate อีก)
