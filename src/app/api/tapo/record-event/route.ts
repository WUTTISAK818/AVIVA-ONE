import { getTapoCameraService } from '@/lib/tapo-camera-service';

/**
 * POST /api/tapo/record-event
 * บันทึก facial recognition หรือ person detection event จากกล้อง
 */
export async function POST(request: Request) {
  try {
    const event = await request.json();

    if (!event.event_type || !event.camera_id) {
      return Response.json(
        { error: 'event_type and camera_id are required' },
        { status: 400 }
      );
    }

    const tapoService = getTapoCameraService({
      cameraIp: process.env.TAPO_CAMERA_IP || '192.168.1.101',
      username: process.env.TAPO_USERNAME || 'admin@example.com',
      password: process.env.TAPO_PASSWORD || '',
    });

    const result = await tapoService.recordCCTVEvent(event);

    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return Response.json({ success: true, data: result.data });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
