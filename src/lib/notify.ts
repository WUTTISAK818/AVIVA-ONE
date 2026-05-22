import { supabase } from "./supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function createNotification(opts: {
  type: "approval" | "claim" | "document" | "success" | "info";
  title: string;
  message: string;
  from_dept?: string;
  to_dept?: string;
  record_id?: string;
}) {
  await supabase.from("notifications").insert({
    project_id: PROJECT_ID,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    from_dept: opts.from_dept ?? null,
    to_dept: opts.to_dept ?? null,
    is_read: false,
    record_id: opts.record_id ?? null,
  });
}
