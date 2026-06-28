import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// CEO และ COO = สิทธิ์สูงสุด ทำได้ทุกอย่าง (รวมถึงจัดการผู้ใช้)
const MANAGER_ROLES = ["admin", "ceo", "coo", "manager", "director", "project_manager"];
const ADMIN_ROLES = ["admin", "ceo", "coo", "director"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // อ่าน role ของผู้เรียกจาก app_metadata ก่อน (ผู้ใช้แก้เองไม่ได้) แล้ว fallback user_metadata
  const userRole = (user.app_metadata?.role ?? user.user_metadata?.role ?? "user") as string;
  const isAdmin = ADMIN_ROLES.includes(userRole);
  const isManager = MANAGER_ROLES.includes(userRole);

  if (!isManager) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (req.method === "GET") {
      // Direct Postgres query — bypass GoTrue ที่ crash เมื่อ auth.users มี NULL ในคอลัมน์ string
      const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
      const sql = postgres(dbUrl, { max: 1 });
      try {
        const rows = await sql`
          SELECT
            id,
            COALESCE(email, '') AS email,
            COALESCE(raw_user_meta_data->>'full_name', '') AS full_name,
            COALESCE(
              raw_app_meta_data->>'role',
              raw_user_meta_data->>'role',
              'user'
            ) AS role,
            COALESCE(
              raw_app_meta_data->>'department',
              raw_user_meta_data->>'department',
              ''
            ) AS department,
            created_at,
            last_sign_in_at
          FROM auth.users
          ORDER BY created_at
        `;
        const users = rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          email: r.email,
          full_name: r.full_name,
          role: r.role,
          department: r.department,
          created_at: r.created_at,
          last_sign_in_at: r.last_sign_in_at ?? null,
        }));
        return new Response(JSON.stringify({ users }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } finally {
        await sql.end();
      }
    }

    if (req.method === "POST") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "เฉพาะ Admin/CEO/COO/Director เท่านั้นที่สามารถสร้างบัญชีผู้ใช้ได้" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      const { email, password, full_name, role, department } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "กรุณาระบุ Email และรหัสผ่าน" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const finalRole = role ?? "user";
      const finalDept = department ?? "";
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // user_metadata: ชื่อ/แสดงผล (fallback) · app_metadata: role/department ที่เชื่อถือได้ (ผู้ใช้แก้เองไม่ได้)
        user_metadata: { full_name: full_name ?? "", role: finalRole, department: finalDept },
        app_metadata: { role: finalRole, department: finalDept },
      });
      if (error) throw error;
      return new Response(JSON.stringify({ user: data.user }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "PATCH") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "เฉพาะ Admin/CEO/COO/Director เท่านั้นที่สามารถแก้ไขบัญชีผู้ใช้ได้" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      const { userId, full_name, role, department, password } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "ไม่พบ userId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (password !== undefined && (typeof password !== "string" || password.length < 6)) {
        return new Response(JSON.stringify({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const attrs: Record<string, unknown> = {};
      if (full_name !== undefined || role !== undefined || department !== undefined) {
        const { data: existingUser } = await adminClient.auth.admin.getUserById(userId);
        const existingMeta = existingUser?.user?.user_metadata ?? {};
        const existingApp = existingUser?.user?.app_metadata ?? {};
        const newRole = role ?? existingApp.role ?? existingMeta.role;
        const newDept = department ?? existingApp.department ?? existingMeta.department;
        attrs.user_metadata = { ...existingMeta, full_name: full_name ?? existingMeta.full_name, role: newRole, department: newDept };
        // เขียน role/department ลง app_metadata ด้วย — ให้ user-context + auth_user_role (อ่าน app_metadata ก่อน) ตรงกันทั้ง 3 ชั้น
        attrs.app_metadata = { ...existingApp, role: newRole, department: newDept };
      }
      if (password !== undefined) {
        attrs.password = password;
      }
      const { data, error } = await adminClient.auth.admin.updateUserById(userId, attrs);
      if (error) throw error;
      return new Response(JSON.stringify({ user: data.user }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "DELETE") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "เฉพาะ Admin/CEO/COO/Director เท่านั้นที่สามารถลบบัญชีผู้ใช้ได้" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "ไม่พบ userId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "ลบบัญชีตัวเองไม่ได้" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
