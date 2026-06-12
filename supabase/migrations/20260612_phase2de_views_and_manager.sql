-- ================================================================
-- AVIVA ONE — Phase 2d+2e
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- 2d: harden SECURITY DEFINER views (ไม่ถูกใช้ใน frontend)
alter view public.approval_overdue set (security_invoker = on);
alter view public.ledger_balances  set (security_invoker = on);
revoke all on public.approval_overdue from anon, authenticated;
revoke all on public.ledger_balances  from anon, authenticated;

-- 2e: is_app_manager() อ่าน role จาก auth metadata (เดิมอ่าน public.users ที่ messy)
create or replace function public.is_app_manager()
returns boolean language sql stable security definer
set search_path = '' as $$
  select public.auth_user_role(auth.uid())
         in ('admin','ceo','manager','director','project_manager');
$$;
revoke execute on function public.is_app_manager() from anon;
