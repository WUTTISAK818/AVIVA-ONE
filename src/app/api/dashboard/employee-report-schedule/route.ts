import { supabase } from '@/lib/supabase';

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // ดึง report schedules ที่ active
    const { data: schedules, error: schedError } = await supabase
      .from('employee_report_schedule')
      .select('*')
      .eq('project_id', PROJECT_ID);

    if (schedError) throw schedError;

    // สำหรับแต่ละ schedule ดึง submission status ของวันนี้
    const scheduleWithStatus = await Promise.all(
      (schedules || []).map(async (schedule) => {
        const { data: submissions, error: subError } = await supabase
          .from('employee_report_submissions')
          .select(`
            id,
            submitted_by_name,
            submitted_by_department,
            status,
            submitted_at
          `)
          .eq('schedule_id', schedule.id)
          .eq('report_date', today);

        if (subError) throw subError;

        const submitted = (submissions || []).filter(s => s.status === 'submitted').length;
        const pending = (submissions || []).filter(s => s.status === 'pending').length;
        const approved = (submissions || []).filter(s => s.status === 'approved').length;

        return {
          ...schedule,
          submissions_today: {
            total: submissions?.length || 0,
            submitted,
            pending,
            approved,
            details: submissions,
          },
        };
      })
    );

    return Response.json({
      success: true,
      date: today,
      schedules: scheduleWithStatus,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch report schedule' },
      { status: 500 }
    );
  }
}
