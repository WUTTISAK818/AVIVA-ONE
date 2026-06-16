-- เพิ่มวันที่ทำรายการจริง (txn_date) แยกจาก created_at (ลำดับ ledger ที่ห้ามแก้)
-- + เพิ่ม UPDATE policy ที่หายไป (เดิมมีแค่ select/insert ทำให้ "แก้ไข" ถูก RLS บล็อก)
alter table public.petty_cash_entries add column if not exists txn_date date;

update public.petty_cash_entries
  set txn_date = (created_at at time zone 'Asia/Bangkok')::date
  where txn_date is null;

drop policy if exists authenticated_update_petty on public.petty_cash_entries;
create policy authenticated_update_petty on public.petty_cash_entries
  for update to authenticated using (true) with check (true);
