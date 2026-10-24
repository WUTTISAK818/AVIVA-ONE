import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

// บอกเวอร์ชันที่เซิร์ฟเวอร์เสิร์ฟอยู่จริง ณ ตอนนี้
// ใช้คู่กับ <VersionBanner /> เพื่อบอกผู้ใช้ที่เปิดแอปค้างไว้ว่ามีเวอร์ชันใหม่แล้ว
// (เกิดจริง 23 ต.ค. 69: ฟ้าแจ้งว่าแก้ข้อมูลไม่ได้ ทั้งที่โค้ดที่ปลดล็อกขึ้นระบบไปแล้ว 3 ชั่วโมง)
export async function GET() {
  return NextResponse.json({ version: APP_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
