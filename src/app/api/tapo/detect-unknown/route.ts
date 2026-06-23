import { getTapoCameraService } from '@/lib/tapo-camera-service';

/**
 * GET /api/tapo/detect-unknown?startTime=2026-06-23T08:00:00Z&endTime=2026-06-23T18:00:00Z
 * ตรวจจับผู้มาเยี่ยม (unknown faces / new customers)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const cameraId = searchParams.get('cameraId') || 'tapo-c260-01';

    if (!startTime || !endTime) {
      return Response.json(
        { error: 'startTime and endTime are required (ISO format)' },
        { status: 400 }
      );
    }

    const tapoService = getTapoCameraService({
      cameraIp: process.env.TAPO_CAMERA_IP || '192.168.1.101',
      username: process.env.TAPO_USERNAME || 'admin@example.com',
      password: process.env.TAPO_PASSWORD || '',
    });

    // Authenticate
    const authResult = await tapoService.authenticate();
    if (!authResult.ok) {
      return Response.json(
        { error: 'Failed to authenticate with camera' },
        { status: 401 }
      );
    }

    // Detect unknown visitors
    const result = await tapoService.detectUnknownVisitors(startTime, endTime, cameraId);

    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      data: result.data,
      count: Array.isArray(result.data) ? result.data.length : 0,
      message: `Detected ${Array.isArray(result.data) ? result.data.length : 0} unknown visitors`,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
