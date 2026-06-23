# TP-Link Tapo C260 Camera Integration Guide

## 📋 Setup Instructions

### 1. Hardware Setup (Physical)

#### Device: TP-Link Tapo C260
- **Features:**
  - 2K Resolution (2560×1920)
  - Facial recognition with AI
  - Person detection
  - Night vision (IR + starlight)
  - Two-way audio
  - Motion tracking
  - Local & cloud storage

- **Installation:**
  - Location: Office entrance
  - Network: WiFi 2.4GHz/5GHz
  - Power: USB-C or PoE
  - Recommended height: 1.5-2m above ground

#### Initial Setup
```bash
1. Power on camera
2. Download TP-Link Tapo app (iOS/Android)
3. Scan QR code on camera
4. Connect to WiFi
5. Set password (min 8 chars, mix case + numbers)
6. Note the IP address from app
```

---

### 2. Environment Variables Setup

#### Add to `.env.local` (Local Development)
```env
# TP-Link Tapo Camera Configuration
TAPO_CAMERA_IP=192.168.1.101
TAPO_USERNAME=admin@example.com
TAPO_PASSWORD=your_camera_password_here
```

#### Add to Vercel Environment Variables (Production)
```
Project Settings → Environment Variables

Add these variables:
- TAPO_CAMERA_IP: 192.168.1.101
- TAPO_USERNAME: admin@example.com
- TAPO_PASSWORD: [Your secure password]
```

**🔐 Security Note:**
- Change default password immediately
- Use strong password (min 8 characters, mix case + numbers + symbols)
- Never commit passwords to Git

---

### 3. Enable AI Features on Camera

#### Via Tapo App
```
Settings → AI → Enable:
  ☑ Person Detection
  ☑ Face Recognition
  ☑ Motion Detection
  ☑ Visitor Detection
```

#### Via Web Interface (Optional)
```
http://192.168.1.101:8800
Login with admin credentials
Settings → Detection → Enable all AI features
```

---

### 4. Face Database Setup (For Known Employees)

#### Option A: Add via Tapo App
```
1. Open Tapo app
2. Go to Device Settings
3. Face Library → Add faces
4. Upload employee photos
5. Tag with employee ID
```

#### Option B: Add via API (Coming Soon)
```bash
POST /api/tapo/add-face
{
  "employee_id": "E001",
  "photo_url": "https://...",
  "name": "สมชาย ศรีวิทยา"
}
```

---

### 5. Testing the Integration

#### Test 1: Camera Connection
```bash
# Check if camera is reachable
curl -u admin@example.com:password http://192.168.1.101:8800/api/status

# Expected: JSON response with device info
```

#### Test 2: Manual Sync
```bash
# Get unknown visitors for today
GET /api/tapo/detect-unknown?startTime=2026-06-23T00:00:00Z&endTime=2026-06-23T23:59:59Z

# Response:
{
  "success": true,
  "count": 3,
  "message": "Detected 3 unknown visitors",
  "data": [...]
}
```

#### Test 3: Daily Summary
```bash
# Get daily CCTV summary
GET /api/tapo/daily-summary?date=2026-06-23

# Response:
{
  "success": true,
  "data": {
    "total_events": 245,
    "unique_employees": 42,
    "visitor_count": 8,
    "alerts_count": 2
  }
}
```

---

### 6. Auto-Sync Configuration

#### Vercel Cron Job (Recommended)
- **Frequency:** Every 5 minutes
- **Endpoint:** `/api/cron/tapo/sync-camera`
- **Operations:**
  - Fetch facial recognition events
  - Fetch person detection events
  - Detect unknown visitors
  - Update daily summary

#### Sync Details
```
Timeline:
├─ Check-in: Employee enters office (08:45)
│   └─ Camera detects face
│   └─ Matches with face database
│   └─ Records: person_id = "E001"
│
├─ Work Hours: Movement tracking
│   └─ Camera tracks presence
│   └─ Increments detection_count
│   └─ Calculates total_presence_minutes
│
├─ Customer Visit: Unknown person enters
│   └─ Camera detects new face
│   └─ Does NOT match face database
│   └─ Records as "Unknown Visitor #1"
│   └─ Tracks duration: 12:00 - 13:15 (1h 15min)
│
└─ Check-out: Employee leaves
    └─ Camera detects exit
    └─ Records: last_detection time
```

