# 🔧 VAPID Keys & LINE OA Setup Guide

**วัตถุประสงค์:** ตั้งค่า Push Notifications (VAPID) + LINE Official Account integration ให้ production ทำงาน

---

## 1️⃣ VAPID Keys Setup (Push Notifications)

**VAPID = Voluntary Application Server Identification**  
ใช้สำหรับ Web Push Notifications — ต้องสร้าง key pair แล้วบันทึก env var

### Step 1: Generate VAPID Keys

**ตัวเลือก A: ใช้ Online Generator** (เร็ว)
```bash
# ไปที่ https://web-push-codelab.glitch.me/
# คลิก "Generate Keys" → Copy ทั้ง public + private
```

**ตัวเลือก B: ใช้ Node.js** (ถ้าต้องการ local)
```bash
npx web-push generate-vapid-keys

# ผลลัพธ์:
# Public Key: <VAPID_PUBLIC_KEY>
# Private Key: <VAPID_PRIVATE_KEY>
```

### Step 2: ตั้งค่า Environment Variables

**ใน Vercel Dashboard:**
1. ไปที่ Project Settings → Environment Variables
2. เพิ่ม 2 ตัวแปร:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY = <public key ที่ได้>
   VAPID_PRIVATE_KEY = <private key ที่ได้>
   ```
3. Save + Redeploy

**ใน Local (.env.local):**
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
```

### Step 3: ตรวจสอบ

```bash
# ทดสอบ API
curl -X POST http://localhost:3000/api/push/test \
  -H "Content-Type: application/json"

# ควรได้ response: {"success": true}
```

**ถ้ามี error:**
- ❌ "VAPID keys not configured" → เช็ค env vars ใน Vercel
- ❌ "Invalid VAPID keys" → ลอง generate keys ใหม่

---

## 2️⃣ LINE Official Account (OA) Setup

**LINE OA = Official Account** = Channel ที่แอปใช้ส่ง message + รับข้อความจากผู้ใช้

### Step 1: สร้าง LINE OA

1. ไปที่ [LINE Developer Console](https://developers.line.biz/en/)
2. สร้าง New Channel:
   - **Channel Type:** Messaging API
   - **Display Name:** AVIVA ONE (หรือชื่อแอปที่ใช้)
   - **Category:** Property Management
3. ยืนยัย email และ สร้าง channel ✓

### Step 2: ได้ Channel ID & Access Token

ใน LINE Developer Console → Channel Settings:
- **Channel ID:** หน้า "Basic Settings" → เลขที่ขึ้นต้น
- **Channel Access Token:** หน้า "Messaging API" → "Channel Access Token" (ถ้ายังไม่มี คลิก "Issue")

**เก็บ 2 ค่านี้ไว้:**
```
LINE_CHANNEL_ID = <channel ID>
LINE_ACCESS_TOKEN = <access token 36 ตัวอักษร>
```

### Step 3: ตั้งค่า Vercel Environment Variables

```bash
NEXT_PUBLIC_LINE_CHANNEL_ID = <LINE_CHANNEL_ID>
LINE_CHANNEL_ACCESS_TOKEN = <LINE_ACCESS_TOKEN>
```

### Step 4: สร้าง LINE OA Official ID

LINE OA ต้องมี "Official ID" เพื่อให้ผู้ใช้จำง่าย

1. ใน LINE Developer Console → Messaging API → "Manage official accounts"
2. ขอ Official ID (อาจต้องรอหลายวัน หรือจ่ายค่าใช้)
3. หลังได้แล้ว ก็ได้ QR code และลิงค์เพิ่มเพื่อนแบบนี้:
   ```
   https://lin.ee/@<official_id>
   หรือ QR Code
   ```

### Step 5: ตั้งค่า Webhook (ถ้าต้องการรับ message กลับ)

1. ใน Messaging API → Webhook URL:
   ```
   https://<your-domain>/api/webhook/line
   ```
2. Enable Webhook ✓
3. Test connection ✓

---

## 3️⃣ ตัวแปรสิ้นสุดใน Vercel

**ทั้งหมดต้องตั้ง:**

```env
# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public_key>
VAPID_PRIVATE_KEY=<private_key>

# LINE Integration
NEXT_PUBLIC_LINE_CHANNEL_ID=<channel_id>
LINE_CHANNEL_ACCESS_TOKEN=<access_token>
LINE_OA_OFFICIAL_ID=<official_id>  # optional but recommended
```

**หลังตั้งเสร็จ:**
1. Save all env vars ✓
2. Redeploy project ✓
3. รอ ~30 วินาที สำหรับ build ใหม่

---

## 4️⃣ ตรวจสอบทั้งระบบ

### ✅ Dashboard ตรวจสอบ:
- [ ] ปุ่ม "เพิ่มเพื่อน LINE" แสดง
- [ ] QR code scan ได้
- [ ] Redirect ไป LINE OA ได้

### ✅ Database ตรวจสอบ:
```sql
-- ทดสอบ push subscriptions
SELECT count(*) FROM push_subscriptions;
-- ควรจะ > 0 หลังจาก subscribe

-- ทดสอบ LINE links
SELECT count(*) FROM line_links WHERE linked_at IS NOT NULL;
-- ควรจะ ≥ 1 หลังจาก link
```

### ✅ Test Push Send:
```bash
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Test notification"}'

# ควรได้ push บนมือถือ
```

---

## 🆘 Troubleshooting

| ปัญหา | สาเหตุ | แนวทาง |
|-------|--------|--------|
| VAPID keys ไม่ทำงาน | env var ไม่ตรง Vercel | ตรวจ Vercel env, redeploy |
| LINE QR ไม่แสดง | Channel ID ไม่ตั้ง | เช็ค NEXT_PUBLIC_LINE_CHANNEL_ID |
| Webhook ไม่ส่งข้อความกลับ | Webhook URL ไม่ถูก | ตรวจ /api/webhook/line endpoint |
| Push ไม่เด้ง | subscription ไม่บันทึก | ตรวจ browser storage, re-subscribe |
| Official ID ไม่ได้ | ยังรอการอนุมัติ | รอ LINE team review (1-7 วัน) |

---

## 📋 Checklist ก่อน Go-Live

- [ ] VAPID keys ตั้ง ✓ (Vercel env)
- [ ] LINE Channel ID ตั้ง ✓
- [ ] LINE Access Token ตั้ง ✓
- [ ] LINE Official ID ได้แล้ว (or pending)
- [ ] Redeploy ✓ + build successfully
- [ ] Test push → เด้งบนมือถือ ✓
- [ ] ปุ่ม "เพิ่มเพื่อน LINE" ทำงาน ✓
- [ ] LINE link ทำงาน ✓

---

**ผู้ตั้งค่า:** _____________  
**วันที่:** _____________  
**ตรวจสอบโดย:** _____________  
