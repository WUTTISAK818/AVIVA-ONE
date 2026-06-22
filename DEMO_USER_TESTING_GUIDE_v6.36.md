# 🎭 AVIVA ONE v6.36 - คู่มือการทดสอบแบบมองเห็น (DEMO USER TESTING GUIDE)

**วันที่**: 18 มิ.ย. 2569  
**เป้าหมาย**: ทดลองใช้ด้วยบัญชี demo เพื่อมองเห็นว่ายังต้องปรับอะไรอีกไหม  
**ระยะเวลา**: ~2-3 ชั่วโมงต่อผู้ใช้/บทบาท

---

## 👥 บัญชี Demo Users ที่สร้างแล้ว

| ลำดับ | ชื่อบัญชี | Email | บทบาท | ส่วนงาน | เข้าถึงได้ | Password |
|------|---------|-------|--------|---------|-----------|-----------|
| **1** | Demo CEO | demo.ceo@alisa.com | CEO | Executive | ทั้งหมด ✅ | `Demo@CEO123` |
| **2** | Demo COO | demo.coo@alisa.com | COO | Operations | ทั้งหมด ✅ | `Demo@COO123` |
| **3** | Demo Sales | demo.sales@alisa.com | Sales | Sales/CRM | CRM เฉพาะ | `Demo@Sales123` |
| **4** | Demo Engineer | demo.engineer@alisa.com | Engineer | Construction | Construction เฉพาะ | `Demo@Engineer123` |
| **5** | Demo Finance | demo.finance@alisa.com | Finance | Finance | Finance เฉพาะ | `Demo@Finance123` |
| **6** | Demo Admin | demo.admin@alisa.com | Admin | IT/Admin | ทั้งหมด ✅ | `Demo@Admin123` |

---

## 🔗 วิธีเข้าสู่ระบบ

```
URL: http://localhost:3000/
     หรือ https://aviva-one.vercel.app/ (production)

1. เปิด URL
2. Click "Sign In" (หรือ Login)
3. ป้อน Email จากตาราข้างบน
4. ป้อน Password: `Demo@[Role]123`
5. Click "Sign In"
```

---

## 📋 ส่วนที่ 1: ทดสอบแต่ละบทบาท (6 Demo Users)

### 👑 **ทดสอบที่ 1: CEO (demo.ceo@alisa.com)**

**เวลาที่ใช้**: 30-40 นาที

#### ✅ หน้าที่ของ CEO:
- ดูทั้งหมด (Dashboard, CRM, Construction, Finance)
- อนุมัติการทำงาน
- จัดการผู้ใช้ (หากมี)
- ดูรายงาน

#### 📝 ทดสอบต่อไปนี้:

**1. Login & Dashboard**
```
[ ] 1. Login ด้วย demo.ceo@alisa.com
[ ] 2. Dashboard โหลดได้ ✅
[ ] 3. Badge v6.36 ปรากฏ ✅
[ ] 4. Bottom navigation แสดง 6 tabs:
      - หน้าหลัก ✅
      - ขาย (CRM) ✅
      - ก่อสร้าง (Construction) ✅
      - ออฟฟิศ (Office) ✅
      - รายงาน (Reports) ✅
      - ตั้งค่า (Settings) ✅
[ ] 5. KPI cards display (หากมีข้อมูล)
```

**2. CRM Module**
```
[ ] 1. Click "ขาย" (CRM)
[ ] 2. CRM page loads ✅
[ ] 3. See CRM leads list (should show 134 leads)
[ ] 4. Try to:
      - Click on 1 lead to see detail ✅
      - Try to edit (if permitted) ✅
      - Check console (F12) for errors ❌
[ ] 5. Navigation ง่ายหรือไม่?
      - Comment: _____________________
```

**3. Construction Module**
```
[ ] 1. Click "ก่อสร้าง" (Construction)
[ ] 2. Construction page loads ✅
[ ] 3. See 31 houses display
[ ] 4. Try to:
      - Click on 1 house to see detail ✅
      - See customer info linked from CRM ✅
      - See progress percentage ✅
      - See work reports ✅
[ ] 5. Any UI issues?
      - Comment: _____________________
```

**4. Finance/Approvals**
```
[ ] 1. Find Finance section (may be in Construction)
[ ] 2. See approval queue
[ ] 3. Try to:
      - View approval details ✅
      - Try to approve/reject (if permitted) ✅
      - See approval history/logs ✅
[ ] 4. Any issues?
      - Comment: _____________________
```

**5. Settings**
```
[ ] 1. Click "ตั้งค่า"
[ ] 2. Settings page loads
[ ] 3. Check:
      - Version shows 6.36 ✅
      - Theme/colors correct ✅
      - Menu items visible ✅
[ ] 4. Any improvements needed?
      - Comment: _____________________
```

**6. Logout**
```
[ ] 1. Find Logout button (usually in settings or menu)
[ ] 2. Click Logout
[ ] 3. Redirected to login page ✅
```

