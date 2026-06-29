-- Delete mock/test employees (3 persons)
-- These are placeholder records created for testing purposes
-- Real employees (5 persons) with Hikvision integration remain:
-- - Fah (PersonID 1, Sales)
-- - Peet (PersonID 2, Engineer, Construction)
-- - Roong (PersonID 4, Garden)
-- - Aon (PersonID 5)
-- - Dear (PersonID 6)

-- Verify before delete
SELECT emp_id, full_name, position, department
FROM employees
WHERE emp_id IN ('EMP-004', 'EMP-003', 'EMP-002')
ORDER BY emp_id;

-- Delete mock employees
DELETE FROM employees
WHERE emp_id IN ('EMP-004', 'EMP-003', 'EMP-002')
AND full_name IN (
  'นางสาวสิริพร เมรวี',
  'นายณัฐพล วีรัฒนา',
  'นางสาวปภาดา รัตนโทวิก'
);

-- Verify real employees still exist
SELECT id, emp_id, full_name, position, department, hikvision_person_id
FROM employees
WHERE hikvision_person_id IS NOT NULL
   OR emp_id = 'EMP-0010'
ORDER BY COALESCE(hikvision_person_id, 999), emp_id;
