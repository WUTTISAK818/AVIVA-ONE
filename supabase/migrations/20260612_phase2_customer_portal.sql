-- ================================================================
-- AVIVA ONE — Phase 2: Customer Portal (ลูกค้าดูสถานะเอง)
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP apply_migration
-- ================================================================
-- บริบท: ลูกค้าไม่มีช่องทางดูสถานะเอง (ความคืบหน้าก่อสร้าง/งวดเงิน/นัดโอน)
-- เพิ่ม: portal_token (เดาไม่ได้) ต่อลูกค้า → ลิงก์ /customer/[token]
--   หน้าอ่านอย่างเดียวผ่าน service-role (ไม่ต้องล็อกอิน) แชร์ผ่าน LINE ได้
-- ================================================================

alter table public.leads add column if not exists portal_token uuid default gen_random_uuid();
update public.leads set portal_token = gen_random_uuid() where portal_token is null;
create unique index if not exists idx_leads_portal_token on public.leads(portal_token);
