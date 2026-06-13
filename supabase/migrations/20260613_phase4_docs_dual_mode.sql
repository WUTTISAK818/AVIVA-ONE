-- ================================================================
-- AVIVA ONE — Phase 4 (เอกสาร 2 โหมด) ฐานกลาง — ขยาย entity_documents
-- วันที่: 13 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- รองรับทั้ง 'generated' (สร้างจากแอป) และ 'uploaded' (พนักงานแนบไฟล์)
-- ================================================================
alter table public.entity_documents
  add column if not exists source     text not null default 'uploaded',
  add column if not exists doc_type    text,
  add column if not exists doc_number  text;
comment on column public.entity_documents.source is 'generated = สร้างจากแอป, uploaded = พนักงานแนบไฟล์';
create index if not exists idx_entity_documents_lookup
  on public.entity_documents (entity_type, entity_id);
