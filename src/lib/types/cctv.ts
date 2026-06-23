// CCTV Events
export interface CCTVEvent {
  id: string;
  event_date: string; // YYYY-MM-DD
  event_time: string; // ISO timestamp
  event_type: 'person_detected' | 'face_recognized' | 'face_not_recognized' | 'visitor_detected' | 'abnormal_activity';
  detected_person_id?: string;
  detected_person_name?: string;
  confidence_score?: number; // 0-1
  camera_id: string;
  frame_url?: string;
  video_start_time?: string;
  video_end_time?: string;
  presence_duration_minutes?: number;
  notes?: string;
  created_at: string;
}

export interface CCTVDailySummary {
  id: string;
  summary_date: string;
  total_events: number;
  total_persons_detected: number;
  unique_employees: number;
  unique_visitors: number;
  avg_presence_duration_minutes: number;
  alerts_count: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CCTVEmployeePresence {
  id: string;
  employee_id: string;
  employee_name: string;
  presence_date: string;
  first_detected_time?: string;
  last_detected_time?: string;
  total_presence_minutes: number;
  detection_count: number;
  status: 'present' | 'absent' | 'partial_day';
  created_at: string;
  updated_at: string;
}

export interface VisitorTracking {
  id: string;
  visit_date: string; // YYYY-MM-DD
  visit_time: string; // ISO timestamp
  visitor_name: string;
  visitor_phone?: string;
  visitor_company?: string;
  purpose?: string;
  host_employee_id?: string;
  host_employee_name?: string;
  check_in_time?: string;
  check_out_time?: string;
  duration_minutes?: number;
  camera_frame_url?: string;
  notes?: string;
  created_at: string;
}

// Daily Analytics
export interface CCTVDailyAnalytics {
  date: string;
  total_events: number;
  employees_present: number;
  visitor_count: number;
  avg_work_duration_hours: number;
  unusual_activities: string[];
  alerts: {
    employee_id: string;
    employee_name: string;
    alert_type: string;
    time: string;
    description: string;
  }[];
}

// Monthly Report
export interface CCTVMonthlyReport {
  month: number;
  year: number;
  total_events: number;
  unique_employees: number;
  unique_visitors: number;
  avg_daily_employees: number;
  avg_daily_visitors: number;
  top_visitors: {
    visitor_name: string;
    visit_count: number;
  }[];
  top_hosts: {
    employee_id: string;
    employee_name: string;
    visitor_count: number;
  }[];
  unusual_activities_detected: number;
}

// CCTV Configuration
export interface CCTVDeviceConfig {
  id: string;
  device_id: string; // Tapo Camera ID
  device_name: string;
  device_ip: string;
  location: string; // e.g., "Entrance", "Office Floor 1", etc.
  is_active: boolean;
  features: {
    face_recognition: boolean;
    ai_tracking: boolean;
    ai_detection: boolean;
    pan_tilt: boolean;
  };
  created_at: string;
  updated_at: string;
}
