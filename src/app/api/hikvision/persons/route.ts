import { getHikvisionService } from '@/lib/hikvision-service';

/**
 * GET /api/hikvision/persons
 * ดึงรายชื่อพนักงานที่มีลายนิ้วบันทึกไว้ในเครื่อง
 */
export async function GET(request: Request) {
  try {
    const hikvisionService = getHikvisionService({
      deviceIp: process.env.HIKVISION_IP || '192.168.1.100',
      username: process.env.HIKVISION_USERNAME || 'admin',
      password: process.env.HIKVISION_PASSWORD || '',
      port: parseInt(process.env.HIKVISION_PORT || '8080'),
    });

    const result = await hikvisionService.getPersonList();

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
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
