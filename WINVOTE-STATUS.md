# WINVOTE — STATUS / กระดานประสานงานสด

> กฎ: แต่ละแทร็กอัปเดต **เฉพาะ section ของตัวเอง** · จับ/ปล่อยงานทุกครั้ง · งานโซนร่วมแจ้งใน §3 ก่อน
> รูปแบบรายการ: `[สถานะ] งาน — ไฟล์ — อัปเดตล่าสุด` (สถานะ: 🟡 กำลังทำ / ✅ เสร็จ-merge แล้ว / ⏸ รอ / 🔴 ติดปัญหา)

---

## §1. แทร็ก Backend / Data / วิเคราะห์  (Claude — `claude/id-card-data-extraction-bfaRS`)

**กำลังทำ:**
- ⏸ รอ restore DB → รัน SQL 01–04 + โหลด 185 units + ทดสอบ RLS

**เสร็จแล้ว (merge baseline):**
- ✅ โมเดลวิเคราะห์ Monte Carlo + เทียบ max(v1,v3,v4) — `WinAnalysis.tsx`
- ✅ SQL artifacts 01–04 (voter_roll / RLS แยกเขต / verification tables / consent) — `winvote-backup/`
- ✅ แก้ bug audit: LINE expires_at, LineVerifyModal poll, extract-id res.ok, dead code
- ✅ เอกสาร: DESIGN, AUDIT, SECURITY-NOTES, HANDOFF

**ถัดไป (เมื่อ DB ตื่น):** รัน migration → เชื่อม roll-match (ฝั่ง lib/api) → intent flow

---

## §2. แทร็ก Frontend / UX  (Cowork — `cowork/winvote-frontend`)

**กำลังทำ:**
- _(Cowork เติมที่นี่)_

**เสร็จแล้ว (merge baseline):**
- _(ยังไม่มี)_

**ถัดไป (เสนอ):** H5 โหมดง่ายลูกทีมสูงอายุ · H4 offline queue · Dashboard หัวหน้าทีม (Part 2)

---

## §3. ขอบเขตร่วม (ต้องแจ้งก่อนแตะ)

- **`src/lib/winvote.ts` (types/interface):** เจ้าของหลัก = Backend · ถ้า Frontend ต้องเพิ่ม field ใน type → แจ้งที่นี่ก่อน
  - _(ยังไม่มีคำขอ)_
- **เอกสารดีไซน์:** แก้ได้ทั้งคู่ แต่ commit แยก section ไม่ทับกัน

---

## §4. ตัวขวางร่วม (Blockers)

- 🔴 **Supabase WinVote = INACTIVE — เปิดไม่ได้เพราะ free tier จำกัด 2 โปรเจกต์ active/org**
  (AVIVA ONE + AVIVA PLUS เต็ม 2 ช่องแล้ว) → ต้อง **pause/delete ตัวใดตัวหนึ่ง หรือ upgrade plan** (รอผู้ใช้ตัดสินใจ)
  - กระทบ: รัน SQL, ทดสอบ RLS, intent flow, dashboard ที่ใช้ข้อมูลจริง
  - ทางเลี่ยงชั่วคราว: ใช้ `NEXT_PUBLIC_DEMO_MODE=1` พัฒนา/ทดสอบ UI ได้โดยไม่ต้องมี DB
- ⏳ repo `WINVOTE` แยกจริง + Vercel ยังไม่ตั้ง (deploy ใช้ branch นี้ชั่วคราวได้)

---

## §5. บันทึกการ merge เข้า `winvote-dev`
| วันที่ | แทร็ก | สรุป | build |
|---|---|---|---|
| _(เริ่มเมื่อมี merge แรก)_ | | | |
