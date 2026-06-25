import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const activityId = formData.get("activityId") as string;
    const userId = formData.get("userId") as string;

    // Validate inputs
    if (!file || !activityId || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${timestamp}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const storagePath = `${PROJECT_ID}/${activityId}/${filename}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("activity-photos")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { success: false, error: "Failed to upload photo" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("activity-photos")
      .getPublicUrl(storagePath);

    const photoUrl = publicUrlData?.publicUrl || "";

    // Fetch current activity to get existing photos
    const { data: activityData, error: fetchError } = await supabase
      .from("activity_logs")
      .select("photo_urls")
      .eq("id", activityId)
      .single();

    if (fetchError) {
      console.error("Fetch activity error:", fetchError);
      return NextResponse.json(
        { success: false, error: "Activity not found" },
        { status: 404 }
      );
    }

    // Add new photo to array
    const currentPhotos = activityData?.photo_urls || [];
    const updatedPhotos = [...currentPhotos, photoUrl];

    // Update activity with new photo URL
    const { error: updateError } = await supabase
      .from("activity_logs")
      .update({ photo_urls: updatedPhotos })
      .eq("id", activityId);

    if (updateError) {
      console.error("Update activity error:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to save photo reference" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      photoUrl,
      storagePath,
      photoId: filename,
      uploadedAt: new Date().toISOString(),
      totalPhotos: updatedPhotos.length,
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const { searchParams } = new URL(req.url);
    const activityId = searchParams.get("activityId");
    const photoUrl = searchParams.get("photoUrl");

    if (!activityId || !photoUrl) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Extract storage path from URL
    const storagePathMatch = photoUrl.match(/activity-photos\/(.+)/);
    if (!storagePathMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid photo URL" },
        { status: 400 }
      );
    }

    const storagePath = storagePathMatch[1];

    // Delete from Supabase Storage
    const { error: deleteStorageError } = await supabase.storage
      .from("activity-photos")
      .remove([storagePath]);

    if (deleteStorageError) {
      console.error("Storage delete error:", deleteStorageError);
      return NextResponse.json(
        { success: false, error: "Failed to delete photo from storage" },
        { status: 500 }
      );
    }

    // Fetch current activity
    const { data: activityData, error: fetchError } = await supabase
      .from("activity_logs")
      .select("photo_urls")
      .eq("id", activityId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: "Activity not found" },
        { status: 404 }
      );
    }

    // Remove photo from array
    const currentPhotos = activityData?.photo_urls || [];
    const updatedPhotos = currentPhotos.filter((url: string) => url !== photoUrl);

    // Update activity
    const { error: updateError } = await supabase
      .from("activity_logs")
      .update({ photo_urls: updatedPhotos })
      .eq("id", activityId);

    if (updateError) {
      console.error("Update activity error:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Photo deleted successfully",
      totalPhotos: updatedPhotos.length,
    });
  } catch (error) {
    console.error("Photo delete error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
