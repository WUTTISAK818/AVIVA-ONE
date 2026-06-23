import { supabase } from './supabase';
import type { AttendanceRecord } from './types/attendance';

interface HikvisionConfig {
  deviceIp: string;
  username: string;
  password: string;
  port?: number;
}

interface HikvisionEvent {
  employeeId: string;
  checkInTime?: string;
  checkOutTime?: string;
  fingerprintId: string;
  deviceTime: string;
  eventType: 'checkin' | 'checkout';
}

// ============================================
// HIKVISION FINGERPRINT INTEGRATION
// ============================================

class HikvisionService {
  private config: HikvisionConfig;
  private baseUrl: string;

  constructor(config: HikvisionConfig) {
    this.config = {
      port: 8080,
      ...config,
    };
    this.baseUrl = `http://${this.config.deviceIp}:${this.config.port}/ISAPI`;
  }

  /**
   * ทำการ authenticate กับ Hikvision device
   */
  private getAuthHeader(): string {
    const credentials = `${this.config.username}:${this.config.password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * ดึงข้อมูลเหตุการณ์จาก Hikvision ตามช่วงเวลา
   */
  async getAccessEvents(
    startTime: string, // ISO format: 2026-06-23T08:00:00Z
    endTime: string    // ISO format: 2026-06-23T18:00:00Z
  ) {
    try {
      const response = await fetch(
        `${this.baseUrl}/AccessControl/AcsEvent?beginTime=${startTime}&endTime=${endTime}&maxResults=1000`,
        {
          method: 'GET',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Hikvision API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { ok: true, data: data.AcsEventList || [] };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to fetch events',
      };
    }
  }

  /**
   * ดึงข้อมูลพนักงาน (Person) ที่มี fingerprint บันทึกไว้
   */
  async getPersonList() {
    try {
      const response = await fetch(`${this.baseUrl}/AccessControl/PersonList`, {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Hikvision API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { ok: true, data: data.PersonInfoList || [] };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to fetch persons',
      };
    }
  }

  /**
   * ดึงข้อมูล Fingerprint ของพนักงานคนหนึ่ง
   */
  async getPersonFingerprints(personId: string) {
    try {
      const response = await fetch(
        `${this.baseUrl}/AccessControl/PersonInfo/${personId}`,
        {
          method: 'GET',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Hikvision API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to fetch fingerprints',
      };
    }
  }

  /**
   * Map Hikvision event เป็น Attendance Record
   */
  async processEvent(event: any) {
    try {
      // Extract data from Hikvision event
      const personId = event.EmployeeId || event.PersonID;
      const eventTime = event.EventTime || new Date().toISOString();
      const eventType = event.EventType || 'unknown'; // 0=in, 1=out

      // ค้นหา Employee ใน AVIVA ONE database จาก Hikvision Person ID
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('hikvision_person_id', personId)
        .single();

      if (employeeError || !employee) {
        console.warn(`Employee not found for Hikvision Person ID: ${personId}`);
        return { ok: false, error: 'Employee mapping not found' };
      }

      const workDate = eventTime.split('T')[0];
      const eventTypeStr = eventType === 0 || eventType === 'in' ? 'check_in' : 'check_out';

      // ตรวจสอบว่ามีบันทึกในวันนี้แล้วไหม
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('work_date', workDate)
        .single();

      if (eventTypeStr === 'check_in') {
        // บันทึก check-in ใหม่
        const { data, error } = await supabase
          .from('attendance_records')
          .insert([
            {
              employee_id: employee.id,
              check_in_time: eventTime,
              work_date: workDate,
              status: 'present',
              device_id: 'hikvision-ds-k1t320',
              is_present: true,
              is_late: this.isLate(eventTime),
            },
          ])
          .select()
          .single();

        if (error) throw error;
        return { ok: true, data, action: 'check_in' };
      } else {
        // Update check-out
        if (!existingRecord) {
          // ถ้าไม่มี check-in แบบจำเป็นต้องสร้าง (กรณี check-out อย่างเดียว)
          const checkInTime = new Date(eventTime);
          checkInTime.setHours(8, 0, 0); // assume check-in at 8:00 AM

          const { data, error } = await supabase
            .from('attendance_records')
            .insert([
              {
                employee_id: employee.id,
                check_in_time: checkInTime.toISOString(),
                check_out_time: eventTime,
                work_date: workDate,
                status: 'present',
                device_id: 'hikvision-ds-k1t320',
                is_present: true,
                is_late: false,
              },
            ])
            .select()
            .single();

          if (error) throw error;
          return { ok: true, data, action: 'check_out_new' };
        }

        // Calculate duration
        const checkInTime = new Date(existingRecord.check_in_time);
        const checkOutTime = new Date(eventTime);
        const durationMinutes = Math.round(
          (checkOutTime.getTime() - checkInTime.getTime()) / 60000
        );

        const { data, error } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: eventTime,
            duration_minutes: durationMinutes,
          })
          .eq('id', existingRecord.id)
          .select()
          .single();

        if (error) throw error;
        return { ok: true, data, action: 'check_out' };
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to process event',
      };
    }
  }

  /**
   * ตรวจสอบว่าเข้ามาสายไหม (หลังจาก 09:00)
   */
  private isLate(timeString: string): boolean {
    const time = new Date(timeString);
    const hour = time.getHours();
    const minute = time.getMinutes();
    const totalMinutes = hour * 60 + minute;
    const nineAm = 9 * 60; // 540 minutes
    return totalMinutes > nineAm;
  }

  /**
   * Sync ข้อมูลทั้งหมดจาก Hikvision ในช่วงเวลา
   */
  async syncAttendanceData(startTime: string, endTime: string) {
    try {
      // 1. ดึงเหตุการณ์จาก Hikvision
      const eventsResult = await this.getAccessEvents(startTime, endTime);
      if (!eventsResult.ok) throw new Error(eventsResult.error);

      const events = eventsResult.data;
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // 2. Process แต่ละ event
      for (const event of events) {
        const result = await this.processEvent(event);
        if (result.ok) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`Event ${event.EventID}: ${result.error}`);
        }
      }

      // 3. บันทึก sync log
      await supabase.from('sync_logs').insert([
        {
          source: 'hikvision',
          sync_date: new Date().toISOString(),
          records_processed: events.length,
          records_success: successCount,
          records_failed: errorCount,
          errors: errors.length > 0 ? errors.join('\n') : null,
        },
      ]);

      return {
        ok: true,
        data: {
          total: events.length,
          success: successCount,
          failed: errorCount,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      };
    }
  }
}

export default HikvisionService;

/**
 * Helper: ใช้ singleton pattern เพื่อ reuse instance
 */
let hikvisionInstance: HikvisionService | null = null;

export function getHikvisionService(config?: HikvisionConfig): HikvisionService {
  if (!hikvisionInstance && config) {
    hikvisionInstance = new HikvisionService(config);
  }
  if (!hikvisionInstance) {
    throw new Error('HikvisionService not initialized. Provide config first.');
  }
  return hikvisionInstance;
}
