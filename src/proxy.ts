import { NextResponse } from "next/server";

// ⚠️ การซ่อน route ข้ามแอป (AVIVA ONE ↔ AVIVA Plus) ถูกปิดไว้
// เหตุผล: ตรรกะเดิมตอบ route ที่ถูกบล็อกเป็น HTTP 404 ที่ body ว่าง (ไม่มี content-type)
// → เบราว์เซอร์/มือถือดาวน์โหลดเป็นไฟล์เปล่า (เช่น เปิด /dashboard ได้ไฟล์ "dashboard" 0 KB)
// และถ้า NEXT_PUBLIC_TARGET ของ deployment ตั้งไม่ตรง จะบล็อกทั้งแอปจนใช้งานไม่ได้
// → ปล่อยผ่านทุก request เพื่อให้ทุก deployment เปิดใช้งานได้เสมอ
// (หากต้องการแยกการมองเห็น route จริง ๆ ให้ทำที่ระดับเมนู/การนำทาง ไม่ใช่บล็อกใน middleware)
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|robots\\.txt|sitemap\\.xml|icons/).*)",
  ],
};
