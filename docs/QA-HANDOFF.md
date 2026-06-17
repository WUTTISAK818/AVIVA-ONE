# AVIVA ONE — เอกสารสรุปสำหรับฝ่ายประเมิน/ตรวจสอบคุณภาพ (QA Handoff)

> โครงการ **AVIVA Private** · แอป **AVIVA ONE** · เวอร์ชัน **v5.99** · วันที่ 17 มิ.ย. 2569
> เอกสารนี้สรุปข้อมูลสำคัญทุกส่วน/ทุกมิติ เพื่อให้ฝ่าย QA ประเมินคุณภาพได้ครบถ้วน
> **ขอบเขตความเชื่อมั่นของผู้จัดทำ:** โมดูล **บัญชี/การเงิน** ตรวจ/พัฒนาเชิงลึก (v5.86–5.99); โมดูลอื่นทราบเชิงโครงสร้าง — QA ควรตรวจเชิงลึกเพิ่มเอง (ดูข้อ 12)

---

## 1) ภาพรวมระบบ
- **ประเภท:** ERP/Back-office สำหรับธุรกิจพัฒนาอสังหาริมทรัพย์ (บ้านจัดสรร) — ครอบคลุม ขาย/CRM, ก่อสร้าง, QC, การเงิน/บัญชี, HR, การตลาด, หลังการขาย, เอกสาร, ผู้บริหาร
- **ผู้ใช้:** พนักงานภายในตามฝ่าย + ผู้บริหาร (CEO/COO สิทธิ์สูงสุด)
- **ภาษา UI:** ไทยเป็นหลัก
- **สถานะ:** ใช้งานจริง (production บน Vercel) มีข้อมูลจริง (ลูกค้า leads 133, บ้าน 55, transaction การเงิน, attendance ฯลฯ)

## 2) Tech Stack & Infrastructure
| ส่วน | รายละเอียด |
|------|-----------|
| Frontend | **Next.js (เวอร์ชัน custom — มี breaking changes จากมาตรฐาน, ต้องอ่าน `node_modules/next/dist/docs/`)**, React, TypeScript, Tailwind CSS |
| UI kit | component ภายใน: `GlassCard`, `SectionHeader`, ฯลฯ · ธีมสี `aviva-gold/text/secondary/bg/card` · icons lucide-react · charts recharts |
| Backend/DB | **Supabase** (PostgreSQL) project id `lpxerxxcbxwsjimzougk` · Edge Functions · RLS · Storage |
| Hosting | **Vercel** (watched branch `claude/move-work-location-2CfBA`) |
| Integrations | Google Drive (รายงาน), LINE (`line_links`, `app_settings`), AI chat/council, Push (`push_subscriptions`) |
| PWA | manifest + service worker (มี `/manifest.webmanifest`, apple-icon) |

## 3) Repository & Deploy Model
- **Repo:** `wuttisak818/aviva-one` (⚠️ CLAUDE.md Pre-flight ยังอ้าง `aviva-app-gpt` ของเดิม — ควรแก้)
- **Branches:** `main` (prod) · `claude/move-work-location-2CfBA` (Vercel deploy) · `claude/project-continuation-7pex98` (feature)
- **กฎ deploy:** push ครบ 3 branch · `npm run build` ต้องผ่านก่อน push · bump version 2 ไฟล์ (dashboard badge + settings) · บันทึก deploy report ลง Google Drive · อัปเดตคู่มือ (`settings/manual`) เมื่อเปลี่ยน flow
- **เวอร์ชัน:** ฝังใน `src/app/dashboard/page.tsx` (badge) + `src/app/settings/page.tsx`

## 4) โมดูล/หน้าจอ (routes ภายใต้ src/app)
dashboard · crm · leads · customers/customer · **office** (การเงิน+อนุมัติ) · **office/accounting** (บัญชี 11 แท็บ) · finance · construction · qc · inspection · hr · marketing · after-sales · documents (+generate) · approvals · projects · reports (+audit/review) · community · activity · inbox · track · admin · ai/ai-council · settings (manual/org-chart/doc-index/suggestions/users/forms/contractors/ai-experts/ai-insights) · login · api

