<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:role-access-rule -->
# Role & Access Policy (PERMANENT — กฎสิทธิ์การเข้าถึง)

**CEO และ COO มีสิทธิ์สูงสุด — เข้าถึงข้อมูลได้ทุกส่วน และทำได้ทุกอย่าง (เทียบเท่า/เหนือ admin)**

บังคับใช้ 3 ชั้น (ถ้าเพิ่ม role ผู้บริหารใหม่ ต้องอัปเดตให้ครบทั้ง 3):
1. **UI/หน้าจอ** — `src/lib/roles.ts` (`SUPER_ROLES`, `MANAGER_ROLES`, `isSuperRole`, `isManagerRole`) ใช้ผ่าน `user-context.tsx` (`isAdmin`/`isManager`)
2. **API/server** — import `MANAGER_ROLES`/`isManagerRole` จาก `@/lib/roles` (ai-chat, ai-council, admin/settings ฯลฯ) และ edge function `admin-user-management` (`MANAGER_ROLES`/`ADMIN_ROLES` ต้องมี `coo`)
3. **ฐานข้อมูล/RLS** — ฟังก์ชัน Postgres `public.auth_role()` map `ceo`/`coo` → `admin` ครอบคลุมทุก RLS policy ที่ gate ด้วย `auth_role()`

ค่า role ที่ใช้: `admin`, `ceo`, `coo`, `director`, `manager`, `project_manager`, และ role ระดับปฏิบัติการอื่น ๆ
<!-- END:role-access-rule -->

<!-- BEGIN:preflight-rule -->
# Pre-flight Check (MANDATORY — ทำก่อนเริ่มงานทุกครั้ง)

**ก่อนแก้ไขโค้ดใดๆ** ต้องทำตามขั้นตอนนี้ก่อนเสมอ:

## Step 1 — อ่านเวอร์ชันปัจจุบันจาก GitHub main โดยตรง
```
mcp__github__get_file_contents → owner: wuttisak818, repo: aviva-app-gpt, path: src/app/dashboard/page.tsx, ref: refs/heads/main
```
ค้นหา `v2.9.x` badge ในไฟล์ — นั่นคือ **CURRENT_VERSION**

## Step 2 — ใช้ CURRENT_VERSION เป็นฐาน
Version bump ทุกครั้งต้อง increment จาก CURRENT_VERSION ที่อ่านได้จริง ห้ามใช้เวอร์ชันจากความจำหรือบทสนทนาก่อนหน้า

## Step 3 — แจ้งผู้ใช้ก่อนเริ่มงาน
บอกผู้ใช้ว่า: "GitHub main ปัจจุบันคือ vX.X.X — จะ bump เป็น vX.X.Y"

**เหตุผล:** session ถูก compact ทำให้ข้อมูลเวอร์ชันจากหน่วยความจำเก่าหรือไม่ตรง การอ่านจาก GitHub โดยตรงทุกครั้งรับประกันความถูกต้อง 100%
<!-- END:preflight-rule -->

<!-- BEGIN:pre-push-build-rule -->
# Pre-Push Build Check (MANDATORY — ทำก่อน push ทุกครั้ง)

**ห้าม push โค้ดก่อนผ่าน build** — รัน `npm run build` และต้องได้ผลลัพธ์ที่ไม่มี TypeScript error ก่อนเสมอ

```bash
npm run build
# ต้องเห็น: ✓ Compiled successfully
# ต้องไม่มี: Type error / Failed to type check
```

## ข้อผิดพลาดที่เคยเกิดแล้ว — ห้ามเกิดซ้ำ

### ❌ ข้อผิดพลาดที่ 1 — เพิ่ม field ใน interface แล้วลืม reset
**เกิดขึ้น:** v2.9.8 — เพิ่ม `reported_by` ใน form state แต่ลืมใส่ใน `setForm({...})` ที่ reset form
**กฎ:** เมื่อเพิ่ม field ใด ๆ ใน form state ต้องค้นหาทุก `setForm({` ใน file นั้นและเพิ่ม field ให้ครบทุกจุด
```bash
# ตรวจสอบก่อน push เสมอ:
grep -n "setForm({" src/app/FILENAME.tsx
```

### ❌ ข้อผิดพลาดที่ 2 — เพิ่ม field ใน emptyForm แต่ลืม openEdit / detail panel
**เกิดขึ้น:** v2.9.8 — เพิ่ม `email`, `financing_type`, `urgency`, `next_follow_up_date` ใน CRM form แต่ `setForm` ที่เรียกจาก detail panel ลืมใส่ fields ใหม่
**กฎ:** เมื่อเพิ่ม field ใน `emptyForm` ต้องอัปเดต **ทุกจุดที่** `setForm` ถูกเรียกพร้อม object literal (ไม่ใช่ spread)

### ❌ ข้อผิดพลาดที่ 3 — ใช้ field ใน JSX แต่ไม่ได้ประกาศใน interface
**เกิดขึ้น:** v2.9.8 — ใช้ `doc.file_url` ใน `office/page.tsx` แต่ `OfficeDocument` interface ไม่มี field นั้น
**กฎ:** เมื่อ access property ใด ๆ จาก object ที่มี type กำกับ ต้องตรวจว่า interface มี field นั้นอยู่แล้ว ถ้าไม่มีให้เพิ่มก่อนใช้