---

### 7. Data Flow for Different Users

#### 🔵 HR Department
```
Employee presence tracking → Sync logs
├─ "สมชาย: Present 9 hrs today"
├─ "วิจิตรา: Absent (no detection)"
└─ Alert: "4 employees missing check-in"
```

#### 🟢 Finance Department
```
CCTV data + Attendance data → Payroll
├─ Employee duration matches attendance
├─ Late deduction: auto-calculated
└─ Verification: CCTV timestamp vs scan time
```

#### 🟡 Sales Department
```
Unknown visitor detection → Lead tracking
├─ "Unknown Person #1: Visited 1h 15min"
├─ "Unknown Person #2: Visited 45min"
├─ "Potential: High interest (long visit)"
└─ Follow-up: Contact host employee
```

#### 🔴 Management
```
Daily CCTV Report → Executive Dashboard
├─ Attendance: 45 present, 2 absent
├─ Traffic: 8 customer visits
├─ Visitors: Avg duration 52 min
├─ Alerts: 2 unauthorized access attempts
└─ Trend: Customer visits ↑ 15% vs last week
```

---

### 8. Unknown Visitor Tracking (For Sales)

#### Detection Logic
```
New face detected?
    ├─ Yes, in face database → Known employee
    │   └─ Track presence in attendance
    │
    └─ No, NOT in face database → Unknown visitor
        ├─ Create record: unknown_visitor_id = "UV_20260623_001"
        ├─ Capture: entry_time, exit_time, duration
        ├─ Store: face image frame (for reference)
        ├─ Calculate: confidence score
        │
        └─ Link to: host_employee (who they met)
            └─ Sales rep can mark as "Customer" or "Lead"
```

#### Sample Data
```json
{
  "unknown_visitor_id": "UV_20260623_001",
  "entry_time": "2026-06-23T10:30:00Z",
  "exit_time": "2026-06-23T11:45:00Z",
  "duration_minutes": 75,
  "confidence_score": 0.98,
  "host_employee_id": "E003",
  "status": "identified",
  "customer_name": "บริษัท ABC Co., Ltd.",
  "purpose": "Project inquiry",
  "follow_up_date": "2026-06-25"
}
```

---

### 9. API Reference

#### GET /api/tapo/detect-unknown (Detect Customers)
```bash
curl -X GET "http://localhost:3000/api/tapo/detect-unknown?startTime=2026-06-23T08:00:00Z&endTime=2026-06-23T18:00:00Z"

Response:
{
  "success": true,
  "count": 3,
  "message": "Detected 3 unknown visitors",
  "data": [
    {
      "personId": "UV_001",
      "entryTime": "2026-06-23T10:30:00Z",
      "exitTime": "2026-06-23T11:45:00Z",
      "durationMinutes": 75
    }
  ]
}
```

#### POST /api/tapo/record-event (Record CCTV Event)
```bash
curl -X POST "http://localhost:3000/api/tapo/record-event" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "face_recognition",
    "detected_person_id": "E001",
    "confidence_score": 0.98,
    "camera_id": "tapo-c260-01",
    "location": "entrance"
  }'

Response:
{
  "success": true,
  "data": {
    "id": "event-uuid",
    "recorded_at": "2026-06-23T10:30:15.000Z"
  }
}
```

#### GET /api/tapo/daily-summary (Daily Report)
```bash
curl -X GET "http://localhost:3000/api/tapo/daily-summary?date=2026-06-23"

Response:
{
  "success": true,
  "data": {
    "work_date": "2026-06-23",
    "total_events": 245,
    "face_recognition_count": 150,
    "unique_employees": 42,
    "visitor_count": 8,
    "alerts_count": 2
  }
}
```

---

### 10. Troubleshooting

