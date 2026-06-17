-- ปิด security lint (Function Search Path Mutable): ตั้ง search_path คงที่
-- กัน schema hijack สำหรับฟังก์ชันออกเลขเอกสาร
ALTER FUNCTION public.next_doc_number(TEXT) SET search_path = public, pg_temp;
