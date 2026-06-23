import { syncHikvisionAttendance } from '@/lib/hikvision-cronjob';

/**
 * Vercel Cron: Every 5 minutes
 * Syncs attendance data from Hikvision fingerprint scanner
 */
export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const result = await syncHikvisionAttendance();
  return new Response(result.body, { status: result.statusCode });
}
