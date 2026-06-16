-- ================================================================
-- AVIVA ONE — Phase 1c: harden Phase-1b functions (search_path + grants)
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- auth_user_role เป็น SECURITY DEFINER + เดิม anon เรียกได้ + search_path mutable
-- => fix search_path (กัน privilege-escalation) + ตัดสิทธิ์ anon/public
-- ================================================================
create or replace function public.auth_user_role(uid uuid)
returns text language sql security definer stable
set search_path = '' as $$
  select raw_user_meta_data->>'role' from auth.users where id = uid;
$$;
revoke execute on function public.auth_user_role(uuid) from anon, public;
grant execute on function public.auth_user_role(uuid) to authenticated;

create or replace function public.enforce_approval_maker_checker()
returns trigger language plpgsql
set search_path = '' as $$
declare approver_role text;
begin
  if NEW.action_taken in ('Approved','Rejected')
     and coalesce(OLD.action_taken,'Pending') = 'Pending'
     and auth.uid() is not null then
    if NEW.submitted_by_user_id is not null and auth.uid() = NEW.submitted_by_user_id then
      raise exception 'Maker-Checker: ผู้อนุมัติต้องไม่ใช่ผู้ยื่นคำขอ';
    end if;
    approver_role := public.auth_user_role(auth.uid());
    if approver_role is not null
       and approver_role not in ('admin','ceo','manager','director','project_manager') then
      raise exception 'สิทธิ์ไม่พอ: เฉพาะผู้จัดการ/ผู้บริหารอนุมัติได้';
    end if;
  end if;
  return NEW;
end;
$$;