**📝 CEO Summary - สิ่งที่ต้องปรับ (เขียนไว้)**
```
ปัญหาที่พบ:
1. _________________________________
2. _________________________________
3. _________________________________

ส่วนที่ดี:
1. _________________________________
2. _________________________________

ต้องปรับ:
1. _________________________________
2. _________________________________
```

---

### 👔 **ทดสอบที่ 2: COO (demo.coo@alisa.com)**

**เวลาที่ใช้**: 30-40 นาที

#### ✅ หน้าที่ของ COO:
- ดูทั้งหมด (เหมือน CEO)
- ควบคุมการดำเนินงาน
- อนุมัติ/ปฏิเสธ

#### 📝 ทดสอบต่อไปนี้:

```
[ ] 1. Login ด้วย demo.coo@alisa.com
[ ] 2. Dashboard loads ✅
[ ] 3. Can access all modules ✅
[ ] 4. Can see CRM + Construction + Finance ✅
[ ] 5. Try to approve/reject something
[ ] 6. Differences from CEO?
     - Comment: _____________________
```

**📝 COO Summary**
```
ปัญหาที่พบ:
1. _________________________________

ต้องปรับ:
1. _________________________________

ตำแหน่ง COO ต้องการอะไรเพิ่มเติม?
_________________________________
```

---

### 💼 **ทดสอบที่ 3: Sales (demo.sales@alisa.com)**

**เวลาที่ใช้**: 30-40 นาที

#### ✅ หน้าที่ของ Sales:
- ดูและจัดการ CRM leads
- ดู Construction (read-only)
- ไม่สามารถเข้า Finance

#### 📝 ทดสอบต่อไปนี้:

```
[ ] 1. Login ด้วย demo.sales@alisa.com
[ ] 2. Dashboard loads ✅
[ ] 3. Can access CRM ✅
[ ] 4. Can access Construction (read-only) ✅
[ ] 5. Finance module:
     [ ] NOT visible? (should not see) ✅
     [ ] Try to go /finance - should be denied ✅
[ ] 6. In CRM:
     [ ] Can create lead? ✅/❌
     [ ] Can edit own lead? ✅/❌
     [ ] Can delete lead? ✅/❌
[ ] 7. In Construction:
     [ ] Can view houses? ✅
     [ ] Can edit house? ❌ (should not allow)
```

**📝 Sales Summary**
```
ปัญหาที่พบ:
1. _________________________________

ความประสงค์ที่สำคัญสำหรับ Sales:
1. _________________________________
2. _________________________________
```

---

### 🔨 **ทดสอบที่ 4: Engineer (demo.engineer@alisa.com)**

**เวลาที่ใช้**: 30-40 นาที

#### ✅ หน้าที่ของ Engineer:
- ดู + จัดการ Construction
- ดู CRM (read-only)
- ไม่สามารถเข้า Finance

#### 📝 ทดสอบต่อไปนี้:

```
[ ] 1. Login ด้วย demo.engineer@alisa.com
[ ] 2. Dashboard loads ✅
[ ] 3. Can access Construction ✅
[ ] 4. Can access CRM (read-only) ✅
[ ] 5. Finance NOT accessible ✅
[ ] 6. In Construction:
     [ ] Can view 31 houses? ✅
     [ ] Can edit progress? ✅/❌
     [ ] Can add work report? ✅/❌
     [ ] Can upload photos? ✅/❌
     [ ] Can update status? ✅/❌
[ ] 7. UI for work tracking:
     [ ] Is it easy to use? ✅/❌
     [ ] Any missing features? ❌ List: _____
```

**📝 Engineer Summary**
```
ปัญหาที่พบ:
1. _________________________________

ของ Engineer - ส่วนที่ใช้งานได้ดี:
1. _________________________________

ต้องปรับ/เพิ่มเติม:
1. _________________________________
2. _________________________________
```

---

### 💰 **ทดสอบที่ 5: Finance (demo.finance@alisa.com)**

**เวลาที่ใช้**: 30-40 นาที

#### ✅ หน้าที่ของ Finance:
- ดู + อนุมัติ Finance
- ดู Construction (read-only)
- ไม่สามารถแก้ CRM

#### 📝 ทดสอบต่อไปนี้:

```
[ ] 1. Login ด้วย demo.finance@alisa.com
[ ] 2. Dashboard loads ✅
[ ] 3. Can access Finance/Approvals ✅
[ ] 4. Can see approval queue? ✅
[ ] 5. Try to approve:
     [ ] Can approve payment? ✅/❌
     [ ] Can reject with reason? ✅/❌
     [ ] Can see approval history? ✅/❌
[ ] 6. Construction (read-only):
     [ ] Can view? ✅
     [ ] Can edit? ❌ (should not allow)
[ ] 7. CRM (should NOT access):
     [ ] Visible? ❌ (should not be)
     [ ] Try /crm - denied? ✅
[ ] 8. Approval workflow:
     [ ] Is it clear? ✅/❌
     [ ] Any confusion? ______
```