## 5) ระบบบัญชี/การเงิน (ส่วนที่พัฒนาเชิงลึก v5.86–5.99)
- **Double-entry GL:** `src/lib/jv.ts` `postJv()` → `jv_entries`+`jv_lines`, บังคับ Dr=Cr (ไม่สมดุล = ไม่บันทึก)
- **ผังบัญชี:** `chart_of_accounts` (~41 บัญชี) + constants `src/lib/gl-accounts.ts`
- **โมดูลบัญชี 11 แท็บ** (`src/app/office/accounting/page.tsx`): ภาพรวม · สมุดรายวัน · ลูกหนี้(AR) · เจ้าหนี้(AP) · ภาษี(โอน/VAT/WHT/ภ.ธ.40/ภาษีที่ดิน) · ต้นทุนแปลง · TFRS15 · สแกนใบเสร็จ · จับคู่สลิป · กระทบยอด · งบ/รายงาน
- **ครบวงจร GL:** AR ออกใบแจ้งหนี้/รับชำระ · AP ตั้งหนี้/จ่าย · ภาษีขายตอนโอน (ปันส่วนที่ดิน/สิ่งปลูกสร้าง→VAT+SBT+ค่าโอน+WHT+COGS) · เงินดาวน์ CRM · รับรู้รายได้ TFRS15 — **ทุกอย่างลง JV**
- **งบการเงิน:** งบทดลอง + งบกำไรขาดทุน + งบดุล (จาก jv_lines posted) + export CSV
- **กำไรรายหลัง:** `ProfitabilityPanel.tsx` = รายได้ − (งวดผู้รับเหมา + ต้นทุนที่ดิน + ปันส่วนสาธารณูปโภค)
- **ภาษีไทย:** VAT 7% · WHT (50 ทวิ พิมพ์ได้) · ภ.ธ.40 3.3% · ภาษีที่ดิน 0.3% · TFRS15 รับรู้รายได้ตอนโอน
- **มาตรฐานยึด:** TFRS for NPAEs, บัญชีชุดเดียว (ห้ามสองเล่ม), Book-Tax reconciliation

## 6) ฐานข้อมูล
- **~135 ตาราง** ครอบคลุมทุกโมดูล · ทุกตาราง **เปิด RLS**
- ตารางหลัก: users(38), houses(55), leads(133), finance_transactions, jv_entries/jv_lines, chart_of_accounts(37), ar/ap, vat/wht/sbt registers, contractor_installments, attendance(147), notifications, audit_log(59), app_suggestions, work_queue(136) ฯลฯ
- **Migration ล่าสุด (v5.86–99):** houses.land_cost/infra_cost · ar_invoices.jv_id/is_advance · ar_payments.jv_id · ap_bills.jv_id/expense_account/pay_jv_id · vat_register.house_id · sbt_register.jv_id/house_id · chart_of_accounts +4 (1610/2310/6700/6710)

## 7) ความปลอดภัย & สิทธิ์ (Access Control)
- **Role policy (ถาวร):** CEO/COO สิทธิ์สูงสุด บังคับ 3 ชั้น — UI (`src/lib/roles.ts`: SUPER_ROLES/MANAGER_ROLES) · API (`@/lib/roles`) · DB (Postgres `auth_role()` map ceo/coo→admin ทุก RLS)
- **roles:** admin, ceo, coo, director, manager, project_manager + ระดับปฏิบัติการ
- **AVIVA Plus แยกเด็ดขาด** (resident/guard portal) — ห้ามปนใน AVIVA ONE

### ⚠️ ผลตรวจ Security Advisor (Supabase) — 105 รายการ (102 WARN, 3 INFO)
| จำนวน | ประเด็น | นัยยะ QA |
|------|---------|---------|
| **91** | `rls_policy_always_true` | RLS policy เป็น `USING(true)` — ตารางเข้าถึงได้กว้างเกินไปสำหรับผู้ใช้ที่ล็อกอิน ไม่กรองตาม ownership/ฝ่าย → **ความเสี่ยงข้อมูลรั่ว ควรรีวิว policy ทุกตาราง** |
| 5 | `authenticated_security_definer_function_executable` | ฟังก์ชัน SECURITY DEFINER เรียกได้โดย authenticated |
| 3 | `rls_enabled_no_policy` | เปิด RLS แต่ไม่มี policy |
| 3 | `anon_security_definer_function_executable` | ฟังก์ชัน SECURITY DEFINER เรียกได้โดย anon |
| 2 | `function_search_path_mutable` | search_path ไม่ fix (เสี่ยง privilege escalation) |
| 1 | `auth_leaked_password_protection` | ปิดการป้องกันรหัสผ่านรั่ว (ควรเปิด) |

## 8) ความถูกต้องของข้อมูล (Data Integrity)
- **GL สมดุล:** ตรวจแล้ว jv_entries ทุกใบ Dr=Cr (0 ใบไม่สมดุล) · งบทดลองสมดุล · สมการบัญชีถูกต้อง
- **postJv guard:** ปฏิเสธ JV ที่ไม่สมดุลอัตโนมัติ
- **constraint ที่พบ:** `bank_reconciliation.status` ∈ {draft, reconciled, discrepancy}
- **บั๊กที่เคยพบ+แก้:** CRM phone null crash (v5.62) · bank_reconciliation status ผิดค่า (v5.87 พบจาก E2E)

## 9) Performance — ผล Performance Advisor (Supabase) 226 รายการ (79 WARN, 147 INFO)
| จำนวน | ประเด็น |
|------|---------|
| **98** | `unindexed_foreign_keys` — FK ไม่มี index คลุม (เสี่ยงช้าเมื่อข้อมูลโต) |
| 49 | `unused_index` — index ที่ไม่ถูกใช้ (เปลือง storage/write) |
| 44 | `auth_rls_initplan` — RLS เรียก auth function ต่อ row (ควร wrap subquery) |
| 34 | `multiple_permissive_policies` — หลาย permissive policy ต่อ table/role |
| 1 | `duplicate_index` |

