# 📋 Defects Tables — Design Decision Analysis

**Issue:** ตาราง `defects` และ `qc_defects` ใช้อยู่ 2 ตาราง (data duplicated, UI แยก)  
**สถานะ:** ⏳ รอ Pom ตัดสิน design  
**Impact:** ❌ HIGH — ทำให้ data ไม่สมบูรณ์ + UI ซ้ำเหลือเฟือ

---

## 📊 สถานการณ์ปัจจุบัน

### ตาราง defects (ก่อสร้าง)
```
location: /construction/defects
schema: defects table
data: 0 rows
fields: defect_id, project_id, description, status, ...
```

### ตาราง qc_defects (QC Module)
```
location: /qc/defects
schema: qc_defects table
data: 8 rows (มีข้อมูลจริง)
fields: defect_id, project_id, item, severity, assigned_to, ...
```

### ปัญหา
❌ **Data Fragmentation:** ข้อมูล defect แยกกัน 2 ที่  
❌ **Duplicate Logic:** ทั้ง /construction และ /qc ต้อง query + manage defect เอง  
❌ **Inconsistent UI:** หน้า construction defect ว่าง ส่วน QC defect มีข้อมูล → ผู้ใช้งง  
❌ **Schema Mismatch:** ชื่อ field ต่างกัน (defect_id vs item_id)  

---

## 🎯 Option 1: รวมตาราง (Recommended ✓)

**แนวคิด:** ใช้ `defects` เป็นตารางหลัก, ลบ `qc_defects`, migrate ข้อมูล 8 แถว

### ขั้นตอน
1. **Extend defects schema** — เพิ่ม columns สำหรับ QC ที่ต้อง:
   ```sql
   ALTER TABLE defects ADD COLUMN (
     severity ENUM('low', 'medium', 'high', 'critical'),
     qc_inspection_date TIMESTAMP,
     assigned_to UUID,
     resolution_date TIMESTAMP,
     defect_type ENUM('construction', 'qc_inspection') DEFAULT 'construction'
   );
   ```

2. **Migrate data** — ย้าย 8 แถว จาก qc_defects → defects:
   ```sql
   INSERT INTO defects (project_id, item, severity, assigned_to, defect_type, ...)
   SELECT project_id, item, severity, assigned_to, 'qc_inspection', ...
   FROM qc_defects;
   ```

3. **Drop old table** — ลบ qc_defects:
   ```sql
   DROP TABLE qc_defects;
   ```

4. **Consolidate UI:**
   - ลบ `/qc/defects` page
   - Extend `/construction/defects` ให้รองรับ filter by defect_type
   - Role: QC user เห็นแค่ defect_type='qc_inspection'

### ✅ Pros
- ✅ Single source of truth
- ✅ Easier to query across all defects
- ✅ Consistent UI
- ✅ No duplicate logic

### ⚠️ Cons
- ⚠️ Schema migration (พอ riskable ถ้า execute ถูก)
- ⚠️ UI refactor (medium effort)
- ⚠️ ต้อง RLS policy เพื่อ filter by role

---

## 🎯 Option 2: Keep Separate (Not Recommended ✗)

**แนวคิด:** ทิ้งเรื่องนี้ไป, ใช้ 2 ตาราง ต่อไป

### ✅ Pros
- ✅ Zero risk (no migration)
- ✅ Separate concerns (construction ≠ QC)

### ⚠️ Cons
- ❌ Data fragmented ยังคงมี
- ❌ Duplicate UI code
- ❌ Hard to report across all defects
- ❌ ผู้ใช้งง (2 defect sources)

---

## 🎯 Option 3: Hybrid — Add View Layer

**แนวคิด:** เก็บ 2 ตาราง แต่สร้าง "view" ให้ application query จากตารางเดียว

```sql
CREATE VIEW all_defects AS
SELECT defect_id, project_id, description, severity, defect_type FROM defects
WHERE defect_type = 'construction'
UNION ALL
SELECT defect_id, project_id, item as description, severity, 'qc_inspection' FROM qc_defects;
```

### ✅ Pros
- ✅ Zero risk (view only, no migration)
- ✅ UI ดู unified

### ⚠️ Cons
- ⚠️ Still fragmented at storage level
- ⚠️ Complex join/sync logic
- ⚠️ Hard to maintain

---

## 📊 Comparison Table

| Aspect | Option 1 (Merge) | Option 2 (Keep) | Option 3 (View) |
|--------|------------------|-----------------|-----------------|
| **Data Integrity** | ✅✅ Unified | ❌ Fragmented | ⚠️ Fragmented |
| **Query Performance** | ✅✅ Fast | ⚠️ Need UNION | ⚠️ Need VIEW |
| **Implementation Risk** | ⚠️ Medium | ✅ None | ⚠️ Low-Medium |
| **UI Complexity** | ⚠️ Refactor needed | ⚠️ Duplicate | ✅ Moderate |
| **Future Scalability** | ✅✅ Easy | ❌ Hard | ⚠️ Moderate |

---

## 💡 ONE's Recommendation

**👉 Option 1 (Merge) = BEST CHOICE**

**เหตุผล:**
1. ✅ Data integrity ที่สุด (single table for all defects)
2. ✅ Easier to maintain long-term
3. ✅ Better for reporting + analytics
4. ✅ Only medium risk ถ้าทำ step by step + test ก่อน

**ถ้ารอ Pom ตัดสิน:**
- ถ้า "Option 1" → ONE ready ทำได้ (2-3 ชั่วโมง + testing)
- ถ้า "Option 2" → ไม่ต้องทำอะไร, ปิดงานได้
- ถ้า "Option 3" → ONE ทำได้ แต่ต้อง carefully manage view logic

---

## 🔍 SQL Preview (ถ้าเลือก Option 1)

```sql
-- Step 1: Extend defects
ALTER TABLE defects ADD COLUMN (
  severity VARCHAR(50),
  qc_inspection_date TIMESTAMP NULL,
  assigned_to UUID NULL,
  resolution_date TIMESTAMP NULL,
  defect_type VARCHAR(20) DEFAULT 'construction'
);

-- Step 2: Migrate data (BEFORE: backup qc_defects!)
INSERT INTO defects (...columns...)
SELECT ...mapped fields... FROM qc_defects;

-- Step 3: Drop old table
DROP TABLE qc_defects;

-- Step 4: Create RLS for role-based filtering
-- QC users see: defect_type IN ('construction', 'qc_inspection')
-- Construction users see: defect_type = 'construction'
```

---

## 📋 Decision Checklist for Pom

- [ ] **Option 1 (Merge & Consolidate)** — Best for data integrity
- [ ] **Option 2 (Keep Separate)** — Fast path, accept fragmentation
- [ ] **Option 3 (View Layer)** — Middle ground, moderate complexity

**ให้ Pom select ข้างบนนี้ แล้วบอก ONE ทำต่อได้เลย**

---

**Prepared by:** ONE  
**Date:** 2026-06-30  
**Ready for:** Pom's decision  
