# WINVOTE — HANDOFF / คู่มือรับช่วงงาน (สำหรับ Claude Cowork)

> เอกสารนี้ทำให้ผู้ช่วยใหม่ (Claude Cowork) **ขึ้นงานได้ทันทีโดยไม่ต้องเริ่มจากศูนย์**
> และทำงาน **ขนานกับ Claude อีกตัว (แทร็ก Backend)** โดยไม่ชนกัน

---

## 0. อ่านก่อนเริ่ม (ตามลำดับ)
1. `WINVOTE-HANDOFF.md` (ไฟล์นี้) — ภาพรวม + กติกาประสานงาน
2. `WINVOTE-STATUS.md` — กระดานสถานะสด (ใครทำอะไรอยู่)
3. `README.md` — วิธีตั้งค่า/รัน/deploy
4. `WINVOTE-VERIFICATION-DESIGN.md` — พิมพ์เขียวระบบทั้งหมด (3 Part)
5. `WINVOTE-EXPERT-AUDIT.md` — ผลตรวจ + roadmap P0/P1/P2
6. `winvote-backup/SECURITY-NOTES.md` — โมเดลความปลอดภัย + checklist go-live

---

## 1. โครงการคืออะไร (ย่อ)
**WinVote** = ระบบจัดการเครือข่ายฐานเสียงเลือกตั้งท้องถิ่น (Next.js App Router + Supabase)
แยกร่างอิสระจาก AVIVA สมบูรณ์ · มือถือเป็นหลัก

**3 Part:** (1) เก็บ/ยืนยันฐานเสียง ลูกทีม 1:50 → (2) ชั้นหัวหน้าทีม/สตาฟ → (3) วิเคราะห์โอกาสชนะ
รายละเอียดเต็มอยู่ใน `WINVOTE-VERIFICATION-DESIGN.md`

---

## 2. สถานะปัจจุบัน (ณ การประเมินครั้งที่ 1)
- โค้ดฝั่ง WinVote build เขียว · แท็บ: ภาพรวม/หน่วยเลือกตั้ง/ผลเลือกตั้ง/วิเคราะห์(Monte Carlo)/รายงาน
- ข้อมูลจริง 185 หน่วย (เลือกตั้ง 2568) ตรวจถูกต้อง 100% — SQL พร้อมรัน
- **ตัวขวางหลัก: Supabase project WinVote ยัง `INACTIVE`** (ต้อง restore ก่อนถึงจะรัน SQL/ทดสอบ DB ได้)
- คะแนน audit รวม ~54/100 — ดีไซน์ดีมาก แต่กลไกสำคัญหลายอย่างยัง "ออกแบบไว้ ยังไม่ build"

---

## 3. repo / branch (ระบบ 2 แทร็ก)
- **repo:** `WUTTISAK818/AVIVA-ONE`
- **แทร็ก Backend (Claude เดิม):** branch `claude/id-card-data-extraction-bfaRS`
- **แทร็ก Frontend (Cowork = คุณ):** สร้าง branch `cowork/winvote-frontend` แตกจาก backend branch ล่าสุด
- **Integration:** `winvote-dev` — merge งานที่ build เขียวแล้วมารวมที่นี่

```
git fetch origin
git checkout claude/id-card-data-extraction-bfaRS   # baseline ล่าสุด
git checkout -b cowork/winvote-frontend             # branch ของ Cowork
```

---

## 4. ⚠️ กติกาประสานงาน (สำคัญสุด — กันชนกัน)
| # | กฎ |
|---|---|
| 1 | **ต่างคนต่าง branch** — ห้าม push เข้า branch ของอีกฝ่าย |
| 2 | **แตะเฉพาะโซนตัวเอง** (ดูตารางข้อ 5) — โซนร่วมต้องแจ้งใน STATUS ก่อน |
| 3 | **build เขียวก่อน merge** เข้า `winvote-dev` (`npm run build` ต้องผ่าน) |
| 4 | **จับ/ปล่อยงาน = อัปเดต `WINVOTE-STATUS.md`** (เฉพาะ section ของตัวเอง) ทุกครั้ง |
| 5 | เปลี่ยน **type/interface ใน `src/lib/winvote.ts`** = แจ้งใน STATUS section "ขอบเขตร่วม" ก่อนเสมอ |

---

## 5. แบ่งความเป็นเจ้าของไฟล์
| โซน | เจ้าของ | ไฟล์ |
|---|---|---|
| Backend/Data/วิเคราะห์ | **Claude เดิม** | `winvote-backup/*.sql`, `src/lib/*` (ยกเว้น UI), `src/app/api/**`, `src/components/WinAnalysis.tsx`, การรัน DB |
| Frontend/UX | **Cowork** | `src/app/winvote/page.tsx`, `src/components/*` (capture/modal/nav/UI), `src/app/login`, globals/ธีม |
| ขอบเขตร่วม | คุยก่อน | `src/lib/winvote.ts` (types/contract), เอกสารดีไซน์ |

> งานที่เหมาะกับ Cowork ตอนนี้ (จาก roadmap): **H5 โหมดง่ายลูกทีมสูงอายุ · H4 offline queue · Dashboard หัวหน้าทีม (Part 2) · โหมดเก็บข้อมูล 3 แบบ**

---

## 6. Checklist การเข้าถึงที่ Cowork ต้องเชื่อม (ขอจากผู้ใช้)
| ระบบ | สิ่งที่ต้องมี |
|---|---|
| **GitHub** | สิทธิ์เขียน repo `WUTTISAK818/AVIVA-ONE` |
| **Supabase** | project **WinVote** = `gfnelofmgzqfwvlbaabd` (region ap-southeast-1) |
| **Vercel** | (เมื่อ deploy) project ของ WinVote |
| **Google Drive** | โฟลเดอร์รายงาน (สำหรับบันทึก audit ครั้งต่อไป) |

> ⚠️ การเชื่อม MCP/สิทธิ์เป็นของแต่ละ session — ผู้ใช้ต้องเชื่อมให้ Cowork เอง โอนจากอีก session ไม่ได้

---

## 7. Environment
- คัดลอก `.env.example` → `.env.local`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` = มีใน `.env.example` (anon เป็น public ปลอดภัย)
- **`SUPABASE_SERVICE_ROLE_KEY` = ดึงจาก Supabase dashboard เอง — ห้ามอยู่ในไฟล์/handoff**
- **`NEXT_PUBLIC_DEMO_MODE=1`** = โหมดทดสอบ UI ไม่ต้องมี DB (ห้ามตั้งบน production)

---

## 8. งานค้าง (สรุป — รายละเอียดใน AUDIT)
- **P0 (รอ DB):** รัน `01-04` SQL · เชื่อม roll-match เข้า capture · RLS แยกเขต
- **P1:** intent double opt-in · PDPA consent flow · (โมเดลวิเคราะห์แก้แล้ว)
- **P2:** offline queue · โหมดสูงอายุ · dashboard หัวหน้าทีม · lifecycle/reconciliation UI

---

## 9. หลักการสูงสุด
**แยกขาด · ไม่พัวพัน · ไม่สับสน · ขนานกันได้** — ทำงานในโซนตัวเอง, รวมที่ `winvote-dev`, สื่อสารผ่าน `WINVOTE-STATUS.md`
