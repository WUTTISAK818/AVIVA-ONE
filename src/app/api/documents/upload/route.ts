import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MANAGER_ROLES } from "@/lib/roles";
import { serverDb } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface UploadResponse {
  documentId?: string;
  status?: string;
  error?: string;
  message?: string;
}

// ตรวจสอบ auth + role
async function verifyAuthAndRole(
  token: string
): Promise<{ user_id?: string; error?: string }> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return { error: "Unauthorized" };
  }

  const db = serverDb(token);
  const { data: dbUser } = await db
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = dbUser?.role ?? "";
  // อนุญาต: accounting, finance, admin, ceo, coo, manager
  const allowedRoles = [...MANAGER_ROLES, "accounting", "finance"];
  if (!allowedRoles.includes(userRole.toLowerCase())) {
    return { error: "Forbidden: Only accounting/finance/admin staff can upload" };
  }

  return { user_id: user.id };
};

// POST: Upload receipt file
export async function POST(req: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const { user_id, error } = await verifyAuthAndRole(token);
    if (error) {
      return NextResponse.json({ error }, { status: error === "Forbidden: Only accounting/finance/admin staff can upload" ? 403 : 401 });
    }

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("documentType") as string) || "receipt";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPG, PNG, and PDF allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}-${randomId}-${file.name}`;
    const filePath = `receipts/${user_id}/${fileName}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Save document metadata to database
    const db = serverDb(token);
    const { data: docData, error: dbError } = await db
      .from("documents")
      .insert({
        uploaded_by: user_id,
        file_path: filePath,
        file_name: file.name,
        document_type: documentType,
        status: "uploaded",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      // Clean up uploaded file
      await supabase.storage.from("receipts").remove([filePath]);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentId: docData?.id,
      status: "uploaded",
      message: "File uploaded successfully",
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
