-- ================================================================
-- AVIVA ONE — Phase 2: Transfer/โอนกรรมสิทธิ์ checklist
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP apply_migration
-- ================================================================
-- บริบท: วันโอนมีงานต้นทุนสูงที่ตกหล่นบ่อย (ค่าโอน/ภาษี/จำนอง/มิเตอร์)
-- เพิ่ม: เช็กลิสต์วันโอนต่อลูกค้า (ติ๊กครบ + ใส่จำนวนเงินค่าธรรมเนียม)
-- ================================================================

create table if not exists public.transfer_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  item_key text not null,
  done boolean not null default false,
  amount numeric,
  note text,
  done_by text,
  updated_at timestamptz default now(),
  unique(lead_id, item_key)
);

alter table public.transfer_tasks enable row level security;

drop policy if exists transfer_tasks_auth_all on public.transfer_tasks;
create policy transfer_tasks_auth_all on public.transfer_tasks
  for all to authenticated using (true) with check (true);

create index if not exists idx_transfer_tasks_lead on public.transfer_tasks(lead_id);
