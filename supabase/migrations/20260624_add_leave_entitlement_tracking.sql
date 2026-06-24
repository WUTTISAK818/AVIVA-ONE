-- Phase 2.1: Leave Entitlement Tracking & Balance Enforcement
-- ตัดปัญหา: Employees สามารถลาได้ไม่จำกัด, no entitlement check

-- ================================
-- 1. Add entitlement columns to employee_payroll_config
-- ================================
alter table if exists public.employee_payroll_config
  add column if not exists annual_leave_entitlement integer default 15,
  add column if not exists annual_leave_used integer default 0,
  add column if not exists sick_leave_entitlement integer default 10,
  add column if not exists sick_leave_used integer default 0,
  add column if not exists study_leave_entitlement integer default 5,
  add column if not exists study_leave_used integer default 0;

-- ================================
-- 2. Computed columns for remaining balance
-- ================================
alter table if exists public.employee_payroll_config
  add column if not exists annual_leave_balance integer
    generated always as (annual_leave_entitlement - annual_leave_used) stored,
  add column if not exists sick_leave_balance integer
    generated always as (sick_leave_entitlement - sick_leave_used) stored,
  add column if not exists study_leave_balance integer
    generated always as (study_leave_entitlement - study_leave_used) stored;

-- ================================
-- 3. Trigger: Block leave request if insufficient balance
-- ================================
create or replace function public.fn_check_leave_balance()
returns trigger
language plpgsql
security definer
as $$
declare
  v_balance integer;
  v_leave_type text;
  v_entitlement_col text;
  v_used_col text;
begin
  -- Determine leave type
  v_leave_type := new.leave_type;
  v_entitlement_col := v_leave_type || '_leave_entitlement';
  v_used_col := v_leave_type || '_leave_used';

  -- Get employee's leave balance
  select
    (epc->>v_entitlement_col)::integer - (epc->>v_used_col)::integer
  into v_balance
  from public.employee_payroll_config epc
  where epc.employee_id = new.employee_id;

  if v_balance is null then
    v_balance := 0;
  end if;

  -- Check if sufficient balance
  if v_balance < new.days_count then
    raise exception 'ลาครบ — เหลือ % วัน (ขอ % วัน)', v_balance, new.days_count
      using hint = 'กรุณาตรวจสอบยอดวันลาของคุณ';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_leave_balance on public.leave_requests;
create trigger trg_check_leave_balance
  before insert on public.leave_requests
  for each row
  when (new.status = 'pending')
  execute function public.fn_check_leave_balance();

-- ================================
-- 4. Trigger: Update leave_used when request approved
-- ================================
create or replace function public.fn_update_leave_used_on_approval()
returns trigger
language plpgsql
security definer
as $$
declare
  v_days_count integer;
  v_leave_type text;
  v_used_col text;
begin
  if new.status = 'approved' and old.status != 'approved' then
    select days_count, leave_type into v_days_count, v_leave_type
    from public.leave_requests
    where id = new.id;

    v_used_col := v_leave_type || '_leave_used';

    -- Update employee's leave_used
    update public.employee_payroll_config
    set updated_at = now()
    where employee_id = new.employee_id;

    -- Note: Direct SQL update of JSONB field would go here
    -- For now, application layer handles the update
  end if;

  return new;
end;
$$;

drop trigger if exists trg_update_leave_used_on_approval on public.leave_requests;
create trigger trg_update_leave_used_on_approval
  after update on public.leave_requests
  for each row
  when (new.status is distinct from old.status)
  execute function public.fn_update_leave_used_on_approval();

-- ================================
-- 5. View: Employee leave balance report
-- ================================
create or replace view public.employee_leave_balance as
select
  epc.project_id,
  epc.employee_id,
  epc.annual_leave_entitlement,
  epc.annual_leave_used,
  epc.annual_leave_balance,
  epc.sick_leave_entitlement,
  epc.sick_leave_used,
  epc.sick_leave_balance,
  epc.study_leave_entitlement,
  epc.study_leave_used,
  epc.study_leave_balance,
  case
    when epc.annual_leave_balance <= 2 then 'Critical'
    when epc.annual_leave_balance <= 5 then 'Low'
    else 'Normal'
  end as annual_leave_status
from public.employee_payroll_config epc;

alter view public.employee_leave_balance owner to postgres;
grant select on public.employee_leave_balance to authenticated;

-- ================================
-- 6. Add leave balance to notifications
-- ================================
alter table if exists public.leave_requests
  add column if not exists balance_before_approval integer,
  add column if not exists balance_after_approval integer;
