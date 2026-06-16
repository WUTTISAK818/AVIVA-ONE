@AGENTS.md

# Project Identity
- ชื่อโครงการ (Project): **AVIVA Private**
- ชื่อแอปพลิเคชัน (App): **AVIVA ONE**
- เมื่อพูดถึงโครงการให้ใช้ชื่อ "AVIVA Private" และเมื่อพูดถึงแอปให้ใช้ชื่อ "AVIVA ONE"

# 🚫 Separation Rule (PERMANENT — บังคับใช้ตลอด)

**ห้ามนำงาน/ข้อมูล/โค้ดจากโปรเจกต์ AVIVA Plus ไปยุ่งเกี่ยวกับ web app AVIVA ONE เด็ดขาด**

ขอบเขตของกฎ:
1. **Repository:** ห้าม commit code AVIVA Plus เข้า branch `main` ของ aviva-one (และห้าม merge PR ที่ทำแบบนั้น)
2. **Database:** AVIVA ONE ใช้ Supabase `AVIVA ONE` (`lpxerxxcbxwsjimzougk`) เท่านั้น — ห้าม query/แก้ schema ของ Supabase `aviva-plus` (`azstncqpwyrabwvcuxjf`) ขณะทำงาน ONE
3. **Vercel:** ONE และ Plus ต้องเป็น Vercel projects แยก ใช้ branch/repo แยก
4. **CLAUDE.md/AGENTS.md ของ aviva-one:** ห้ามใส่ rule/instruction ที่อ้างถึง Plus features
5. **AI suggestions/code review:** เมื่อแก้ ONE — ห้ามแนะนำให้ใช้ pattern จาก Plus หรือกลับกัน

ที่อยู่ที่ถูกต้องของแต่ละโปรเจกต์:
- **AVIVA ONE** — `wuttisak818/aviva-one` branch `main` + Supabase `AVIVA ONE`
- **AVIVA Plus** — repo/branch แยก (`plus-deploy` branch ปัจจุบัน หรือ repo `joyus818/aviva-plus` ในอนาคต) + Supabase `aviva-plus`

ถ้ามี Claude session ที่ได้รับมอบหมายงาน Plus → ต้องอยู่ใน scope Plus repo/branch เท่านั้น
ถ้ามี Claude session ที่ได้รับมอบหมายงาน ONE → ห้ามมองหรือใช้ code Plus เป็น reference