## 10) คุณภาพโค้ด & Conventions
- TypeScript strict (build บังคับไม่มี type error ก่อน push)
- รูปแบบ: client component + supabase client, modal pattern, optimistic update
- มี client error logging → ตาราง `client_errors`
- **ข้อควรระวังที่เคยพลาด (จาก CLAUDE.md):** เพิ่ม field ใน form state ต้อง reset ครบทุก `setForm` · field ใน JSX ต้องมีใน interface
- **หนี้เทคนิคโครงสร้าง:** บางหน้าใหญ่มาก (`office/page.tsx` 3,500+ บรรทัด, `office/accounting/page.tsx` ~1,700 บรรทัด, `crm/page.tsx` ~1,900 บรรทัด) — ควรพิจารณา refactor แยกไฟล์

## 11) การทดสอบ (Testing) — สถานะปัจจุบัน
- **ไม่มี automated test suite** (unit/integration/e2e อัตโนมัติ) ในโปรเจกต์ — **เป็นช่องว่างสำคัญที่ QA ควรเน้น**
- การทดสอบที่ใช้: build check (type) + E2E ระดับ DB (จำลอง insert workflow ใน transaction แล้ว rollback) + ตรวจ GL integrity ด้วย SQL
- **แนะนำ QA:** สร้าง regression suite (Playwright/Vitest) อย่างน้อยครอบ flow บัญชีหลัก + auth/role + CRM

## 12) ขอบเขตที่ QA ควรตรวจเชิงลึกเพิ่ม (ผู้จัดทำยังไม่ได้ audit ละเอียด)
- โมดูล: ก่อสร้าง, QC/inspection, HR/payroll/attendance, การตลาด, หลังการขาย/warranty, เอกสาร/approval workflow, community, AI features
- การคำนวณเงินเดือน/คอมมิชชัน/leave · approval matrix & SLA · การสร้างเอกสาร/เลขที่เอกสาร · push/LINE notifications · การอัปโหลด/บีบอัดรูป · permission ระดับเอกสาร

## 13) งานค้าง / Technical Debt (roadmap v6.0)
- ยังไม่มี **ปิดงวด/ล็อก JV** → แก้ย้อนหลังได้ (กระทบ audit)
- รับรู้รายได้มี 2 ทาง (TFRS15 / Tax→โอน) — มี dedup แต่ควรรวม UX
- MatchingTab (`payments`) ซ้ำกับ BankRec (`bank_statements`)
- ScannerTab เป็น Demo (mock OCR)
- ปันส่วน infra ใช้เฉลี่ยต่อแปลง (ยังไม่ by ratio)
- ยังไม่มีงบการเงินทางการ/ไฟล์ยื่นภาษี (PDF/RD e-Filing) — เป็นธีม v6.0
- RLS policy `always_true` 91 จุด (ดูข้อ 7) — **ควรจัดลำดับความสำคัญสูงสุด**

## 14) Checklist ประเมินคุณภาพ (รายมิติ)
- [ ] **Functional:** แต่ละโมดูลทำงานตาม flow จริง (เน้น approval, บัญชี, CRM→โอน)
- [ ] **Security:** รีวิว RLS 91 จุด always_true, security definer functions, เปิด leaked-password protection, ตรวจ role 3 ชั้น
- [ ] **Data integrity:** GL สมดุล, ไม่มีรายการกำพร้า, FK ครบ
- [ ] **Performance:** เพิ่ม index FK 98 จุด, ลบ index ไม่ใช้, ปรับ RLS initplan
- [ ] **Compliance:** ภาษีไทย (VAT/WHT/SBT), TFRS15/NPAEs, เก็บเอกสาร 5 ปี, audit trail
- [ ] **Reliability:** error rate (`client_errors`), การกู้คืน, ephemeral container/backup
- [ ] **Maintainability:** ขนาดไฟล์/ความซ้ำซ้อน, test coverage, เอกสาร
- [ ] **UX/Accessibility:** ภาษาไทยถูกต้อง, mobile/PWA, สถานะ loading/error
- [ ] **Auth:** login flow, session, สิทธิ์ตาม role/ฝ่าย

## 15) ประวัติเวอร์ชันล่าสุด (บริบทคุณภาพ)
v5.86 4 ฟีเจอร์บัญชีหลัก · v5.87 COGS+แก้บั๊ก · v5.88 AP→GL+ภาษีโอน · v5.89 งบการเงิน · v5.90 TFRS15→JV · v5.91 ปันส่วน infra · v5.92 เงินดาวน์ CRM→GL · v5.99 export CSV + handoff
ทุกเวอร์ชัน: build ผ่าน + E2E test + deploy 3 branch + deploy report (Google Drive)

---
*เอกสารนี้จัดทำเพื่อส่งต่อฝ่าย QA — ข้อมูลคุณภาพ (advisor) ดึงจาก Supabase ณ 17 มิ.ย. 2569 · อ้างอิงสถาปัตยกรรมเพิ่มเติมที่ `docs/HANDOFF-v6.md`*
