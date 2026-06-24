-- Phase 1: Add FK Constraints + Auto-Trigger Logic
-- ตัดปัญหา: Approval ↔ Payment ↔ QC ↔ GL ไม่เชื่อมโยง

-- ================================
-- 1. สร้างตาราง GL Accounts (Master)
-- ================================
create table if not exists public.gl_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(project_id, account_code)
);

create index if not exists idx_gl_accounts_code
  on public.gl_accounts(project_id, account_code);

alter table public.gl_accounts enable row level security;

drop policy if exists gl_accounts_select on public.gl_accounts;
create policy gl_accounts_select on public.gl_accounts
  for select to authenticated using (project_id = 'aaaaaaaa-0000-0000-0000-000000000001');

-- ================================
-- 2. Add FK: payment_vouchers → approval_logs
-- ================================
alter table if exists public.payment_vouchers
  add column if not exists approval_log_id uuid references public.approval_logs(approval_id) on delete restrict;

create index if not exists idx_payment_vouchers_approval
  on public.payment_vouchers(approval_log_id);

-- ================================
-- 3. Add FK: qc_defects → contractor_installments
-- ================================
alter table if exists public.qc_defects
  add column if not exists contractor_installment_id uuid references public.contractor_installments(id) on delete cascade;

create index if not exists idx_qc_defects_installment
  on public.qc_defects(contractor_installment_id, status);

-- ================================
-- 4. Add FK: finance_transactions → approval_logs + GL Account
-- ================================
alter table if exists public.finance_transactions
  add column if not exists approval_log_id uuid references public.approval_logs(approval_id) on delete restrict,
  add column if not exists gl_account_id uuid references public.gl_accounts(id) on delete restrict;

create index if not exists idx_finance_transactions_approval
  on public.finance_transactions(approval_log_id);

create index if not exists idx_finance_transactions_gl
  on public.finance_transactions(gl_account_id);

-- ================================
-- 5. Trigger: Block approval if defects open
-- ================================
-- ข้อมูล: contractor_installments มี status เพื่อเก็บ 'pending' → 'approved' → 'paid'
-- เมื่อ approval_logs.action_taken = 'Approved' → check if qc_defects.status = 'open'

create or replace function public.fn_check_defects_before_approval()
returns trigger
language plpgsql
security definer
as $$
declare
  open_defects_count integer;
  installment_id uuid;
begin
  -- Check if this is an installment review approval
  if new.workflow_type = 'Installment_Review' and new.action_taken = 'Approved' then
    installment_id := new.source_record_id;

    -- Count open defects for this installment
    select count(*) into open_defects_count
    from public.qc_defects
    where contractor_installment_id = installment_id
      and status = 'open';

    if open_defects_count > 0 then
      raise exception 'ไม่สามารถอนุมัติ — มี % defects ที่ยังเปิดอยู่ ต้องแก้ไขก่อน', open_defects_count
        using hint = 'กรุณาปิด QC defects ทั้งหมดก่อนขอการอนุมัติ';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_defects_before_approval on public.approval_logs;
create trigger trg_check_defects_before_approval
  before update on public.approval_logs
  for each row
  when (new.action_taken is distinct from old.action_taken)
  execute function public.fn_check_defects_before_approval();

-- ================================
-- 6. Trigger: Auto-create payment_voucher on approval
-- ================================
create or replace function public.fn_auto_create_payment_on_approval()
returns trigger
language plpgsql
security definer
as $$
declare
  v_house_id uuid;
  v_contractor_id uuid;
  v_amount numeric;
  v_description text;
begin
  -- Only for Installment_Review approvals
  if new.workflow_type = 'Installment_Review' and new.action_taken = 'Approved' then
    -- ดึงข้อมูลจาก contractor_installments
    select
      ci.house_id,
      ci.contractor_id,
      ci.amount,
      'Payment for Installment Review - ' || ci.milestone_name
    into v_house_id, v_contractor_id, v_amount, v_description
    from public.contractor_installments ci
    where ci.id = new.source_record_id;

    if v_house_id is not null then
      -- Auto-create payment voucher linked to this approval
      insert into public.payment_vouchers (
        project_id,
        house_id,
        contractor_id,
        base_amount,
        approval_log_id,
        status,
        created_at
      ) values (
        new.project_id,
        v_house_id,
        v_contractor_id,
        v_amount,
        new.approval_id,
        'pending',
        now()
      )
      on conflict do nothing; -- Prevent duplicate if trigger fires multiple times
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_payment_on_approval on public.approval_logs;
create trigger trg_auto_payment_on_approval
  after update on public.approval_logs
  for each row
  when (new.action_taken = 'Approved' and new.action_taken is distinct from old.action_taken)
  execute function public.fn_auto_create_payment_on_approval();

-- ================================
-- 7. Trigger: Auto-post GL on Finance_Approval
-- ================================
-- ข้อมูล: approval_logs.amount มีเมื่อ workflow_type = 'Finance_Approval'
-- ต้อง map expense_category → gl_account_id

create or replace function public.fn_auto_post_gl_on_finance_approval()
returns trigger
language plpgsql
security definer
as $$
declare
  v_gl_account_id uuid;
  v_description text;
begin
  if new.workflow_type = 'Finance_Approval' and new.action_taken = 'Approved' then
    -- สมมติว่ามี Expense GL account (4100 = Expenses)
    select id into v_gl_account_id
    from public.gl_accounts
    where project_id = new.project_id
      and account_type = 'Expense'
      and is_active = true
    limit 1;

    if v_gl_account_id is not null then
      -- Auto-post GL entry
      insert into public.finance_transactions (
        project_id,
        approval_log_id,
        gl_account_id,
        amount,
        transaction_type,
        status,
        posted_at
      ) values (
        new.project_id,
        new.approval_id,
        v_gl_account_id,
        new.amount,
        'Expense',
        'posted',
        now()
      )
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_gl_on_finance_approval on public.approval_logs;
create trigger trg_auto_gl_on_finance_approval
  after update on public.approval_logs
  for each row
  when (new.action_taken = 'Approved' and new.action_taken is distinct from old.action_taken)
  execute function public.fn_auto_post_gl_on_finance_approval();

-- ================================
-- 8. Audit Log Table (บันทึกอนุมัติ)
-- ================================
create table if not exists public.approval_audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  approval_id uuid not null references public.approval_logs(approval_id) on delete cascade,
  action_type text not null check (action_type in ('created', 'approved', 'rejected', 'escalated')),
  actor text not null,
  old_status text,
  new_status text,
  reason text,
  created_at timestamptz default now()
);

create index if not exists idx_approval_audit_log_approval
  on public.approval_audit_log(project_id, approval_id, created_at desc);

alter table public.approval_audit_log enable row level security;

drop policy if exists approval_audit_log_select on public.approval_audit_log;
create policy approval_audit_log_select on public.approval_audit_log
  for select to authenticated using (project_id = 'aaaaaaaa-0000-0000-0000-000000000001');
