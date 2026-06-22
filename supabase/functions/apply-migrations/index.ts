import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Migration SQL statements
const migrations = {
  construction: `
-- Construction Activity Logging
CREATE OR REPLACE FUNCTION public.log_construction_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  SELECT house_model INTO v_house_model FROM public.houses WHERE id = NEW.id;
  IF NEW.updated_by IS NOT NULL THEN
    SELECT full_name, department INTO v_performer_name, v_performer_dept
    FROM auth.users WHERE id = NEW.updated_by;
  ELSE
    v_performer_name := 'System';
    v_performer_dept := 'Construction';
  END IF;
  IF NEW.progress != OLD.progress THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE, 'construction', 'progress', NEW.updated_by, v_performer_name,
      v_performer_dept, 'ความคืบหน้า ' || v_house_model || ': ' || NEW.progress || '% (ก่อนหน้า ' || OLD.progress || '%)',
      1, NULL, NEW.id, 'houses', NEW.project_id, NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS construction_progress_log ON public.houses;
CREATE TRIGGER construction_progress_log AFTER UPDATE ON public.houses
  FOR EACH ROW
  WHEN (NEW.progress IS DISTINCT FROM OLD.progress)
  EXECUTE FUNCTION public.log_construction_progress();

CREATE OR REPLACE FUNCTION public.log_qc_defect()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT house_model INTO v_house_model FROM public.houses WHERE id = NEW.house_id;
    IF NEW.created_by IS NOT NULL THEN
      SELECT full_name, department INTO v_performer_name, v_performer_dept
      FROM auth.users WHERE id = NEW.created_by;
    ELSE
      v_performer_name := 'System';
      v_performer_dept := 'QC';
    END IF;
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE, 'construction', 'qc_defect', NEW.created_by, v_performer_name,
      v_performer_dept, 'พบข้อบกพร่อง ' || v_house_model || ': ' || NEW.defect_description,
      1, NULL, NEW.id, 'qc_defects', (SELECT project_id FROM public.houses WHERE id = NEW.house_id),
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qc_defect_log ON public.qc_defects;
CREATE TRIGGER qc_defect_log AFTER INSERT ON public.qc_defects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_qc_defect();
  `,

  finance: `
-- Finance Activity Logging
CREATE OR REPLACE FUNCTION public.log_payment_voucher()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
  v_performer_id UUID;
BEGIN
  SELECT house_model INTO v_house_model FROM public.houses WHERE id = NEW.house_id;
  IF NEW.status = 'submitted' AND NEW.submitted_by IS NOT NULL THEN
    v_performer_id := NEW.submitted_by;
    SELECT full_name, department INTO v_performer_name, v_performer_dept
    FROM auth.users WHERE id = NEW.submitted_by;
  ELSIF NEW.status = 'approved' AND NEW.approved_by IS NOT NULL THEN
    v_performer_id := NEW.approved_by;
    SELECT full_name, department INTO v_performer_name, v_performer_dept
    FROM auth.users WHERE id = NEW.approved_by;
  ELSIF NEW.status = 'paid' THEN
    v_performer_id := NULL;
    v_performer_name := 'System';
    v_performer_dept := 'Finance';
  ELSE
    v_performer_id := NULL;
    v_performer_name := 'System';
    v_performer_dept := 'Finance';
  END IF;
  IF NEW.status != OLD.status THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE, 'finance', LOWER(NEW.status), v_performer_id, v_performer_name,
      v_performer_dept, 'เอกสารชำระเงิน ' || COALESCE(NEW.stage_name, v_house_model) || ': ' ||
        CASE
          WHEN NEW.status = 'submitted' THEN 'ยื่นขออนุมัติ'
          WHEN NEW.status = 'approved' THEN 'อนุมัติแล้ว'
          WHEN NEW.status = 'paid' THEN 'ชำระเงินแล้ว'
          WHEN NEW.status = 'rejected' THEN 'ปฏิเสธ'
          ELSE NEW.status
        END,
      1, NEW.net_amount, NEW.id, 'payment_vouchers', NEW.project_id, v_performer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_voucher_log ON public.payment_vouchers;
CREATE TRIGGER payment_voucher_log AFTER UPDATE ON public.payment_vouchers
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.log_payment_voucher();
  `,

  hr: `
-- HR Activity Logging
CREATE OR REPLACE FUNCTION public.log_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  v_performer_id UUID;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  IF NEW.status = 'approved' AND NEW.approved_by IS NOT NULL THEN
    v_performer_name := NEW.approved_by;
    v_performer_dept := 'HR';
    v_performer_id := NULL;
  ELSE
    v_performer_name := 'System';
    v_performer_dept := 'HR';
    v_performer_id := NULL;
  END IF;
  IF NEW.status != OLD.status THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE, 'hr', LOWER(NEW.status), v_performer_id, v_performer_name,
      v_performer_dept, 'การลา ' || NEW.leave_type || ': ' || NEW.employee_name || ' (' || NEW.days_count || ' วัน) - ' ||
        CASE
          WHEN NEW.status = 'approved' THEN 'อนุมัติแล้ว'
          WHEN NEW.status = 'rejected' THEN 'ปฏิเสธ'
          ELSE NEW.status
        END,
      NEW.days_count, NULL, NEW.id, 'leave_requests',
      COALESCE((SELECT project_id FROM public.projects LIMIT 1), gen_random_uuid()),
      v_performer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leave_request_log ON public.leave_requests;
CREATE TRIGGER leave_request_log AFTER UPDATE ON public.leave_requests
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.log_leave_request();
  `
};

serve(async (req) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { authToken, migration } = await req.json();

    // Verify admin token
    if (!authToken || authToken !== Deno.env.get("ADMIN_TOKEN")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get migration SQL
    const migrationKey = migration || "all";
    let sqlToExecute = "";

    if (migrationKey === "all") {
      sqlToExecute = Object.values(migrations).join("\n\n");
    } else if (migrations[migrationKey as keyof typeof migrations]) {
      sqlToExecute = migrations[migrationKey as keyof typeof migrations];
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid migration type" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Execute migrations
    const { error } = await supabase.rpc("exec_sql", {
      query: sqlToExecute,
    }).catch((err) => ({ error: err }));

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || "Migration failed",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${migration || "all"} migration applied successfully`,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
