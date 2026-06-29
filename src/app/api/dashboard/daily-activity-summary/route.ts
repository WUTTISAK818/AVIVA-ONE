import { supabase } from '@/lib/supabase';

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // ดึง activity ประจำวันนี้ grouped by performer
    const { data: activities, error } = await supabase
      .from('daily_activity_log')
      .select(`
        id,
        performer_id,
        performer_name,
        performer_department,
        activity_type,
        category,
        description,
        quantity,
        amount,
        created_at
      `)
      .eq('activity_date', today)
      .eq('project_id', PROJECT_ID)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by performer
    const byPerformer: Record<string, any> = {};
    (activities || []).forEach((act: any) => {
      const key = act.performer_id || 'unknown';
      if (!byPerformer[key]) {
        byPerformer[key] = {
          performer_id: act.performer_id,
          performer_name: act.performer_name || 'Unknown',
          performer_department: act.performer_department || 'N/A',
          activities: [],
          activity_count: 0,
          total_value: 0,
        };
      }
      byPerformer[key].activities.push(act);
      byPerformer[key].activity_count += 1;
      byPerformer[key].total_value += Number(act.amount) || 0;
    });

    const summary = Object.values(byPerformer).sort((a: any, b: any) =>
      (b.total_value || 0) - (a.total_value || 0)
    );

    return Response.json({
      success: true,
      data: summary,
      total_activities: activities?.length || 0,
      date: today,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch daily summary' },
      { status: 500 }
    );
  }
}
