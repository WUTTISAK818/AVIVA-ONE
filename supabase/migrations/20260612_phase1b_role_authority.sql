-- ================================================================
-- AVIVA ONE — Phase 1b: Role authority enforcement (DB) + finance threshold
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- role สำหรับสิทธิ์อยู่ใน auth metadata (สะอาด: admin/ceo/manager/director/...)
-- helper อ่าน role + ขยาย maker-checker trigger ให้เช็คสิทธิ์ผู้อนุมัติ
-- ปลอดภัย: ข้าม service-role + ข้ามถ้า role null + ไม่เช็ควงเงิน (escalation จัดการเอง)
-- ================================================================

create or replace function public.auth_user_role(uid uuid)
returns text language sql security definer stable as $$
  select raw_user_meta_data->>'role' from auth.users where id = uid;
$$;

create or replace function public.enforce_approval_maker_checker()
returns trigger language plpgsql as $$
declare
  approver_role text;
begin
  if NEW.action_taken in ('Approved','Rejected')
     and coalesce(OLD.action_taken,'Pending') = 'Pending'
     and auth.uid() is not null then
    if NEW.submitted_by_user_id is not null
       and auth.uid() = NEW.submitted_by_user_id then
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

-- (โค้ดฝั่งแอป) finance: เกณฑ์เข้าอนุมัติ 100k -> 50k (สอดคล้อง matrix 50k/500k)
