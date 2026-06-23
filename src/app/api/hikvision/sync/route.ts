import { getHikvisionService } from '@/lib/hikvision-service';

export async function POST(request: Request) {
  try {
    const { startTime, endTime } = await request.json();

    // Validate
    if (!startTime || !endTime) {
      return Response.json(
        { error: 'startTime and endTime are required (ISO format)' },
        { status: 400 }
      );
    }

    // Initialize Hikvision service with config from environment
    const hikvisionService = getHikvisionService({
      deviceIp: process.env.HIKVISION_IP || '192.168.1.100',
      username: process.env.HIKVISION_USERNAME || 'admin',
      password: process.env.HIKVISION_PASSWORD || '',
      port: parseInt(process.env.HIKVISION_PORT || '8080'),
    });

    // Sync attendance data
    const result = await hikvisionService.syncAttendanceData(startTime, endTime);

    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: 400 }
      );
    }

    const syncData = result.data || { total: 0, success: 0, failed: 0 };
    return Response.json({
      success: true,
      data: syncData,
      message: `Synced ${syncData.total} events: ${syncData.success} success, ${syncData.failed} failed`,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - ดึงข้อมูลวันนี้
 */
export async function GET(request: Request) {
  try {
    const endTime = new Date().toISOString();
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0);

    const hikvisionService = getHikvisionService({
      deviceIp: process.env.HIKVISION_IP || '192.168.1.100',
      username: process.env.HIKVISION_USERNAME || 'admin',
      password: process.env.HIKVISION_PASSWORD || '',
      port: parseInt(process.env.HIKVISION_PORT || '8080'),
    });

    const result = await hikvisionService.syncAttendanceData(
      startTime.toISOString(),
      endTime
    );

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
