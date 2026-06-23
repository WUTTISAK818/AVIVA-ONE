import { syncTapoCameraEvents } from '@/lib/tapo-camera-cronjob';

/**
 * Vercel Cron: Every 5 minutes
 * Syncs facial recognition and person detection from TP-Link Tapo camera
 */
export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const result = await syncTapoCameraEvents();
  return new Response(result.body, { status: result.statusCode });
}
