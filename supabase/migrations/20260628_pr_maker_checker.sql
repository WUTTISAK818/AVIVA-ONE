-- #2/#6 Maker-Checker สำหรับ Purchase Request
-- PR ไม่ผ่าน approval_logs (ใช้ work_queue ตรง ๆ) จึงไม่โดน trigger enforce_approval_maker_checker
-- เพิ่ม requester_user_id + trigger ของตัวเอง เพื่อกัน "ผู้ยื่นอนุมัติคำขอตัวเอง"
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS requester_user_id uuid;

CREATE OR REPLACE FUNCTION public.enforce_pr_maker_checker()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
begin
  -- บล็อกเฉพาะตอน "อนุมัติ/ปฏิเสธ" (pending -> approved/rejected) โดยคนเดียวกับผู้ยื่น
  if NEW.status in ('approved','rejected')
     and coalesce(OLD.status,'pending') = 'pending'
     and auth.uid() is not null
     and NEW.requester_user_id is not null
     and auth.uid() = NEW.requester_user_id then
    raise exception 'Maker-Checker: ผู้อนุมัติต้องไม่ใช่ผู้ยื่นคำขอซื้อ';
  end if;
  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_pr_maker_checker ON public.purchase_requests;
CREATE TRIGGER trg_pr_maker_checker BEFORE UPDATE ON public.purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_pr_maker_checker();