#### Issue 1: Camera Not Connecting
```
Error: "Failed to authenticate with camera"

Solution:
1. Verify camera is powered on
2. Check WiFi connection (WiFi icon on camera)
3. Verify IP address: ping 192.168.1.101
4. Check credentials (case-sensitive)
5. Restart camera (power off/on)
6. Reset to factory defaults if needed
```

#### Issue 2: Face Recognition Not Working
```
Error: "0 faces detected"

Solution:
1. Check AI features enabled in Tapo app
2. Verify lighting (30-300 lux optimal)
3. Ensure faces are visible (no masks, sunglasses)
4. Train more photos (10+ photos per person)
5. Adjust camera angle (eye-level recommended)
```

#### Issue 3: No Unknown Visitor Detection
```
Error: "No unknown visitors detected"

Solution:
1. Verify face database has known employees
2. Check confidence threshold (default 0.8)
3. Verify visitor actually appeared on camera
4. Check if person is already in database
5. Review camera field of view
```

#### Issue 4: Duplicate Records
```
Error: "Same visitor detected multiple times"

Solution:
- System uses confidence scoring to deduplicate
- Manual cleanup: DELETE FROM unknown_visitors WHERE created_at < NOW() - INTERVAL '7 days'
- Adjust detection interval in cronjob
```

---

### 11. Monitoring & Maintenance

#### Daily Checklist
```
□ Camera LED status (blue = online, red = error)
□ WiFi connection stable
□ CCTV events recorded in database
□ No authentication errors in logs
□ Facial recognition working
```

#### Weekly Tasks
```
□ Review unknown visitor data
□ Check AI detection accuracy
□ Clean face database (remove old employees)
□ Monitor sync logs for errors
□ Review customer visit duration trends
```

#### Monthly Tasks
```
□ Firmware update check (TP-Link website)
□ Camera lens cleaning
□ Audit face database
□ Generate sales leads report from visitor data
□ Database cleanup (archive old records)
```

---

### 12. Integration with Existing Systems

#### Attendance System
```
Hikvision (Fingerprint) + Tapo (Facial)
├─ Fingerprint: Primary check-in/out
├─ Facial: Secondary verification & presence tracking
└─ Comparison: Verify scan time matches camera detection
```

#### Payroll System
```
CCTV data → Finance verification
├─ Work duration: verified by camera presence
├─ Late arrivals: cross-check with timestamp
├─ Unauthorized absences: detected by no facial recognition
└─ Deduction calculation: uses verified data
```

#### Sales System
```
Unknown visitor tracking → Sales pipeline
├─ Visitor detection: triggers CRM lead creation
├─ Visit duration: indicates interest level
├─ Follow-up: auto-scheduled based on detection
└─ Analytics: visitor trends vs sales conversion
```

---

### 13. Security & Privacy

#### Data Protection
- ✅ Face images encrypted at rest
- ✅ All API calls use HTTPS
- ✅ Row-Level Security (RLS) in database
- ✅ Access logs for audit trail

#### Privacy Compliance
- ✅ Visitor data: 30-day retention by default
- ✅ Employee data: kept for employment duration
- ✅ User consent: required before facial recognition
- ✅ GDPR compliant: data deletion on request

#### Best Practices
1. Inform visitors about CCTV monitoring
2. Post privacy notice at entrance
3. Regular access audit (who accessed CCTV data)
4. Backup face database monthly
5. Review RLS policies quarterly

---

### 14. Next Steps (Future Enhancements)

- [ ] Real-time alerts for unusual activities
- [ ] Heat map: where visitors spend most time
- [ ] Conversion analysis: visitor duration vs sales
- [ ] Mobile app: live camera feed
- [ ] Integration with CRM: auto-create leads
- [ ] Alert: unauthorized persons detected
- [ ] Report: daily visitor summary for sales team
- [ ] Multi-camera support (additional Tapo cameras)

---

**Status:** Ready to deploy when camera arrives
**Setup Time:** ~30 minutes
**Configuration:** Environment variables + face database

**Support**: For issues contact: joyus818@gmail.com
