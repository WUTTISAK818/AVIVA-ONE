# AVIVA ONE — Handoff to v6.0 (เอกสารส่งต่อ session ใหม่)

> โครงการ **AVIVA Private** / แอป **AVIVA ONE** · อัปเดต: 17 มิ.ย. 2569 · เวอร์ชันล่าสุด **v5.99**
> ไฟล์นี้สรุปทุกอย่างที่ session ใหม่ต้องรู้เพื่อทำ **v6.0** ต่อ — อ่านไฟล์นี้ + รัน Pre-flight ก่อนเริ่มงานเสมอ

---

## 0) เริ่ม session ใหม่อย่างไร
1. อ่านไฟล์นี้ให้จบ
2. **Pre-flight (บังคับ):** อ่านเวอร์ชันจริงจาก GitHub main — `mcp__github__get_file_contents` owner `wuttisak818` repo `aviva-one` path `src/app/dashboard/page.tsx` ref `refs/heads/main` → หา badge `v5.x` = CURRENT_VERSION → bump จากค่านี้เท่านั้น
3. ยืนยันธีม v6.0 กับผู้ใช้ (ดูข้อ 6) แล้วเริ่มพัฒนา

## 1) Branch & Deploy (กฎสำคัญ)
- **feature branch (พัฒนา):** `claude/project-continuation-7pex98`
- **main:** production
- **Vercel watched branch:** `claude/move-work-location-2CfBA`
- ทุก deploy push **ครบ 3 branch** — main + Vercel ใช้ cherry-pick commit จาก feature ลง temp branch ที่แตกจาก `origin/main` แล้ว push (Vercel branch diverged → ใช้ `git merge -s ours` ก่อน push)
- ขั้นตอน deploy ที่ใช้จริง:
  ```
  git checkout -b deploy-tmp origin/main
  git cherry-pick <feature_commit>
  git push origin deploy-tmp:main
  git merge -s ours origin/claude/move-work-location-2CfBA -m "merge"
  git push origin deploy-tmp:claude/move-work-location-2CfBA
  git checkout claude/project-continuation-7pex98 && git branch -D deploy-tmp
  ```
- **ก่อน push ทุกครั้ง:** `npm run build` ต้อง `✓ Compiled successfully` ไม่มี type error
- **Deploy report:** บันทึกลง Google Drive (mcp create_file: `title`, `textContent`, `contentMimeType=text/plain`, `disableConversionToGoogleType=true`) ทุกรอบ deploy
- bump version 2 ที่เสมอ: `src/app/dashboard/page.tsx` (badge `vX.XX`) + `src/app/settings/page.tsx` (`Version X.XX`)
- git commit ลงท้ายด้วย Co-Authored-By + Claude-Session ตามที่ harness กำหนด (ห้ามใส่ model id ใน artifact)

## 2) สถาปัตยกรรมบัญชี/การเงิน (ไฟล์หลัก)
- `src/app/office/accounting/page.tsx` — โมดูลบัญชีหลัก **11 แท็บ**: ภาพรวม · สมุดรายวัน(JV) · ลูกหนี้(AR) · เจ้าหนี้(AP) · ภาษี(โอน/VAT/WHT/ภ.ธ.40/ภาษีที่ดิน) · ต้นทุนแปลง · TFRS15 · สแกนใบเสร็จ · จับคู่สลิป · กระทบยอด · งบ/รายงาน
- `src/lib/jv.ts` — `postJv({project_id, jv_date, description, ref_number?, status?, lines[]})` ลง `jv_entries`+`jv_lines` แบบ double-entry (บังคับ Dr=Cr ไม่งั้น return null) · `nextJvNumber()`, `yymm()`
- `src/lib/gl-accounts.ts` — constants ผังบัญชี (CASH 1110, BANK 1120, AR 1200, INPUT_VAT 1600, PREPAID_WHT 1610, WIP 1180, AP 2100, RETENTION 2150, CUSTOMER_ADVANCE 2200, OUTPUT_VAT 2300, SBT_PAYABLE 2310(*), WHT_PAYABLE 2400, SALES_REVENUE 4100, LAND_COST 5100, COGS 5210, TRANSFER_FEE 6700, SBT_EXPENSE 6710) + `calcTax`, `calcContractorPay`, TAX rates
- `src/components/ProfitabilityPanel.tsx` — กำไรรายหลัง (cost = งวดผู้รับเหมา + land_cost + infra_cost) แสดงใน `/office` แท็บการเงิน (ผู้บริหารเท่านั้น)
- `src/app/crm/page.tsx` — `markCustInstPaid` รับเงินดาวน์ → ลง finance_transactions + JV (Dr BANK / Cr CUSTOMER_ADVANCE)
- UI: `GlassCard`, `SectionHeader`, สี `aviva-gold/text/secondary/bg/card`; ทุกหน้าเป็น client component ใช้ `supabase` จาก `@/lib/supabase`
- PROJECT_ID = `aaaaaaaa-0000-0000-0000-000000000001`

