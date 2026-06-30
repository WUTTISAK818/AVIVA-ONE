# ✅ v6.81+ Testing Checklist — Go-Live Verification

**วันที่:** 2026-06-30  
**เวอร์ชัน:** v6.94 (includes v6.81 features + v6.82-6.94 improvements)  
**ผู้ทดสอบ:** Pom + Vee  
**วิธีตรวจ:** เปิดแอปจริงบนมือถือ + dashboard บนเดสก์ทอป

---

## 📱 Dashboard — Team Reports Widget (v6.90+)

**สถานที่:** หน้าหลัก / Dashboard  
**เกณฑ์เสร็จ:** Widget แสดง report stats + วันที่ปัจจุบัน

- [ ] **Widget แสดง:** "วันนี้ YYYY-MM-DD"
- [ ] **Stats มี 3 ค่า:** รวม / ส่งแล้ว / ล่าช้า
- [ ] **Styling:** สีเข้ากับ AVIVA theme (ไม่ขัดเขินกับ dashboard อื่น ๆ)
- [ ] **เฉพาะ managers/admins:** ถ้าเป็น staff ไม่เห็น widget นี้

**ทำงาน?** ☐ ✔️ / ☐ ❌  
**หมายเหตุ:**  

---

## 📋 Task Cards Widget (v6.81)

**สถานที่:** Dashboard — หลังจาก widgets อื่น  
**เกณฑ์เสร็จ:** แสดงงานที่ต้องทำในรูปบัตร + สามารถเพิ่ม/ลบได้

- [ ] **Card แสดง:** ชื่องาน + assigned person + priority + due date
- [ ] **การ์ดทำงาน:** คลิกเปิด detail ได้
- [ ] **ปุ่มเพิ่มงาน:** มี "Add Task" button + เปิด form ได้
- [ ] **ลบงาน:** ปุ่ม delete/close card ทำงาน
- [ ] **ตัวกรอง:** สามารถ filter by status (pending/completed/overdue)

**ทำงาน?** ☐ ✔️ / ☐ ❌  
**หมายเหตุ:**  

---

## 📊 Dashboard Layout — Items Order

**สถานที่:** Dashboard เต็มหน้า  
**เกณฑ์เสร็จ:** ลำดับ widgets ตรงตาม v6.94

ลำดับจากบนลงล่าง:
- [ ] 1. ภาพรวมการเงิน (Finance Summary)
- [ ] 2. ภาพรวมก่อสร้าง (Construction Summary)
- [ ] 3. งานที่ต้องทำ (Task Cards)
- [ ] 4. รายงานทีม (Team Reports) — ชิดขวา
- [ ] 5. ... (other widgets)
- [ ] ล่าสุด: คณะที่ปรึกษา AI (AI Council)

**ทำงาน?** ☐ ✔️ / ☐ ❌  
**หมายเหตุ:**  

---

## 🤖 AI Features

### ✅ AI สรุปรายงาน (v6.75)
**สถานที่:** Reports page → view report → "สรุป" button  
**เกณฑ์เสร็จ:** ปุ่มแสดง + คลิกเรียก AI สรุป

- [ ] **ปุ่มมี:** "สรุป" / "TL;DR" button
- [ ] **ผลลัพธ์:** AI สรุปรายงาน 2-3 บรรทัด
- [ ] **ทำงานไม่พัง:** UI ไม่ hang ขณะรอ response

**ทำงาน?** ☐ ✔️ / ☐ ❌  

### ✅ AI ร่างรายงาน (v6.76)
**สถานที่:** Reports → "โหมดช่วยเขียน" / "Draft Mode"  
**เกณฑ์เสร็จ:** สามารถเลือก "โหมดต้นฉบับ" vs "โหมดร่าง (AI)" ได้

- [ ] **Toggle mode:** ปุ่มสลับ "ต้นฉบับ" ↔ "ร่าง"
- [ ] **AI ร่าง:** แสดงข้อความที่ AI สร้างมา
- [ ] **Edit:** สามารถแก้ไขร่าง AI ได้

**ทำงาน?** ☐ ✔️ / ☐ ❌  

### ✅ AI สรุป — Council Briefing (v6.82+)
**สถานที่:** Dashboard → "คณะที่ปรึกษา AI"  
**เกณฑ์เสร็จ:** แสดง cross-department issues + executive summary

- [ ] **Widget แสดง:** Issues + Decisions + Weekly Plan
- [ ] **เฉพาะ CEO/COO:** เช็คว่าคนอื่นไม่เห็น
- [ ] **Data ถูกต้อง:** สรุปตรงกับ dept briefs

**ทำงาน?** ☐ ✔️ / ☐ ❌  

---

## 📲 LINE Integration (v6.81+)

**สถานที่:** Dashboard / Settings → LINE  
**เกณฑ์เสร็จ:** ปุ่มเพิ่มเพื่อน LINE + QR code แสดง

