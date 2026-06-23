# Hikvision Fingerprint Scanner Integration Guide

## 📋 Setup Instructions

### 1. Hardware Setup (Physical)

#### Device: Hikvision DS-K1T320MFWX-B
- Location: Sales office entrance
- Network: Connect to WiFi/LAN
- Power: 12V DC

#### Get Device Information
```bash
# Check device IP on your router or use:
# 1. Press and hold menu on device for 3 seconds
# 2. Navigate to: Settings → Network → IP Address
# 3. Note the IP address (e.g., 192.168.1.100)
```

---

### 2. Environment Variables Setup

#### Add to `.env.local` (Local Development)
```env
# Hikvision Device Configuration
HIKVISION_IP=192.168.1.100
HIKVISION_PORT=8080
HIKVISION_USERNAME=admin
HIKVISION_PASSWORD=your_device_password_here
```

#### Add to Vercel Environment Variables (Production)
```
Project Settings → Environment Variables

Add these variables:
- HIKVISION_IP: 192.168.1.100
- HIKVISION_PORT: 8080
- HIKVISION_USERNAME: admin
- HIKVISION_PASSWORD: [Your secure password]
```

**🔐 Security Note:** 
- Change default password immediately on device
- Use strong password (min 8 characters, mix case + numbers)
- Never commit passwords to Git

---

### 3. Employee Mapping (Database)

#### Link Employee to Hikvision Person ID

Two ways to map:

##### Option A: Manual via SQL
```sql
UPDATE employees
SET hikvision_person_id = 'P1001'
WHERE id = 'E001';

UPDATE employees
SET hikvision_person_id = 'P1002'
WHERE id = 'E002';
```

##### Option B: Via API (Coming Soon)
```bash
POST /api/hikvision/map-employee
{
  "employee_id": "E001",
  "hikvision_person_id": "P1001"
}
```

#### Find Hikvision Person ID
```bash
# Method 1: Check on device display
# Navigate to: Settings → Personnel → View ID

# Method 2: Query via API
POST /api/hikvision/get-persons
Authorization: Bearer YOUR_TOKEN

Response:
{
  "persons": [
    {
      "personId": "P1001",
      "name": "สมชาย",
      "fingerprints": 1
    }
  ]
}
```

---

### 4. Testing the Integration

#### Test 1: Device Connection
```bash
# Check if device is reachable
curl -u admin:password http://192.168.1.100:8080/ISAPI/AccessControl/PersonList

# Expected: XML or JSON response with person list
```

#### Test 2: Manual Sync
```bash
# Sync attendance for today
POST /api/hikvision/sync
{
  "startTime": "2026-06-23T08:00:00Z",
  "endTime": "2026-06-23T18:00:00Z"
}

# Response:
{
  "success": true,
  "data": {
    "total": 10,
    "success": 8,
    "failed": 2
  }
}
```

#### Test 3: Check Sync Logs
```sql
SELECT * FROM sync_logs 
WHERE source = 'hikvision'
ORDER BY sync_date DESC 
LIMIT 5;
```

---

### 5. Auto-Sync Configuration

#### Vercel Cron Job (Recommended)
- **Frequency:** Every 5 minutes
- **Endpoint:** `/api/cron/hikvision/sync-attendance`
- **Time Window:** Looks back 10 minutes
- **Automatic:** Runs without manual intervention

#### Setup Verification
```bash
# Check Vercel crons:
vercel env list

# Check cron execution in Vercel dashboard:
# Project → Deployments → Cron
```

#### Manual Sync (Testing)
```bash
# Sync today's data
curl -X GET http://localhost:3000/api/hikvision/sync

# Sync specific period
curl -X POST http://localhost:3000/api/hikvision/sync \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2026-06-23T08:00:00Z",
    "endTime": "2026-06-23T18:00:00Z"
  }'
```

---

### 6. Attendance Data Flow

```
Hikvision Device
  ↓ Employee scans fingerprint (08:45 AM)
  ↓ Device stores event
  ↓ ISAPI API
  ↓ Cronjob (every 5 min)
  ↓
AVIVA ONE
  ├─ attendance_records table
  │   ├─ check_in_time: 2026-06-23T08:45:00Z
  │   ├─ status: present
  │   └─ device_id: hikvision-ds-k1t320
  │
  ├─ HR View (/attendance)
  │   └─ "สมชาย: Checked in at 08:45"
  │
  ├─ Finance (/payroll)
  │   └─ Check deductions for late (>09:00)
  │
  ├─ Manager Dashboard
  │   └─ Daily attendance report
  │
  └─ sync_logs table
      └─ Record of sync operation
```

---

### 7. Troubleshooting

#### Issue 1: Device Not Responding
```
Error: "Failed to connect to Hikvision device"

Solution:
1. Check device is powered on
2. Verify IP address: ping 192.168.1.100
3. Check WiFi connection on device
4. Restart device (power off/on)
5. Verify port 8080 is open (try curl above)
```

#### Issue 2: Authentication Failed
```
Error: "Unauthorized (401)"

Solution:
1. Verify username/password is correct
2. Check for leading/trailing spaces
3. Ensure firewall allows port 8080
4. Reset device to factory defaults if needed
```

#### Issue 3: No Events Synced
```
Error: "0 events processed"

Solution:
1. Verify fingerprints are registered on device
2. Check hikvision_person_id mapping
3. Verify employee exists in database
4. Check sync logs: SELECT * FROM sync_logs
```

#### Issue 4: Duplicate Records
```
Error: "Multiple check-ins for same person"

Solution:
- System prevents duplicates via hikvision_event_id
- Check sync_logs for errors
- Manually delete duplicate with: 
  DELETE FROM attendance_records WHERE hikvision_event_id = 'duplicate_id'
```

---

### 8. Monitoring & Maintenance

#### Daily Checklist
```
□ Check device LED (green = normal, red = error)
□ Verify WiFi connection
□ Check sync logs: SELECT COUNT(*) FROM sync_logs WHERE sync_date > NOW() - INTERVAL '1 day'
□ Monitor attendance entries in database
□ Check for errors in Vercel logs
```

#### Weekly Tasks
```
□ Verify all employees can scan fingerprints
□ Check for failed sync events
□ Review payroll deductions from late arrivals
□ Backup database
```

#### Monthly Tasks
```
□ Clean up old sync logs (>30 days)
□ Review device firmware updates (Hikvision website)
□ Audit employee mappings
□ Generate attendance report
```

---

### 9. API Reference

#### GET /api/hikvision/sync (Today's Data)
```bash
curl -X GET http://localhost:3000/api/hikvision/sync
```

#### POST /api/hikvision/sync (Custom Period)
```bash
curl -X POST http://localhost:3000/api/hikvision/sync \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2026-06-20T00:00:00Z",
    "endTime": "2026-06-23T23:59:59Z"
  }'
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "total": 45,
    "success": 43,
    "failed": 2
  },
  "message": "Synced 45 events: 43 success, 2 failed"
}
```

---

### 10. Next Steps

1. ✅ Physical setup complete
2. ⏳ Configure environment variables
3. ⏳ Map employees to Hikvision Person IDs
4. ⏳ Test manual sync
5. ⏳ Enable auto-sync (Vercel cron)
6. ⏳ Monitor for 1 week
7. ⏳ Prepare for TP-Link Tapo camera integration

---

### 11. Future: AI Camera Integration

When TP-Link Tapo C260 arrives:
- Will add facial recognition alongside fingerprint
- Unknown person detection for customers
- Real-time alerts for unauthorized access
- No changes needed to existing fingerprint system

---

**Support**: For issues contact: joyus818@gmail.com
