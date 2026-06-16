-- ================================================================
-- AVIVA ONE — Phase 2b (CRITICAL): ปิดช่อง anon เรียก admin user functions
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- admin_create_user/admin_delete_user/admin_list_users เป็น SECURITY DEFINER
-- ไม่มี authorization guard ภายใน + เดิม anon (public anon key ฝังในเว็บ) เรียกได้
--   => ใครก็สร้าง user role='admin' / ลบ auth user / ดูด PII ผู้ใช้ทั้งหมดได้
-- frontend ไม่เรียกฟังก์ชันเหล่านี้เลย (ตรวจซอร์สแล้ว) -> revoke ปลอดภัย
-- service_role/postgres ยังเรียกได้ (admin tooling / Supabase dashboard)
-- ================================================================
revoke execute on function public.admin_create_user(text,text,text,text,text) from anon, authenticated, public;
revoke execute on function public.admin_delete_user(uuid) from anon, authenticated, public;
revoke execute on function public.admin_list_users() from anon, authenticated, public;