## 3) DB migration ที่เพิ่มใน v5.86–5.99 (Supabase project `lpxerxxcbxwsjimzougk`)
- `houses.land_cost`, `houses.infra_cost`
- `ar_invoices.jv_id`, `ar_invoices.is_advance`, `ar_payments.jv_id`
- `ap_bills.jv_id`, `ap_bills.expense_account`, `ap_bills.pay_jv_id`
- `vat_register.house_id`, `sbt_register.jv_id`, `sbt_register.house_id`
- chart_of_accounts +4: `1610, 2310, 6700, 6710`
- **constraint ที่ต้องระวัง:** `bank_reconciliation.status` ∈ {draft, reconciled, discrepancy} (ไม่ใช่ balanced/pending)

## 4) งานที่ทำเสร็จแล้ว (v5.86 → v5.99)
- v5.86 ต้นทุนที่ดินรายหลัง · AR→GL · กระทบยอดธนาคาร · ภาษีขายตอนโอน
- v5.87 COGS อัตโนมัติ + แก้บั๊ก bank_reconciliation.status
- v5.88 AP→GL (ตั้งหนี้+จ่าย) · ภาษี/ค่าโอนวันโอนลง GL · เติมผังบัญชี · แก้ Scanner รหัส 7200→5200
- v5.89 งบทดลอง + งบกำไรขาดทุน + งบดุล (จาก jv_lines posted)
- v5.90 TFRS15 รับรู้รายได้ลง JV (กันซ้ำ ref REV-)
- v5.91 ปันส่วนสาธารณูปโภครายแปลง → กำไรรายหลัง
- v5.92 เงินดาวน์ CRM ลง GL + ตัวช่วยโอนกลับเงินรับล่วงหน้าเป็นรายได้
- v5.99 export งบทดลอง CSV + note รวม Matching/BankRec + ไฟล์ handoff นี้

## 5) งานค้าง/หนี้เทคนิค (เข้า v6.0)
- **ยังไม่มีปิดงวด/ล็อก JV** → postJv ลงได้ทุกวันที่ ไม่กันงวดปิด (ต้องทำใน v6.0)
- TFRS15 recognize กับ Tax→โอน เป็น 2 ทาง (มี dedup แต่ควรรวม UX ให้ชัด — ใช้ทางเดียวต่อแปลง)
- MatchingTab (`payments`) ซ้ำซ้อนกับ BankRec (`bank_statements`) — ควรรวม
- ScannerTab เป็น Demo (mock result) ยังไม่ต่อ OCR จริง
- ปันส่วน infra ใช้เฉลี่ยต่อแปลง (ยังไม่ by land_size/by ratio)
- งบยังไม่มี export ทางการ (PDF/ฟอร์มยื่นภาษี) — มีแค่ CSV งบทดลอง

## 6) ธีม v6.0 (อนุมัติทิศทางกับผู้ใช้ก่อนเริ่ม)
**"ระบบบัญชีระดับยื่นกรมสรรพากร/DBD ได้จริง (Statutory-grade Compliance & Reporting)"**
1. ปิดงบ/ล็อกงวด + audit trail ครบ
2. งบการเงินทางการ TFRS for NPAEs (ฐานะการเงิน/กำไรขาดทุน/**กระแสเงินสด**) พิมพ์/PDF
3. ไฟล์ยื่นภาษี: ภ.พ.30 · ภ.ง.ด.1/3/53 · ภ.ธ.40 · ภ.ง.ด.50/51 (RD e-Filing)
4. e-Tax Invoice & e-Receipt (ETDA) ครบ workflow
5. Book-Tax Reconciliation → ภ.ง.ด.50
6. งบเปรียบเทียบหลายงวด + cash flow forecast + KPI การเงิน

## 7) วิธีทดสอบ (E2E pattern ที่ใช้)
- ตรวจ GL integrity: SQL หา jv_entries ที่ Dr≠Cr (ต้องเป็น 0)
- จำลอง workflow จริงด้วย `DO $$ ... BEGIN ... RAISE EXCEPTION 'E2E_ROLLBACK_OK'; EXCEPTION ... END $$;` (insert จริงแล้ว rollback ไม่ทิ้งข้อมูล)
- เทียบงบทดลองด้วย SQL: group jv_lines (posted) by account_type → assets = liabilities + equity + netProfit

## 8) กฎถาวรจาก CLAUDE.md / AGENTS.md (ห้ามลืม)
- **Next.js เวอร์ชันนี้มี breaking changes** — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด
- **Role policy:** CEO/COO สิทธิ์สูงสุด — บังคับ 3 ชั้น (UI `src/lib/roles.ts` · API `@/lib/roles` · RLS `auth_role()`)
- **AVIVA Plus แยกเด็ดขาด** — ห้ามปนโค้ด Plus ใน AVIVA ONE
- **Docs Sync:** เปลี่ยน flow ต้องอัปเดต `settings/manual/page.tsx` (+ org-chart/doc-index ถ้ากระทบ) รอบ deploy เดียวกัน
- **ข้อเสนอแนะ** (`app_suggestions`) ต้อง status `approved` ก่อนพัฒนา → เสร็จแล้ว set `done`
