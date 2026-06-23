import { recordVisitorCheckOut } from '@/lib/cctv-service';

export async function POST(request: Request) {
  try {
    const { visitor_id } = await request.json();

    if (!visitor_id) {
      return Response.json(
        { error: 'visitor_id is required' },
        { status: 400 }
      );
    }

    const result = await recordVisitorCheckOut(visitor_id);

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
