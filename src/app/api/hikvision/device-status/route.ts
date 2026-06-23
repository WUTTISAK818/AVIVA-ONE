import { supabase } from '@/lib/supabase';

/**
 * GET /api/hikvision/device-status
 * ดึง status ของเครื่องและข้อมูลการ sync ล่าสุด
 */
export async function GET(request: Request) {
  try {
    // ดึง sync logs ล่าสุด
    const { data: latestSync } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('source', 'hikvision')
      .order('sync_date', { ascending: false })
      .limit(1)
      .single();

    // ดึง sync stats วันนี้
    const today = new Date().toISOString().split('T')[0];
    const { data: todayLogs } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('source', 'hikvision')
      .gte('sync_date', `${today}T00:00:00Z`);

    const todayStats = todayLogs?.reduce(
      (acc, log) => ({
        syncs: acc.syncs + 1,
        records: acc.records + (log.records_processed || 0),
        success: acc.success + (log.records_success || 0),
        failed: acc.failed + (log.records_failed || 0),
      }),
      { syncs: 0, records: 0, success: 0, failed: 0 }
    ) || { syncs: 0, records: 0, success: 0, failed: 0 };

    // Count employees with Hikvision mapping
    const { data: mappedEmployees, count: mappedCount } = await supabase
      .from('employees')
      .select('id', { count: 'exact' })
      .not('hikvision_person_id', 'is', null);

    // Count total employees
    const { data: allEmployees, count: totalCount } = await supabase
      .from('employees')
      .select('id', { count: 'exact' });

    return Response.json({
      success: true,
      device: {
        name: 'Hikvision DS-K1T320MFWX-B',
        location: 'Sales office entrance',
        status: latestSync ? 'online' : 'unknown',
        lastSync: latestSync?.sync_date || null,
        ipAddress: process.env.HIKVISION_IP || '192.168.1.100',
      },
      today: todayStats,
      mapping: {
        mapped: mappedCount || 0,
        total: totalCount || 0,
        percentage: totalCount ? Math.round(((mappedCount || 0) / totalCount) * 100) : 0,
      },
      lastSync: latestSync,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
