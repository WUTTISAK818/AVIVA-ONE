import { getTapoCameraService } from '@/lib/tapo-camera-service';

/**
 * GET /api/tapo/daily-summary?date=2026-06-23
 * ดึง daily summary จากกล้อง Tapo
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return Response.json(
        { error: 'date parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const tapoService = getTapoCameraService({
      cameraIp: process.env.TAPO_CAMERA_IP || '192.168.1.101',
      username: process.env.TAPO_USERNAME || 'admin@example.com',
      password: process.env.TAPO_PASSWORD || '',
    });

    const result = await tapoService.generateDailySummary(date);

    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      data: result.data,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
