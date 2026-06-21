# 📋 คู่มือทดสอบ Lead Status Fix - v6.52

## วิธีทดสอบหลังจาก Deploy

### ขั้นตอนที่ 1: เปิด App
ไปที่: `https://aviva-one.vercel.app` (หรือ production URL)

### ขั้นตอนที่ 2: ทดสอบด้วย API
ใช้ Postman หรือ curl เพื่อเรียก endpoint:

```bash
# ขั้นตอนแรก: ตรวจสอบปัญหา (ต้องมี Bearer token)
GET /api/admin/fix-lead-statuses/aaaaaaaa-0000-0000-0000-000000000001
Authorization: Bearer YOUR_JWT_TOKEN

# จะได้ผลลัพธ์แบบนี้:
{
  "success": true,
  "issues_found": 1,
  "issues": [
    {
      "id": "lead-id",
      "customer_name": "ชื่อลูกค้า",
      "current_status": "New Lead",  // ← สถานะเดิม
      "expected_status": "Contract", // ← ควรเป็น
      "has_contract": true,
      "issue_description": "..."
    }
  ]
}
```

### ขั้นตอนที่ 3: แก้ไขสถานะ
```bash
# เรียก POST เพื่อแก้ไขอัตโนมัติ
POST /api/admin/fix-lead-statuses/aaaaaaaa-0000-0000-0000-000000000001
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

# จะได้ผลลัพธ์:
{
  "success": true,
  "fixed": 1,
  "errors": [],
  "report": "✅ แก้ไข ชื่อลูกค้า: New Lead → Contract"
}
```

### ขั้นตอนที่ 4: ตรวจสอบในฐานข้อมูล
ลูกค้าที่มี `contract_signed_date` จะแสดงสถานะ "Contract" แล้ว

---

## ถ้าหากข้อมูลไม่ใช่เดียวกัน
หากผู้ใช้ "สนใจ" เป็น record ต่างกันจากลูกค้า "จอง" ให้:
1. ลบผู้ใจสนใจตรงนั้นออก
2. เรียกแค่ fix-lead-statuses สำหรับลูกค้าที่จองแล้ว

