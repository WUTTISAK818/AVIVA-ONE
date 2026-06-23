import { recordVisitorCheckIn } from '@/lib/cctv-service';

export async function POST(request: Request) {
  try {
    const visitor = await request.json();

    if (!visitor.visitor_name) {
      return Response.json(
        { error: 'visitor_name is required' },
        { status: 400 }
      );
    }

    const result = await recordVisitorCheckIn(visitor);

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
