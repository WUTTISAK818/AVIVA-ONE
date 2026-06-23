import { recordCCTVEvent } from '@/lib/cctv-service';

export async function POST(request: Request) {
  try {
    const event = await request.json();

    if (!event.event_type || !event.camera_id) {
      return Response.json(
        { error: 'event_type and camera_id are required' },
        { status: 400 }
      );
    }

    const result = await recordCCTVEvent(event);

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