**📝 Finance Summary**
```
ปัญหาที่พบ:
1. _________________________________

การอนุมัติ/Finance - ดีที่:
1. _________________________________

ต้องปรับ:
1. _________________________________
2. _________________________________
```

---

### 🔐 **ทดสอบที่ 6: Admin (demo.admin@alisa.com)**

**เวลาที่ใช้**: 20-30 นาที

#### ✅ หน้าที่ของ Admin:
- Manage system
- Manage users (หากมี)
- Access control

#### 📝 ทดสอบต่อไปนี้:

```
[ ] 1. Login ด้วย demo.admin@alisa.com
[ ] 2. Dashboard loads ✅
[ ] 3. Can access admin panel? ✅/❌
[ ] 4. Can manage users? ✅/❌
[ ] 5. Can change roles? ✅/❌
[ ] 6. System settings accessible? ✅/❌
[ ] 7. Admin features:
     [ ] What admin features exist?
        _________________________________
     [ ] Are they needed?
        ✅ Yes / ❌ No
```

**📝 Admin Summary**
```
Admin features found:
1. _________________________________

Are admin features sufficient?
✅ Yes / ❌ No

Recommendations:
1. _________________________________
```

---

## 📊 ส่วนที่ 2: การประเมินโดยรวม (OVERALL ASSESSMENT)

### ❓ คำถามสำคัญหลัง 6 ชม. ทดสอบ:

```
1. ✅ Version v6.36 ปรากฏถูกต้องหรือไม่?
   ☐ Yes  ☐ No  ☐ Partially

2. ✅ ทุกเมนูสามารถเข้าถึงได้หรือไม่?
   ☐ Yes  ☐ No  ☐ Some broken

3. ✅ RBAC (Role-Based Access) ทำงานถูกต้องหรือไม่?
   ☐ Yes (ถูก)  ☐ No (ผิด)  ☐ Partially

4. ✅ Data display ถูกต้องหรือไม่?
   ☐ 31 houses ✅  ☐ 134 CRM leads ✅  ☐ All correct

5. ✅ Performance:
   - Page load: _________ ms (target: < 2000)
   - Is it fast enough? ☐ Yes  ☐ No

6. ✅ UI/UX ดีหรือไม่?
   ☐ Excellent  ☐ Good  ☐ Fair  ☐ Poor

7. ✅ มีปัญหาใดที่ต้องแก้ไขด่วนหรือไม่?
   ☐ Critical  ☐ Important  ☐ Minor  ☐ None
```

---

### 📝 รายการปัญหาทั้งหมด (MASTER ISSUES LIST)

```
CRITICAL Issues (ต้องแก้ก่อน go-live):
1. _________________________________
2. _________________________________

IMPORTANT Issues (ควรแก้ก่อน go-live):
1. _________________________________
2. _________________________________

MINOR Issues (ปรับได้หลังจาก go-live):
1. _________________________________
2. _________________________________

Feature Requests (ขอเพิ่ม):
1. _________________________________
2. _________________________________
```

---

### ✨ ส่วนที่ดี (POSITIVE FEEDBACK)

```
สิ่งที่ทำได้ดี:
1. _________________________________
2. _________________________________
3. _________________________________

Features ที่มีประโยชน์:
1. _________________________________
2. _________________________________

Ready for Go-Live?
☐ Yes, fully ready!
☐ Yes, with minor fixes
☐ No, needs more work
☐ Not sure

Next Action:
_________________________________
```

---

## 🎯 FINAL CHECKLIST

```
After testing all 6 demo users:

[ ] All 6 users can login ✅
[ ] All users see correct dashboard ✅
[ ] RBAC enforcement working ✅
[ ] No critical bugs found ✅
[ ] Data integrity verified ✅
[ ] Performance acceptable ✅
[ ] UI/UX user-friendly ✅
[ ] Ready for production? ✅

Sign-off:
Date: ______________
Tester Name: ______________
Status: ☐ Approved  ☐ Needs fixes
```

---

## 📞 เมื่อพบปัญหา

**หากพบปัญหา ให้:**
1. Screenshot + หน้าจอ
2. เขียนรายละเอียดปัญหา
3. เลขขั้นตอน
4. Expected vs Actual result
5. ส่งให้ทีมพัฒนา

**ตัวอย่าง Issue Report:**
```
Title: CRM leads not displaying
Steps:
1. Login as demo.sales@alisa.com
2. Click "ขาย" menu
3. Expected: See 134 leads list
4. Actual: Blank page with loading spinner
5. Error: [Copy from F12 Console]
Severity: HIGH - Cannot work
```

---

## 🚀 หลังจากทำ Demo Testing

✅ ทดสอบเสร็จ  
✅ Record ปัญหาทั้งหมด  
✅ ส่งรายงานให้ทีมพัฒนา  
✅ รอ fixes  
✅ Re-test fixes  
✅ Final approval  
✅ Go-Live! 🎉

---

**ขอบคุณสำหรับการทดสอบจริงใจ!**  
**ความเห็นของคุณช่วยให้เราปรับปรุงระบบให้ดีขึ้น!** ✨

