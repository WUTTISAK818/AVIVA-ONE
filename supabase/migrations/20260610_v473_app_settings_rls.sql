-- v4.73: ให้ระบบทำงานได้แม้ไม่มี SUPABASE_SERVICE_ROLE_KEY บน Vercel
-- เซิร์ฟเวอร์จะใช้ token ของผู้ใช้ที่ล็อกอิน (role = authenticated) แทน
-- จึงต้องเปิด RLS ของ app_settings ให้:
--   - authenticated อ่านได้ (เซิร์ฟเวอร์ต้องอ่าน API key ตอนพนักงานกดสร้างบรีฟ)
--   - เฉพาะผู้บริหารเขียนได้ (ผ่าน is_app_manager)
-- หมายเหตุ: anon ยังถูกบล็อกทั้งหมด — คนนอกที่ไม่ได้ล็อกอินอ่านไม่ได้

create or replace function public.is_app_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in ('admin','ceo','manager','director','project_manager')
  );
$$;

revoke all on function public.is_app_manager() from public;
grant execute on function public.is_app_manager() to authenticated;

drop policy if exists app_settings_auth_read on public.app_settings;
create policy app_settings_auth_read on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_manager_insert on public.app_settings;
create policy app_settings_manager_insert on public.app_settings
  for insert to authenticated with check (public.is_app_manager());

drop policy if exists app_settings_manager_update on public.app_settings;
create policy app_settings_manager_update on public.app_settings
  for update to authenticated
  using (public.is_app_manager())
  with check (public.is_app_manager());
