# คู่มือตั้งค่าระบบแจ้งเตือน (Workflow Notifications) — v4.4x

ระบบแจ้งเตือนของ AVIVA ONE ออกแบบเป็น **best-effort**: ถ้ายังไม่ตั้งค่า ENV
ช่องทางนั้นจะถูกข้ามไปเฉยๆ โดยที่ระบบ in-app (กล่องงาน, timeline, routing) ยังทำงานปกติ
คู่มือนี้ครอบคลุมขั้นตอน config ที่ต้องทำในแดชบอร์ด (ทำในโค้ดไม่ได้)

---

## 1) ENV Variables (Vercel → Settings → Environment Variables)

### Web Push (PWA) — จำเป็นถ้าต้องการแจ้งเตือนบนมือถือ/เดสก์ท็อป
| ตัวแปร | ค่า |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key (ดูใน Deploy Report v4.44 บน Google Drive) |
| `VAPID_PRIVATE_KEY` | VAPID private key — **เก็บเป็นความลับ ห้าม commit ลง repo** |
| `VAPID_SUBJECT` | `mailto:joyus818@gmail.com` |

> สร้าง VAPID key ใหม่ได้ด้วย: `npx web-push generate-vapid-keys`

### Cron SLA Reminder — จำเป็นถ้าต้องการให้เตือนงานค้างอัตโนมัติ
| ตัวแปร | ค่า |
|---|---|
| `CRON_SECRET` | สุ่มสตริงยาวๆ (กันการเรียก cron จากภายนอก) |

Vercel Cron ถูกตั้งไว้แล้วใน `vercel.json` (`0 1,9 * * *` = 08:00 และ 16:00 เวลาไทย)

### LINE + SMS — ใส่เมื่อพร้อมใช้ (ไม่ใส่ก็ได้ ระบบจะข้าม)
| ตัวแปร | ค่า |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | จาก LINE Developers Console (Messaging API channel) |
| `NEXT_PUBLIC_LINE_OA_ID` | LINE OA ID เช่น `@aviva` |
| `THAIBULKSMS_API_KEY` / `THAIBULKSMS_API_SECRET` / `THAIBULKSMS_SENDER` | จาก ThaiBulkSMS |
| `NEXT_PUBLIC_SITE_URL` | โดเมนจริง เช่น `https://aviva-private.vercel.app` (ใช้สร้างลิงก์ /track) |

---

## 2) LINE Webhook

1. ไปที่ LINE Developers → Messaging API channel
2. ตั้ง **Webhook URL** = `https://<โดเมน>/api/line/webhook`
3. เปิด **Use webhook** = ON
4. พนักงานผูกบัญชี: หน้า **ตั้งค่า → "ผูกบัญชี LINE"** กดขอรหัส 6 หลัก แล้วพิมพ์รหัสในแชต LINE OA

---

## 3) ผู้รับเหมา (สำหรับ LINE/SMS + ลิงก์ติดตามงาน)

ไปที่ **ตั้งค่า → ผู้รับเหมา** (เฉพาะผู้จัดการ/แอดมิน):
1. **เพิ่มผู้รับเหมา** — กรอกชื่อ, เบอร์โทร (สำหรับ SMS), ref code (auto-gen ได้)
2. **ผูกแปลง** — เลือกแปลง/ยูนิตที่ผู้รับเหมารับผิดชอบ (ตั้งค่า `houses.contractor_line_id = ref_code`)
3. ผู้รับเหมาดูสถานะงานได้ที่ `https://<โดเมน>/track/<ref_code>` (ไม่ต้องล็อกอิน)

เมื่องวดงานถูก **อนุมัติ / จ่ายเงิน / ตีกลับ** ระบบจะส่ง LINE/SMS หาผู้รับเหมาที่ผูกไว้อัตโนมัติ
(LINE จะส่งได้เมื่อผู้รับเหมาผูก `line_user_id` แล้ว; SMS ส่งตามเบอร์ที่กรอก)

---

## 4) ทดสอบ

- **Web Push:** ตั้งค่า → "การแจ้งเตือนบนอุปกรณ์" → เปิด (iPhone ต้อง Add to Home Screen ก่อน)
- **Cron:** `curl "https://<โดเมน>/api/cron/sla-reminder?secret=<CRON_SECRET>"`
- **กล่องงาน:** ส่งงวดงานตรวจ → เห็นงานเด้งใน /inbox ของผู้จัดการ → อนุมัติ → เด้งต่อให้ฝ่ายการเงิน

---

## สถาปัตยกรรม (ไฟล์ที่เกี่ยวข้อง)

- Routing/Audit: `src/lib/workflow-events.ts`, ตาราง `work_queue` + `workflow_events`
- กล่องงาน/ไทม์ไลน์: `src/app/inbox/page.tsx`, `src/components/WorkflowTimeline.tsx`
- Web Push: `public/sw.js`, `src/lib/push-*.ts`, `src/app/api/push/send/route.ts`
- LINE/SMS: `src/lib/{line,sms,dispatch-notification}.ts`, `src/app/api/line/*`, `src/app/api/notify/contractor/route.ts`
- Track page: `src/app/track/[refCode]/page.tsx`, `src/lib/track-data.ts`
- Cron: `src/app/api/cron/sla-reminder/route.ts`, `vercel.json`
