import { supabase } from './supabase';

interface TapoConfig {
  cameraIp: string;
  username: string;
  password: string;
  port?: number;
}

interface FacialRecognitionEvent {
  cameraId: string;
  detectedPersonId?: string;
  confidenceScore: number;
  frameUrl?: string;
  eventTime: string;
  eventType: 'face_recognition' | 'person_detection' | 'visitor_detection' | 'alert';
  location?: string;
}

/**
 * TP-Link Tapo C260 AI Camera Integration Service
 *
 * Capabilities:
 * - Facial recognition (detect known faces)
 * - Person detection (count people, track presence)
 * - Visitor detection (unknown faces)
 * - Motion detection with AI filtering
 * - Night vision & 2K resolution
 * - Local & cloud storage support
 */
class TapoCameraService {
  private config: TapoConfig;
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(config: TapoConfig) {
    this.config = {
      port: 443,
      ...config,
    };
    this.baseUrl = `https://${this.config.cameraIp}:${this.config.port}`;
  }

  /**
   * Authenticate with Tapo camera
   * TP-Link uses Tapo Cloud API or local RTSP/HTTP
   */
  async authenticate() {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'login',
          params: {
            username: this.config.username,
            password: this.config.password,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.authToken = data.result?.token;
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Authentication failed',
      };
    }
  }

  /**
   * ดึงเหตุการณ์การตรวจจับใบหน้า
   */
  async getFacialRecognitionEvents(
    startTime: string,
    endTime: string,
    cameraId: string = 'tapo-c260-01'
  ) {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      // สำหรับ Tapo cameras ใช้ local HTTP API
      const response = await fetch(`${this.baseUrl}/api/media/list`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch events');

      const data = await response.json();
      const events = Array.isArray(data.result?.list)
        ? data.result.list.filter(
            (e: any) =>
              e.type === 'face' &&
              e.time >= new Date(startTime).getTime() &&
              e.time <= new Date(endTime).getTime()
          )
        : [];

      return { ok: true, data: events };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to fetch facial recognition events',
      };
    }
  }

  /**
   * ดึงข้อมูลการตรวจจับบุคคล (person detection)
   */
  async getPersonDetectionEvents(
    startTime: string,
    endTime: string,
    cameraId: string = 'tapo-c260-01'
  ) {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const response = await fetch(`${this.baseUrl}/api/media/list`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch events');

      const data = await response.json();
      const events = Array.isArray(data.result?.list)
        ? data.result.list.filter(
            (e: any) =>
              e.type === 'person' &&
              e.time >= new Date(startTime).getTime() &&
              e.time <= new Date(endTime).getTime()
          )
        : [];

      return { ok: true, data: events };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to fetch person detection events',
      };
    }
  }

  /**
   * ตรวจจับผู้มาเยี่ยม (unknown faces) โดยเปรียบเทียบกับ employee database
   */
  async detectUnknownVisitors(
    startTime: string,
    endTime: string,
    cameraId: string = 'tapo-c260-01'
  ) {
    try {
      // ดึงเหตุการณ์ใบหน้าทั้งหมด
      const facialResult = await this.getFacialRecognitionEvents(startTime, endTime, cameraId);
      if (!facialResult.ok) throw new Error(facialResult.error);

      // ดึงรายชื่อพนักงาน (known faces)
      const { data: employees } = await supabase
        .from('employees')
        .select('id, first_name, last_name, cctv_face_encoding')
        .not('cctv_face_encoding', 'is', null);

      const knownIds = new Set(employees?.map((e) => e.id) || []);
      const unknownVisitors = facialResult.data.filter((event: any) => !knownIds.has(event.person_id));

      return { ok: true, data: unknownVisitors };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to detect unknown visitors',
      };
    }
  }

  /**
   * บันทึก CCTV event ลงฐานข้อมูล
   */
  async recordCCTVEvent(event: FacialRecognitionEvent) {
    try {
      const { data, error } = await supabase
        .from('cctv_events')
        .insert([
          {
            event_type: event.eventType,
            detected_person_id: event.detectedPersonId,
            confidence_score: event.confidenceScore,
            camera_id: event.cameraId,
            frame_url: event.frameUrl,
            location: event.location || 'entrance',
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to record event',
      };
    }
  }

  /**
   * ติดตามระยะเวลาอยู่ของพนักงาน
   */
  async trackEmployeePresence(
    employeeId: string,
    detectionTime: string,
    cameraId: string = 'tapo-c260-01'
  ) {
    try {
      const workDate = detectionTime.split('T')[0];

      // ตรวจสอบบันทึกอยู่แล้วหรือไม่
      const { data: existingRecord } = await supabase
        .from('cctv_employee_presence')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('work_date', workDate)
        .single();

      if (existingRecord) {
        // Update: increment count and calculate total duration
        const currentDuration = existingRecord.total_presence_minutes || 0;
        const newDuration = currentDuration + 1; // 1 minute per detection

        const { data, error } = await supabase
          .from('cctv_employee_presence')
          .update({
            detection_count: (existingRecord.detection_count || 0) + 1,
            total_presence_minutes: newDuration,
            last_detection: detectionTime,
          })
          .eq('id', existingRecord.id)
          .select()
          .single();

        if (error) throw error;
        return { ok: true, data, action: 'update' };
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('cctv_employee_presence')
          .insert([
            {
              employee_id: employeeId,
              work_date: workDate,
              detection_count: 1,
              total_presence_minutes: 1,
              camera_id: cameraId,
              first_detection: detectionTime,
              last_detection: detectionTime,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        return { ok: true, data, action: 'create' };
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to track presence',
      };
    }
  }

  /**
   * สร้างรายงานรายวัน
   */
  async generateDailySummary(date: string, cameraId: string = 'tapo-c260-01') {
    try {
      const startTime = `${date}T00:00:00Z`;
      const endTime = `${date}T23:59:59Z`;

      // ดึงเหตุการณ์ทั้งหมดของวัน
      const { data: events } = await supabase
        .from('cctv_events')
        .select('*')
        .eq('camera_id', cameraId)
        .gte('created_at', startTime)
        .lte('created_at', endTime);

      const totalEvents = events?.length || 0;
      const faceRecognitionEvents = events?.filter((e) => e.event_type === 'face_recognition').length || 0;
      const uniqueEmployees = new Set(
        events
          ?.filter((e) => e.detected_person_id)
          .map((e) => e.detected_person_id)
      ).size;

      // Count unknown persons (visitors)
      const { data: unknownVisitors } = await supabase
        .from('unknown_visitors')
        .select('*')
        .gte('detection_time', startTime)
        .lte('detection_time', endTime);

      // Create or update daily summary
      const { data, error } = await supabase
        .from('cctv_daily_summary')
        .upsert([
          {
            camera_id: cameraId,
            work_date: date,
            total_events: totalEvents,
            face_recognition_count: faceRecognitionEvents,
            unique_employees: uniqueEmployees,
            visitor_count: unknownVisitors?.length || 0,
            alerts_count: events?.filter((e) => e.event_type === 'alert').length || 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to generate summary',
      };
    }
  }

  /**
   * ดึง Live stream URL
   */
  async getLiveStreamUrl(resolution: '720p' | '1080p' | '2k' = '2k'): Promise<{
    ok: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      // TP-Link Tapo ใช้ RTSP protocol สำหรับ live streaming
      const rtspPort = 554;
      const streamUrl = `rtsp://${this.config.username}:${this.config.password}@${this.config.cameraIp}:${rtspPort}/stream1`;
      return { ok: true, url: streamUrl };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to get stream URL',
      };
    }
  }
}

export default TapoCameraService;

let tapoCameraInstance: TapoCameraService | null = null;

export function getTapoCameraService(config?: TapoConfig): TapoCameraService {
  if (!tapoCameraInstance && config) {
    tapoCameraInstance = new TapoCameraService(config);
  }
  if (!tapoCameraInstance) {
    throw new Error('TapoCameraService not initialized. Provide config first.');
  }
  return tapoCameraInstance;
}
