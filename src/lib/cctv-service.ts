import { supabase } from './supabase';
import type { CCTVEvent, VisitorTracking, CCTVEmployeePresence } from './types/cctv';

// ============================================
// CCTV EVENT FUNCTIONS
// ============================================

export async function recordCCTVEvent(event: Partial<CCTVEvent>) {
  try {
    const { data, error } = await supabase
      .from('cctv_events')
      .insert([
        {
          event_date: event.event_date || new Date().toISOString().split('T')[0],
          event_time: event.event_time || new Date().toISOString(),
          event_type: event.event_type,
          detected_person_id: event.detected_person_id,
          detected_person_name: event.detected_person_name,
          confidence_score: event.confidence_score,
          camera_id: event.camera_id,
          frame_url: event.frame_url,
          presence_duration_minutes: event.presence_duration_minutes,
          notes: event.notes,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to record CCTV event' };
  }
}

export async function getCCTVEventsByDate(date: string, cameraId?: string) {
  try {
    let query = supabase.from('cctv_events').select('*').eq('event_date', date);

    if (cameraId) {
      query = query.eq('camera_id', cameraId);
    }

    const { data, error } = await query.order('event_time', { ascending: false });

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch CCTV events' };
  }
}

export async function getCCTVEventsByEmployee(employeeId: string, startDate: string, endDate: string) {
  try {
    const { data, error } = await supabase
      .from('cctv_events')
      .select('*')
      .eq('detected_person_id', employeeId)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_time', { ascending: false });

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch CCTV events' };
  }
}

// ============================================
// CCTV EMPLOYEE PRESENCE FUNCTIONS
// ============================================

export async function recordEmployeePresence(employeeId: string, date: string, detectionTime: string) {
  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from('cctv_employee_presence')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('presence_date', date)
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('cctv_employee_presence')
        .update({
          last_detected_time: detectionTime,
          detection_count: (existing.detection_count || 0) + 1,
          total_presence_minutes: calculatePresenceDuration(
            new Date(existing.first_detected_time).getTime(),
            new Date(detectionTime).getTime()
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return { ok: true, data };
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('cctv_employee_presence')
        .insert([
          {
            employee_id: employeeId,
            presence_date: date,
            first_detected_time: detectionTime,
            last_detected_time: detectionTime,
            total_presence_minutes: 0,
            detection_count: 1,
            status: 'present',
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { ok: true, data };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to record presence' };
  }
}

export async function getEmployeePresence(employeeId: string, date: string) {
  try {
    const { data, error } = await supabase
      .from('cctv_employee_presence')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('presence_date', date)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    return { ok: true, data: data || null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch presence' };
  }
}

// ============================================
// VISITOR TRACKING FUNCTIONS
// ============================================

export async function recordVisitorCheckIn(visitor: Partial<VisitorTracking>) {
  try {
    const { data, error } = await supabase
      .from('visitor_tracking')
      .insert([
        {
          visit_date: visitor.visit_date || new Date().toISOString().split('T')[0],
          visit_time: visitor.visit_time || new Date().toISOString(),
          visitor_name: visitor.visitor_name,
          visitor_phone: visitor.visitor_phone,
          visitor_company: visitor.visitor_company,
          purpose: visitor.purpose,
          host_employee_id: visitor.host_employee_id,
          check_in_time: new Date().toISOString(),
          camera_frame_url: visitor.camera_frame_url,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to record visitor' };
  }
}

export async function recordVisitorCheckOut(visitorId: string) {
  try {
    const { data: visitor, error: fetchError } = await supabase
      .from('visitor_tracking')
      .select('*')
      .eq('id', visitorId)
      .single();

    if (fetchError) throw fetchError;

    const checkOutTime = new Date();
    const checkInTime = new Date(visitor.check_in_time);
    const durationMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

    const { data, error } = await supabase
      .from('visitor_tracking')
      .update({
        check_out_time: checkOutTime.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq('id', visitorId)
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to checkout visitor' };
  }
}

export async function getVisitorsByDate(date: string) {
  try {
    const { data, error } = await supabase
      .from('visitor_tracking')
      .select('*')
      .eq('visit_date', date)
      .order('visit_time', { ascending: false });

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch visitors' };
  }
}

export async function getVisitorsByHost(hostEmployeeId: string, startDate: string, endDate: string) {
  try {
    const { data, error } = await supabase
      .from('visitor_tracking')
      .select('*')
      .eq('host_employee_id', hostEmployeeId)
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .order('visit_time', { ascending: false });

    if (error) throw error;

    const summary = {
      total_visitors: data?.length || 0,
      unique_visitors: new Set(data?.map(v => v.visitor_name)).size || 0,
      total_duration_minutes: data?.reduce((sum, v) => sum + (v.duration_minutes || 0), 0) || 0,
    };

    return { ok: true, data, summary };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch visitor data' };
  }
}

// ============================================
// DAILY SUMMARY FUNCTIONS
// ============================================

export async function generateDailySummary(date: string) {
  try {
    // Get all events for the day
    const { data: events, error: eventsError } = await supabase
      .from('cctv_events')
      .select('*')
      .eq('event_date', date);

    if (eventsError) throw eventsError;

    // Get all visitor records
    const { data: visitors, error: visitorsError } = await supabase
      .from('visitor_tracking')
      .select('*')
      .eq('visit_date', date);

    if (visitorsError) throw visitorsError;

    // Calculate summary
    const summary = {
      total_events: events?.length || 0,
      total_persons_detected: new Set(events?.map(e => e.detected_person_id).filter(Boolean)).size || 0,
      unique_employees: new Set(events?.filter(e => e.event_type === 'face_recognized').map(e => e.detected_person_id).filter(Boolean)).size || 0,
      unique_visitors: new Set(visitors?.map(v => v.visitor_name)).size || 0,
      avg_presence_duration_minutes: Math.round(
        (events?.reduce((sum, e) => sum + (e.presence_duration_minutes || 0), 0) || 0) / (events?.length || 1)
      ),
      alerts_count: events?.filter(e => e.event_type === 'abnormal_activity').length || 0,
    };

    // Upsert summary
    const { data, error } = await supabase
      .from('cctv_daily_summary')
      .upsert([{ summary_date: date, ...summary }], { onConflict: 'summary_date' })
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to generate summary' };
  }
}

export async function getDailySummary(date: string) {
  try {
    const { data, error } = await supabase
      .from('cctv_daily_summary')
      .select('*')
      .eq('summary_date', date)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return { ok: true, data: data || null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch summary' };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculatePresenceDuration(startTime: number, endTime: number): number {
  return Math.round((endTime - startTime) / 60000);
}