### ✅ LINE Add Friend Button
- [ ] **ปุ่ม "เพิ่มเพื่อน"** มีใน dashboard หรือ settings
- [ ] **คลิกปุ่ม:** เปิดลิงค์ LINE OA ได้
- [ ] **QR Code:** มีให้ scan ได้

### ✅ LINE Account Linking
- [ ] **เข้า LINE → บัญชี:** ปุ่มผูก LINE account
- [ ] **คลิกผูก:** Redirect ไป LINE login
- [ ] **ยืนยัน:** หลังยืนยัย status เปลี่ยนเป็น "ผูกแล้ว"
- [ ] **ดูในตาราง:** `line_links.linked_at` ไม่เป็น NULL

**ทำงาน?** ☐ ✔️ / ☐ ❌  
**Linked count:** _____ (expected: ≥ 1)

---

## 🔔 Push Notifications (v6.81+)

**สถานที่:** Settings → Notifications / Mobile  
**เกณฑ์เสร็จ:** Subscribe push + ส่งทดสอบได้

### ✅ Subscribe to Push
- [ ] **ปุ่ม "อนุญาต Notification"** มีใน settings
- [ ] **คลิกปุ่ม:** ให้ permission request
- [ ] **ยืนยัย:** ได้ subscription token
- [ ] **DB check:** `push_subscriptions` count > 0

### ✅ Test Push Send
- [ ] **API endpoint:** POST `/api/push/send` ทำงาน
- [ ] **Push message** เด้งบนมือถือจริง
- [ ] **Content ถูกต้อง:** ข้อความแสดงเต็มแล้ว

**ทำงาน?** ☐ ✔️ / ☐ ❌  
**Push subscriptions:** _____ (expected: > 0)

---

## 📝 Report Features

### ✅ เพิ่มภาพประกอบ (v6.74)
**สถานที่:** Reports → ใช้รายงาน → แนบรูป  
**เกณฑ์เสร็จ:** Upload รูป + แสดง caption ได้

- [ ] **ปุ่มแนบรูป:** "Upload Image" ทำงาน
- [ ] **Caption field:** แนบ caption เข้าไปได้
- [ ] **เตือน:** ถ้าลืมแนบรูป ต้องเตือนก่อนส่ง

**ทำงาน?** ☐ ✔️ / ☐ ❌  

### ✅ ย้อนหลัง/แก้/ตีกลับ (v6.77)
**สถานที่:** Reports → รายงานที่ส่งแล้ว → "ดู/แก้"  
**เกณฑ์เสร็จ:** สามารถแก้ไขรายงานหลังส่งได้

- [ ] **ดู history:** รายงานเก่า → "ดูเวอร์ชันเก่า"
- [ ] **แก้ไข:** ปุ่ม "แก้ไข" เปิด form แก้ได้
- [ ] **ตีกลับ:** ปุ่ม "ตีกลับ/Reject" ให้ resend ได้
- [ ] **Audit trail:** ประวัติการแก้อยู่ใน comments

**ทำงาน?** ☐ ✔️ / ☐ ❌  

---

## 🗂️ Menu Changes

**สถานที่:** BottomNav / Sidebar  
**เกณฑ์เสร็จ:** "รายงานทีม" หายจากเมนู, งานย้ายไปหน้าหลัก

- [ ] **"รายงานทีม" หายจากเมนู:** ไม่เห็นในตัวเมนูแล้ว
- [ ] **งานย้ายไป dashboard:** Task cards อยู่หน้าหลักแล้ว
- [ ] **เมนูที่เหลือ:** Normal / ไม่พัง

**ทำงาน?** ☐ ✔️ / ☐ ❌  

---

## 🔐 Security & Data

### ✅ ไม่มี Test Data
- [ ] **Demo users:** ลบออกแล้ว (auth ไม่มี demo account)
- [ ] **Test reports:** ล้างออกแล้ว
- [ ] **Production data ปลอด:** ไม่มีข้อมูลทดสอบปน

### ✅ Secrets ปลอดภัย
- [ ] **VAPID key:** ตั้ง ✓ (สำหรับ push)
- [ ] **LINE OA ID:** ตั้ง ✓ (ใช้จริง)
- [ ] **Env vars:** ไม่มีเด่นใน repo

**ทำงาน?** ☐ ✔️ / ☐ ❌  

---

## 📋 Final Verification

**Dashboard version:** _____ (expected: v6.94)  
**Build date:** _____ (check: Settings → About)  
**All tests passed?** ☐ YES / ☐ NO (if NO, list issues below)

---

## 🐛 Issues Found (if any)

| # | Issue | Severity | Step to Reproduce | Expected | Actual | Status |
|---|-------|----------|-------------------|----------|--------|--------|
| 1 |  |  |  |  |  | ☐ รอแก้ |
| 2 |  |  |  |  |  | ☐ รอแก้ |

---

**ผู้ทดสอบ:** ________________  
**วันที่:** ________________  
**ลงชื่อ:** ________________  
