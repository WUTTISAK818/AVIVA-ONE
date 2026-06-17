// บีบอัด/ย่อรูปฝั่ง client ก่อนอัปโหลด — ลดขนาดไฟล์จากกล้องมือถือ (มัก 3–8 MB)
// ให้เหลือ ~ไม่กี่ร้อย KB เพื่ออัปเร็วขึ้นมากตอนใช้งานหน้างาน (TC-02)
// ปลอดภัย: ถ้าไม่ใช่รูป / บีบไม่ได้ / บีบแล้วไม่เล็กลง → คืนไฟล์เดิม ไม่บล็อกการอัปโหลด
export async function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file; // PDF/ไฟล์อื่น/GIF ปล่อยผ่าน
  if (file.size < 400 * 1024) return file; // เล็กอยู่แล้ว ไม่ต้องบีบ
  try {
    // imageOrientation: respect EXIF กันรูปจากมือถือหมุนผิดด้าน
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // บีบแล้วไม่เล็กลง → ใช้ของเดิม
    const name = file.name.replace(/\.(png|webp|heic|heif|jpeg|jpg|bmp|tiff?)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file; // บีบไม่ได้ → ใช้ไฟล์เดิม
  }
}
