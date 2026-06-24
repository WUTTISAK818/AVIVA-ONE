# WinVote — บันทึกความปลอดภัย (Security Notes)

เอกสารนี้สรุปโมเดลความปลอดภัยของ WinVote และ **สิ่งที่ต้องตั้งค่าก่อนขึ้น production จริง**
(ข้อมูลที่จัดเก็บมี PII ของประชาชน: เลขบัตร ปชช, ที่อยู่, เบอร์, รูปเซลฟี่, พิกัด GPS)

---

## โมเดลปัจจุบัน (ตามที่ schema-migration ตั้งไว้)

| ชั้น | สถานะ | หมายเหตุ |
|---|---|---|
| `anon` (ไม่ล็อกอิน) | 🔒 **บล็อกสนิท** | ไม่มี grant + ไม่มี policy → อ่าน/เขียนอะไรไม่ได้เลย ✅ |
| `authenticated` (ล็อกอินแล้ว) | เปิดเต็ม (`using true`) | อ่าน/เพิ่ม/แก้/ลบ ได้ทุกตาราง ทุกเขต |
| คุมระดับ role/เขต | คุมที่ **ชั้นแอป** (rbac.ts) | DB ยังไม่บังคับแยกเขต |

→ ใครก็ตามที่มีบัญชีและล็อกอินได้ จะเห็นข้อมูลประชาชน **ทุกเขต**

---

## ⛔ ต้องทำก่อน go-live (สำคัญสุด)

### 1. ปิด public signup ใน Supabase Auth — **จุดรูรั่วจริง**
ถ้าเปิด self-signup ไว้ ใครก็สมัครเองแล้วกลายเป็น `authenticated` → เห็น PII ทั้งหมดทันที
- Dashboard → **Authentication → Sign In / Providers → Email** → ปิด **"Allow new users to sign up"**
- สร้างบัญชีผู้ใช้ผ่าน `create-demo-users.sql` หรือ admin เท่านั้น

### 2. ลบ/เปลี่ยนรหัสบัญชีทดสอบ
- `create-demo-users.sql` ตั้งรหัสทุกบัญชีเป็น `Demo1234` — ใช้เฉพาะช่วงทดสอบ
- ก่อน go-live: เปลี่ยนรหัสจริง หรือลบบัญชี `demo.*@winvote.local` ทิ้ง
- (หน้า login ซ่อนปุ่ม demo อัตโนมัติแล้วเมื่อไม่ใช่ `NEXT_PUBLIC_DEMO_MODE=1`)

### 3. ตั้ง Storage policy สำหรับรูปเซลฟี่
- รูป presence/selfie เก็บใน Supabase Storage — ตรวจว่า bucket เป็น **private** + มี policy ให้เฉพาะ authenticated เข้าถึง

---

## 🔐 (ตัวเลือก) RLS แยกตามเขต — ทำตอน DB ตื่นแล้ว + ทดสอบจริง

ถ้าต้องการให้ "หัวหน้าเขต" เห็นเฉพาะข้อมูลเขตตัวเอง (ไม่เห็นเขตอื่น) ต้องเพิ่ม:

1. **ตาราง mapping** ผู้ใช้ ↔ เขต เช่น
   ```sql
   create table winvote.user_districts (
     user_id uuid references auth.users(id) on delete cascade,
     district_id uuid references winvote.districts(id) on delete cascade,
     primary key (user_id, district_id)
   );
   ```
2. **แก้ policy** จาก `using(true)` เป็นเช็คเขต เช่น (ตาราง residents):
   ```sql
   -- admin เห็นหมด, คนอื่นเห็นเฉพาะเขตที่ map ไว้
   create policy residents_by_district on winvote.residents for all to authenticated
   using (
     (auth.jwt()->'user_metadata'->>'role') = 'admin'
     or exists (
       select 1 from winvote.members m
       join winvote.communities c on c.id = m.community_id
       join winvote.user_districts ud on ud.district_id = c.district_id
       where m.id = residents.member_id and ud.user_id = auth.uid()
     )
   );
   ```
3. ทำซ้ำแนวเดียวกันกับ members/communities/polling_units/unit_results

> ⚠️ **ต้องทดสอบกับ DB จริงก่อนใช้** — RLS ที่ผิดอาจล็อกผู้ใช้ออกจากข้อมูลทั้งหมด
> ดังนั้นยังไม่ apply อัตโนมัติในไฟล์ migration — ทำเมื่อ project ACTIVE แล้วทดสอบทีละขั้น

---

## สรุป checklist ก่อน go-live
- [ ] ปิด public signup (ข้อ 1) ← สำคัญสุด
- [ ] เปลี่ยน/ลบ บัญชี demo (ข้อ 2)
- [ ] ตรวจ Storage bucket เป็น private (ข้อ 3)
- [ ] `NEXT_PUBLIC_DEMO_MODE` ว่าง/ไม่ตั้ง บน production
- [ ] (ตัวเลือก) RLS แยกเขต ถ้าต้องการ
