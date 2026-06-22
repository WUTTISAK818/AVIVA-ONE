-- Reset interested_count to 0 for A5 project
-- This removes the "1 interested" status that was causing confusion

UPDATE leads 
SET interested_count = 0 
WHERE project_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Verify the change
SELECT 
  id, 
  customer_name, 
  status, 
  contract_signed_date,
  interested_count
FROM leads
WHERE project_id = 'aaaaaaaa-0000-0000-0000-000000000001'
ORDER BY created_at DESC;
