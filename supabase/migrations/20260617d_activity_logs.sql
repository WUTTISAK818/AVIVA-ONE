-- สมุดบันทึกกิจกรรมระหว่างวัน (ใครทำอะไร) แยกตามแผนก + คุมสิทธิ์ (RLS)
-- ผู้บริหารเห็นทุกฝ่าย / พนักงานเห็นของตัวเอง+แผนกตัวเอง / แก้-ลบเฉพาะของตัวเอง
CREATE TABLE IF NOT EXISTS activity_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001',
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  user_name     text,
  department    text,
  activity_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,
  activity_time time,
  category      text,
  title         text NOT NULL,
  detail        text,
  photo_url     text,
  source        text NOT NULL DEFAULT 'manual',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs (activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_dept_date ON activity_logs (department, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON activity_logs (user_id, activity_date DESC);

CREATE OR REPLACE FUNCTION is_manager_jwt() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(auth.jwt()->'app_metadata'->>'role',''),
                  NULLIF(auth.jwt()->'user_metadata'->>'role',''), '')
         IN ('admin','ceo','coo','manager','director','project_manager');
$$;
CREATE OR REPLACE FUNCTION jwt_department() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(auth.jwt()->'app_metadata'->>'department',''),
                  NULLIF(auth.jwt()->'user_metadata'->>'department',''));
$$;

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_select ON activity_logs FOR SELECT TO authenticated
  USING (is_manager_jwt() OR user_id = auth.uid() OR (department IS NOT NULL AND department = jwt_department()));
CREATE POLICY activity_insert ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY activity_update ON activity_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_manager_jwt());
CREATE POLICY activity_delete ON activity_logs FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_manager_jwt());
