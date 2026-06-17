-- เปิด realtime (postgres_changes) ให้ตารางหลัก — เดิม supabase_realtime publication ว่าง
-- ทำให้ฟีเจอร์ realtime ทั้งแอป (กระดิ่ง/กล่องงาน/แผนผัง CRM) ไม่ได้รับ event สดจริง
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads','houses','notifications','work_queue','approval_logs',
    'contractor_installments','activity_logs'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