## Checklist ก่อน push ทุกครั้ง
- [ ] `npm run build` ผ่าน ไม่มี TypeScript error
- [ ] ทุก `setForm({...})` ที่เป็น object literal (ไม่ใช่ spread) มีครบทุก field
- [ ] ทุก interface มี field ที่ถูกใช้ใน JSX
- [ ] Version bump ครบทั้ง dashboard + settings
<!-- END:pre-push-build-rule -->

<!-- BEGIN:deploy-report-rule -->
# Deploy Rule (MANDATORY — ทุกครั้งที่ git push)

After EVERY push to GitHub, you MUST do ALL of the following steps in order:

## Step 1 — อัปเดตเวอร์ชันในโค้ด (ก่อน commit สุดท้าย)
Bump the version number in BOTH files:
- `src/app/dashboard/page.tsx` — badge text เช่น `v2.9.1` → `v2.9.2`
- `src/app/settings/page.tsx`  — text เช่น `Version 2.9.1` → `Version 2.9.2`

Version format: `v{MAJOR}.{MINOR}.{PATCH}` — increment PATCH for fixes, MINOR for new features.

## Step 2 — Push ไปทั้งสอง branch
Push ไฟล์ที่แก้ไขไปยัง **ทั้งสอง branch** เพื่อให้ Vercel deploy ได้แน่นอน:
- `main` — production branch
- `claude/move-work-location-2CfBA` — Vercel watched branch

ใช้ `mcp__github__push_files` สองครั้ง (branch ละครั้ง)

## Step 3 — บันทึก Deploy Report ลง Google Drive
Create a report in Thai using `mcp__8faf3051-cdce-4013-97eb-37b094e28b96__create_file`:
- Filename: `AVIVA-ONE-deploy-report-v{VERSION}-{DATE}.txt`
- Content must include: version number, **date AND time (HH:MM น. เวลาไทย UTC+7)**, list of changes, files changed, commit hashes

**⚠️ บังคับ:** ต้องบันทึกเวลาจริง (HH:MM น.) ทุกครั้ง ไม่ใช่แค่วันที่
ดึงเวลาจาก commit timestamp ของ GitHub แล้วแปลงเป็น UTC+7 ก่อนบันทึก
ตัวอย่าง: `วันที่: 29 พฤษภาคม 2569 เวลา 12:00 น. (UTC+7)`

## Step 4 — แจ้งผู้ใช้
Report to the user:
- Version deployed (e.g., v2.9.2)
- Google Drive file link/ID
- Confirm pushed to both `main` and `claude/move-work-location-2CfBA`

This rule is PERMANENT and applies to every deploy session without exception.
<!-- END:deploy-report-rule -->
# Docs Sync Rule (PERMANENT — ซิงก์คู่มือ/โครงสร้างทุกครั้งที่เปลี่ยนวิธีทำงาน)

**ทุกครั้งที่มีการแก้ไขใด ๆ ที่กระทบ "วิธีการทำงาน / กระบวนการ / โครงสร้างแอป"** (เช่น เพิ่ม/แก้ flow อนุมัติ, เพิ่มฟีเจอร์/โมดูล, เปลี่ยนเกณฑ์วงเงิน, เปลี่ยนผังบัญชี/ภาษี, เปลี่ยนสายอนุมัติ) **ต้องอัปเดตข้อมูลในเมนูตั้งค่าให้ตรงกับปัจจุบันในรอบ deploy เดียวกัน**:
1. **คู่มือการใช้งาน** — `src/app/settings/manual/page.tsx` (เพิ่ม/แก้ section หรือ topic/steps ให้ตรงปุ่ม/หน้าจอจริง)
2. **โครงสร้างองค์กร / สายอนุมัติ** — `src/app/settings/org-chart/page.tsx` (ถ้ากระทบสายบังคับบัญชา/Matrix การอนุมัติ)
3. **ดรรชนีเอกสาร** — `src/app/settings/doc-index/page.tsx` (ถ้าเพิ่ม/แก้ prefix เลขที่เอกสาร)

ห้าม deploy การเปลี่ยน flow โดยไม่อัปเดตคู่มือให้ตรง — ถือเป็นส่วนหนึ่งของงานเดียวกัน

## ข้อเสนอแนะจากผู้ใช้ (Suggestions → อนุมัติ → พัฒนา)
- ผู้ใช้ทุกคนเสนอผ่าน `src/app/settings/suggestions/page.tsx` (ตาราง `app_suggestions`)
- ทุกข้อเสนอที่จะนำมาพัฒนา **ต้องผ่านการอนุมัติของผู้บริหาร (status `approved`) ก่อน** จึงลงมือแก้ไข
- ยึดหลัก "ความถูกต้อง + โครงสร้างหลักของแอป" เป็นสำคัญก่อนเสมอ
