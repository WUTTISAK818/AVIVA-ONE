# ✅ Defects Tables Migration — Ready for Execution

**Status:** ✅ Code refactored + SQL prepared  
**Target:** Production database  
**Executor:** Vee  
**Date:** 2026-06-30

---

## 📋 What's Being Done

**Merging 2 tables → 1 unified defects table**
- Current: `defects` (0 rows) + `qc_defects` (8 rows) ❌ fragmented
- After: `defects` (8 rows) + filter by `defect_type` ✅ unified

**Why:**
✅ Single source of truth  
✅ Easier queries & reporting  
✅ No duplicate code  

---

## 🔧 SQL Migration Script

**File:** `/tmp/claude-0/-home-user-AVIVA-ONE/2032dc8a-89dc-5e8b-a7fc-ef2fe46a6501/scratchpad/defects-migration.sql`

**Steps (Execute in Supabase SQL Editor):**

### 1️⃣ BACKUP (Critical - Do first!)
```sql
CREATE TABLE qc_defects_backup AS SELECT * FROM qc_defects;
SELECT COUNT(*) FROM qc_defects_backup;  -- Should be 8
```

### 2️⃣ EXTEND defects table
```sql
ALTER TABLE defects ADD COLUMN (
  severity VARCHAR(50) DEFAULT 'medium',
  qc_inspection_date TIMESTAMP NULL,
  assigned_to UUID NULL,
  resolution_date TIMESTAMP NULL,
  defect_type VARCHAR(20) DEFAULT 'construction',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_defects_type ON defects(defect_type);
```

### 3️⃣ MIGRATE DATA
```sql
INSERT INTO defects (
  project_id,
  description,
  severity,
  assigned_to,
  qc_inspection_date,
  defect_type,
  created_at,
  updated_at
)
SELECT
  project_id,
  item AS description,
  COALESCE(severity, 'medium'),
  assigned_to,
  inspection_date,
  'qc_inspection',
  created_at,
  updated_at
FROM qc_defects;
```

### 4️⃣ VERIFY MIGRATION
```sql
-- Should return: total=8, qc_count=8
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN defect_type = 'qc_inspection' THEN 1 END) as qc_count
FROM defects;
```

### 5️⃣ DROP OLD TABLE
```sql
DROP TABLE qc_defects CASCADE;
```

### 6️⃣ FINAL VERIFICATION
```sql
-- Check schema
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'defects' ORDER BY ordinal_position;

-- Check counts by type
SELECT defect_type, COUNT(*) FROM defects GROUP BY defect_type;
```

---

## 📊 Expected Results

After migration:
```
defects table:
- Columns: id, project_id, description, severity, assigned_to, 
           qc_inspection_date, resolution_date, defect_type, created_at, updated_at, ...
- Rows: 8 total (8 with defect_type='qc_inspection', 0 with defect_type='construction')
- Indices: idx_defects_type (for filtering by type)

qc_defects table:
- ❌ No longer exists
- Backup: qc_defects_backup (8 rows) — can delete after confirming

QC Page (/qc):
- ✅ Queries: SELECT * FROM defects WHERE defect_type='qc_inspection'
- ✅ Displays: Same defects as before
```

---

## ⚙️ Code Changes (ONE completed)

### Updated Files:
1. **src/app/qc/page.tsx**
   - Line 11: Changed `qc_defects` → `defects` table
   - Added `.eq('defect_type', 'qc_inspection')` filter
   - Rest of page logic unchanged

2. **src/app/api/qc-defects/[id]/route.ts**
   - Line 48: Changed `qc_defects` → `defects` table
   - Added `.eq('defect_type', 'qc_inspection')` filter
   - PATCH logic unchanged

3. **Build Status:** ✅ Compiled successfully

---

## 🎯 Timeline

1. **NOW:** ONE prepared code + SQL ✅
2. **Vee executes:** SQL migration (5-10 min)
3. **After migration:** Deploy code v6.95 (automatic Vercel trigger)
4. **Verify:** QC page still works + shows 8 defects

---

## ✅ Checklist for Vee

**Before Migration:**
- [ ] Read this doc + understand 5 steps
- [ ] Backup qc_defects_backup table created successfully (COUNT = 8)
- [ ] ONE code already deployed? (check: defects migration script ready)

**During Migration (SQL):**
- [ ] Step 1: Backup ✓
- [ ] Step 2: ALTER defects ✓ (no errors)
- [ ] Step 3: Migrate data ✓ (INSERT successful)
- [ ] Step 4: Verify counts ✓ (8 qc_inspection defects)
- [ ] Step 5: Drop qc_defects ✓
- [ ] Step 6: Final schema check ✓

**After Migration:**
- [ ] Deploy code (automatic via Vercel on GitHub push)
- [ ] Test QC page: /qc loads + shows 8 defects ✓
- [ ] Test QC defect update: PATCH /api/qc-defects/[id] works ✓
- [ ] Delete qc_defects_backup (optional, after confirming)

---

## 🆘 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "column doesn't exist" | Typo in ALTER | Check column name exactly |
| "INSERT failed" | Column mismatch | Verify mapping in INSERT SELECT |
| "Table qc_defects still exists" | DROP didn't run | Check for FK constraints, use CASCADE |
| "QC page 404" | New code deployed but old schema | Re-run migration steps 2-5 |

---

**Prepared by:** ONE  
**Date:** 2026-06-30  
**Commit:** `e20c67b` (code changes)  
**Ready for:** Vee execution  

