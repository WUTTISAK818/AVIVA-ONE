<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
- Content must include: version number, date/time, list of changes, files changed, commit hashes

## Step 4 — แจ้งผู้ใช้
Report to the user:
- Version deployed (e.g., v2.9.2)
- Google Drive file link/ID
- Confirm pushed to both `main` and `claude/move-work-location-2CfBA`

This rule is PERMANENT and applies to every deploy session without exception.
<!-- END:deploy-report-rule -->
